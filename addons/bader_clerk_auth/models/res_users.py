"""Extend res.users with Clerk user ID and auto-provisioning."""

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
        """Find existing or create new Odoo user from Clerk JWT claims.

        Args:
            clerk_data: dict with keys:
                - sub: Clerk user ID (e.g. "user_2x...")
                - email: primary email address
                - first_name / given_name: first name
                - last_name / family_name: last name
                - image_url: avatar URL (optional)

        Returns:
            res.users recordset (single record)
        """
        clerk_id = clerk_data.get("sub") or clerk_data.get("user_id")
        email = clerk_data.get("email", "")
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

        # 1) Search by clerk_user_id
        user = self.sudo().search([("clerk_user_id", "=", clerk_id)], limit=1)
        if user:
            self._sync_clerk_data(user, full_name, email, image_url)
            return user

        # 2) Fallback: search by email
        if email:
            user = self.sudo().search([("login", "=", email)], limit=1)
            if user:
                user.sudo().write({"clerk_user_id": clerk_id})
                self._sync_clerk_data(user, full_name, email, image_url)
                _logger.info(
                    "Linked existing Odoo user %s to Clerk ID %s",
                    user.login,
                    clerk_id,
                )
                return user

        # 3) Create new user
        user = self._create_from_clerk(clerk_id, email, full_name, image_url)
        return user

    @api.model
    def _create_from_clerk(self, clerk_id, email, full_name, image_url):
        """Create a new Odoo user from Clerk data."""
        ICP = self.env["ir.config_parameter"].sudo()
        default_group_ref = ICP.get_param(
            "clerk.default_user_group", "base.group_user"
        )

        group = self.env.ref(default_group_ref, raise_if_not_found=False)
        group_ids = [(4, group.id)] if group else []

        vals = {
            "name": full_name,
            "login": email or "clerk_%s" % clerk_id,
            "email": email,
            "clerk_user_id": clerk_id,
            "groups_id": group_ids,
            "password": False,  # No password — Clerk handles auth
        }

        # Download avatar
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
        """Sync name/email/avatar from Clerk to existing Odoo user."""
        vals = {}
        if full_name and user.name != full_name:
            vals["name"] = full_name
        if email and user.email != email:
            vals["email"] = email
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
