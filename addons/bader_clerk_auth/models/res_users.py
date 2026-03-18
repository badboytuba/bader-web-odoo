"""Extend res.users with Clerk user ID and safe portal provisioning."""

import base64
import logging

import requests
from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class ResUsers(models.Model):
    _inherit = "res.users"

    clerk_user_id = fields.Char(
        string="Clerk User ID",
        index=True,
        copy=False,
        help="Unique identifier from Clerk authentication provider.",
    )

    _sql_constraints = [
        (
            "clerk_user_id_unique",
            "UNIQUE(clerk_user_id)",
            "Each Clerk user can only be linked to one Odoo user.",
        ),
    ]

    @api.model
    def _find_or_create_from_clerk(self, clerk_data):
        """Find an external Odoo user or create one from Clerk claims."""
        clerk_id = clerk_data.get("sub") or clerk_data.get("user_id")
        email = (clerk_data.get("email") or "").strip().lower()
        first_name = (
            clerk_data.get("first_name")
            or clerk_data.get("given_name")
            or ""
        )
        last_name = (
            clerk_data.get("last_name")
            or clerk_data.get("family_name")
            or ""
        )
        full_name = ("%s %s" % (first_name, last_name)).strip() or email
        image_url = clerk_data.get("image_url") or clerk_data.get("avatar_url")

        user = self.browse()
        if clerk_id:
            user = self.sudo().search([("clerk_user_id", "=", clerk_id)], limit=1)
        if user:
            self._sync_clerk_data(user, full_name, email, image_url)
            return user

        user = self._find_user_by_clerk_email(email)
        if user:
            if clerk_id:
                user.sudo().write({"clerk_user_id": clerk_id})
            self._sync_clerk_data(user, full_name, email, image_url)
            _logger.info(
                "Linked existing Odoo user %s to Clerk ID %s",
                user.login,
                clerk_id,
            )
            return user

        return self._create_from_clerk(clerk_id, email, full_name, image_url)

    @api.model
    def _find_user_by_clerk_email(self, email):
        """Find an existing Odoo user by login/email for Clerk linking."""
        if not email:
            return self.browse()

        user = self.sudo().search([("login", "=", email)], limit=1)
        if user:
            return user
        return self.sudo().search([("email", "=", email)], limit=1)

    @api.model
    def _find_partner_for_clerk_email(self, email):
        """Reuse an existing contact when provisioning Clerk users."""
        if not email:
            return self.env["res.partner"]

        partners = self.env["res.partner"].sudo().search(
            [("email", "=ilike", email)],
            order="id asc",
        )
        for partner in partners:
            commercial_partner = partner.commercial_partner_id
            if commercial_partner.user_ids.filtered(lambda user: user._is_internal()):
                continue
            if partner.user_ids:
                continue
            return partner
        return self.env["res.partner"]

    @api.model
    def _resolve_clerk_default_group(self):
        """Always provision Clerk users as external users, never internal."""
        ICP = self.env["ir.config_parameter"].sudo()
        portal_group = self.env.ref("base.group_portal", raise_if_not_found=False)
        default_group_ref = ICP.get_param(
            "clerk.default_user_group", "base.group_portal"
        )
        group = self.env.ref(default_group_ref, raise_if_not_found=False) or portal_group
        internal_group = self.env.ref("base.group_user", raise_if_not_found=False)

        if group and internal_group:
            effective_groups = group | group.trans_implied_ids
            if internal_group in effective_groups:
                _logger.warning(
                    "Configured Clerk group %s is internal; falling back to portal",
                    default_group_ref,
                )
                group = portal_group

        return group

    @api.model
    def _create_from_clerk(self, clerk_id, email, full_name, image_url):
        """Create a new external Odoo user from Clerk data."""
        group = self._resolve_clerk_default_group()
        partner = self._find_partner_for_clerk_email(email)

        vals = {
            "name": full_name,
            "login": email or "clerk_%s" % clerk_id,
            "email": email,
            "clerk_user_id": clerk_id,
            "share": True,
        }
        if group:
            vals["groups_id"] = [(6, 0, [group.id])]
        if partner:
            vals["partner_id"] = partner.id

        avatar = self._download_avatar(image_url)
        if avatar:
            vals["image_1920"] = avatar

        user = self.sudo().create(vals)
        _logger.info(
            "Created Odoo user %s (id=%s) from Clerk ID %s",
            user.login,
            user.id,
            clerk_id,
        )
        return user

    @api.model
    def _sync_clerk_data(self, user, full_name, email, image_url):
        """Sync name/email/avatar from Clerk to an Odoo user.

        For internal users, only avatar is synced — name and email are
        authoritative in Odoo and should not be overwritten by Clerk.
        """
        vals = {}
        is_internal = user._is_internal()
        if not is_internal:
            if full_name and user.name != full_name:
                vals["name"] = full_name
            if email and user.email != email:
                vals["email"] = email
        # M6: Sync avatar if user has none or Clerk provides a new URL
        if image_url:
            avatar = self._download_avatar(image_url)
            if avatar and (not user.image_1920 or user.image_1920 != avatar):
                vals["image_1920"] = avatar
        if vals:
            user.sudo().write(vals)

    @api.model
    def _download_avatar(self, url):
        """Download avatar image and return base64 encoded string."""
        if not url:
            return False
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            if resp.headers.get("Content-Type", "").startswith("image/"):
                return base64.b64encode(resp.content).decode()
        except Exception:
            _logger.debug("Could not download Clerk avatar from %s", url)
        return False
