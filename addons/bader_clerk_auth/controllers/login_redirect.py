"""Route website users to Clerk while keeping native login for internals."""

import logging

import requests
from odoo import http
from odoo.addons.website.controllers.main import Website
from odoo.http import request

_logger = logging.getLogger(__name__)


def _safe_redirect_path(raw_redirect):
    redirect_path = (raw_redirect or "").strip()
    if not redirect_path:
        return ""
    if not redirect_path.startswith("/") or redirect_path.startswith("//"):
        return "/"
    return redirect_path


def _is_backend_redirect(redirect_path):
    path = _safe_redirect_path(redirect_path)
    return (
        not path
        or path == "/web"
        or path.startswith("/web?")
        or path.startswith("/web/")
        or path.startswith("/web#")
        or path == "/odoo"
        or path.startswith("/odoo/")
    )


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

        ICP = request.env["ir.config_parameter"].sudo()
        frontend_api = ICP.get_param("clerk.frontend_api", "")
        if not frontend_api:
            _logger.warning("Clerk not configured, falling back to native login")
            return super().web_login(redirect=safe_redirect or redirect, **kwargs)

        clerk_login_url = "/clerk/login?redirect=%s" % requests.utils.quote(
            safe_redirect or "/",
            safe="",
        )
        return request.redirect(clerk_login_url)
