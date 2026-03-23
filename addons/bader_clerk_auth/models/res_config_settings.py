# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    clerk_publishable_key = fields.Char(
        string="Clerk Publishable Key",
        config_parameter="clerk.publishable_key",
    )
    clerk_secret_key = fields.Char(
        string="Clerk Secret Key",
        config_parameter="clerk.secret_key",
    )
    clerk_webhook_signing_secret = fields.Char(
        string="Clerk Webhook Signing Secret",
        config_parameter="clerk.webhook_signing_secret",
    )
    clerk_jwks_url = fields.Char(
        string="Clerk JWKS URL",
        config_parameter="clerk.jwks_url",
    )
    clerk_frontend_api = fields.Char(
        string="Clerk Frontend API",
        config_parameter="clerk.frontend_api",
    )
    clerk_default_user_group = fields.Char(
        string="Clerk Default User Group XML ID",
        default="base.group_portal",
        config_parameter="clerk.default_user_group",
        help="Use an external user group such as base.group_portal.",
    )
