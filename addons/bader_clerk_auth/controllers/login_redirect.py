"""Override Odoo /web/login to redirect to Clerk.

Keeps ?native=1 as an emergency escape hatch for native Odoo login.
"""

import logging

from odoo import http
from odoo.http import request
from odoo.addons.website.controllers.main import Website

_logger = logging.getLogger(__name__)


class ClerkLoginRedirect(Website):

    @http.route(type="http", website=True, auth="public", sitemap=False)
    def web_login(self, redirect=None, **kwargs):
        """Override native login to redirect to Clerk sign-in.

        Pass ?native=1 to use the standard Odoo login form (emergency).
        """
        if kwargs.get("native"):
            return super().web_login(redirect=redirect, **kwargs)

        # If already authenticated, go to /web
        if request.session.uid:
            return request.redirect(redirect or "/web")

        # Check if Clerk is configured
        ICP = request.env["ir.config_parameter"].sudo()
        frontend_api = ICP.get_param("clerk.frontend_api", "")

        if not frontend_api:
            _logger.warning("Clerk not configured, falling back to native login")
            return super().web_login(redirect=redirect, **kwargs)

        # Redirect to Clerk login
        clerk_login_url = "/clerk/login"
        if redirect:
            clerk_login_url += "?redirect=%s" % redirect

        return request.redirect(clerk_login_url)
