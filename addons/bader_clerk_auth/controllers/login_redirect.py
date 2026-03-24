"""Route website users to Clerk while keeping native login for internals."""

import logging

import requests
from odoo import http
from odoo.addons.website.controllers.main import Website
from odoo.http import request

# M4: Reuse the complete versions from auth.py (includes blocked_prefixes)
from .auth import (
    _get_clerk_config,
    _get_missing_clerk_config,
    _is_backend_redirect,
    _is_clerk_website_auth_ready,
    _safe_redirect_path,
)

_logger = logging.getLogger(__name__)


class ClerkLoginRedirect(Website):

    @http.route(type="http", website=True, auth="public", sitemap=False)
    def web_login(self, redirect=None, **kwargs):
        """Use native login for backend/internal flows and Clerk for website flows."""
        if kwargs.get("native") or request.httprequest.method != "GET":
            return super().web_login(redirect=redirect, **kwargs)

        safe_redirect = _safe_redirect_path(redirect)
        if _is_backend_redirect(safe_redirect):
            return super().web_login(redirect=safe_redirect or redirect, **kwargs)

        if request.session.uid:
            return request.redirect(safe_redirect or "/web")

        config = _get_clerk_config()
        if not _is_clerk_website_auth_ready(config):
            missing = _get_missing_clerk_config(config)
            _logger.info(
                "Clerk not configured (%s), falling back to native login",
                ", ".join(missing),
            )
            return super().web_login(redirect=safe_redirect or redirect, **kwargs)

        clerk_login_url = "/clerk/login?redirect=%s" % requests.utils.quote(
            safe_redirect or "/",
            safe="",
        )
        return request.redirect(clerk_login_url)
