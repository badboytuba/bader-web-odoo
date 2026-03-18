"""Clerk authentication controller: JWT validation, callback, and webhook."""

import json
import logging

import requests as http_requests
from odoo import SUPERUSER_ID, http
from odoo.exceptions import AccessDenied
from odoo.http import request

_logger = logging.getLogger(__name__)


def _get_clerk_config():
    """Read Clerk settings from ir.config_parameter."""
    ICP = request.env["ir.config_parameter"].sudo()
    return {
        "publishable_key": ICP.get_param("clerk.publishable_key", ""),
        "secret_key": ICP.get_param("clerk.secret_key", ""),
        "jwks_url": ICP.get_param("clerk.jwks_url", ""),
        "frontend_api": ICP.get_param("clerk.frontend_api", ""),
    }


def _safe_redirect_path(raw_redirect, default="/"):
    """Allow only local redirect paths."""
    redirect_path = (raw_redirect or default or "/").strip()
    if not redirect_path.startswith("/") or redirect_path.startswith("//"):
        return default
    blocked_prefixes = (
        "/clerk/login",
        "/clerk/callback",
        "/web/login",
        "/web/signup",
        "/bader/auth",
    )
    if redirect_path.startswith(blocked_prefixes):
        return default
    return redirect_path


def _is_backend_redirect(redirect_path):
    """Backend routes must continue using native Odoo login."""
    path = _safe_redirect_path(redirect_path, default="/web")
    return (
        path == "/web"
        or path.startswith("/web?")
        or path.startswith("/web/")
        or path.startswith("/web#")
        or path == "/odoo"
        or path.startswith("/odoo/")
    )


def _build_native_login_url(redirect_path="/web", login=None):
    """Build a native Odoo login URL with safe parameters."""
    safe_redirect = _safe_redirect_path(redirect_path, default="/web")
    query = [
        "native=1",
        "redirect=%s" % http_requests.utils.quote(safe_redirect, safe=""),
    ]
    if login:
        query.append(
            "login=%s" % http_requests.utils.quote(login.strip().lower(), safe="")
        )
    return "/web/login?%s" % "&".join(query)


def _build_clerk_logout_bootstrap_url(redirect_path="/"):
    """Build a safe website URL that asks the browser SDK to sign out Clerk."""
    safe_redirect = _safe_redirect_path(redirect_path, default="/")
    return "/?clerk_logout=1&redirect=%s" % (
        http_requests.utils.quote(safe_redirect, safe="")
    )


def _sync_website_session_flags(user):
    """Keep website session state aligned with external user onboarding."""
    commercial_partner = user.partner_id.commercial_partner_id.sudo()
    needs_onboarding = bool(
        commercial_partner
        and not user._is_internal()
        and not commercial_partner.bader_onboarding_completed_at
    )
    persona = (commercial_partner.bader_persona or "").strip().lower()

    if needs_onboarding:
        request.session["bader_onboarding_pending"] = True
    else:
        request.session.pop("bader_onboarding_pending", None)
    if persona:
        request.session["bader_home_persona"] = persona
    request.session.modified = True
    return needs_onboarding


def _finalize_clerk_session(user):
    """Log in the current HTTP session with an already trusted Clerk identity."""
    request.session.uid = None
    request.session["pre_login"] = user.login
    request.session["pre_uid"] = user.id
    request.session.finalize(request.env)
    request.update_env(user=request.session.uid)
    request.update_context(**request.session.context)


def _decode_clerk_jwt(token, config):
    """Decode and validate a Clerk JWT token."""
    try:
        import jwt
        from jwt import PyJWKClient
    except ImportError:
        _logger.error("PyJWT not installed. Run: pip install PyJWT cryptography")
        return None

    jwks_url = config["jwks_url"]
    if not jwks_url:
        _logger.error("clerk.jwks_url not configured")
        return None

    try:
        jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        _logger.warning("Clerk JWT expired")
    except jwt.InvalidTokenError as exc:
        _logger.warning("Invalid Clerk JWT: %s", exc)
    except Exception:
        _logger.exception("Unexpected error decoding Clerk JWT")
    return None


def _fetch_clerk_user(user_id, secret_key):
    """Fetch full user data from Clerk Backend API."""
    try:
        resp = http_requests.get(
            "https://api.clerk.com/v1/users/%s" % user_id,
            headers={"Authorization": "Bearer %s" % secret_key},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        _logger.exception("Failed to fetch Clerk user %s", user_id)
        return None


class ClerkAuthController(http.Controller):

    @http.route("/clerk/config", type="http", auth="public", csrf=False, website=True)
    def clerk_config(self, **kwargs):
        """Return Clerk publishable config for the JS SDK."""
        config = _get_clerk_config()
        payload = json.dumps(
            {
                "publishable_key": config["publishable_key"],
                "frontend_api": config["frontend_api"],
            }
        )
        return request.make_response(
            payload,
            headers=[("Content-Type", "application/json")],
        )

    @http.route("/clerk/login", type="http", auth="public", csrf=False, website=True)
    def clerk_login(self, redirect=None, **kwargs):
        """Redirect to a website page that auto-opens the Clerk sign-in modal."""
        redirect_path = _safe_redirect_path(redirect, default="/")
        if _is_backend_redirect(redirect_path):
            return request.redirect(_build_native_login_url(redirect_path))

        config = _get_clerk_config()
        if not config["frontend_api"]:
            return request.redirect(_build_native_login_url(redirect_path))

        bootstrap_url = "/?clerk_login=1&redirect=%s" % (
            http_requests.utils.quote(redirect_path, safe="")
        )
        return request.redirect(bootstrap_url)

    @http.route(
        "/clerk/callback", type="http", auth="public", csrf=False, website=True
    )
    def clerk_callback(self, **kwargs):
        """Validate Clerk token, create/link the external user, and log in."""
        config = _get_clerk_config()
        redirect_url = _safe_redirect_path(kwargs.get("redirect"), default="/")

        token = request.httprequest.cookies.get("__session")
        if not token:
            token = kwargs.get("token") or kwargs.get("__clerk_session")

        if not token:
            _logger.warning("No Clerk session token in callback")
            return request.redirect(
                "/clerk/login?redirect=%s"
                % http_requests.utils.quote(redirect_url, safe="")
            )

        claims = _decode_clerk_jwt(token, config)
        if not claims:
            _logger.warning("Invalid JWT in Clerk callback")
            return request.redirect(
                "/clerk/login?redirect=%s"
                % http_requests.utils.quote(redirect_url, safe="")
            )

        clerk_user_id = claims.get("sub")
        if not clerk_user_id:
            _logger.error("Clerk JWT missing 'sub' claim")
            return request.redirect(
                "/clerk/login?redirect=%s"
                % http_requests.utils.quote(redirect_url, safe="")
            )

        clerk_user = _fetch_clerk_user(clerk_user_id, config["secret_key"])

        email = ""
        if clerk_user:
            primary_email_id = clerk_user.get("primary_email_address_id")
            for addr in clerk_user.get("email_addresses", []):
                if addr.get("id") == primary_email_id:
                    email = addr.get("email_address", "")
                    break
            if not email and clerk_user.get("email_addresses"):
                email = clerk_user["email_addresses"][0].get("email_address", "")
        email = (email or claims.get("email", "")).strip().lower()

        clerk_data = {
            "sub": clerk_user_id,
            "email": email,
            "first_name": (clerk_user or {}).get("first_name")
            or claims.get("given_name", ""),
            "last_name": (clerk_user or {}).get("last_name")
            or claims.get("family_name", ""),
            "image_url": (clerk_user or {}).get("image_url")
            or claims.get("picture", ""),
        }

        Users = request.env["res.users"].with_user(SUPERUSER_ID)
        try:
            odoo_user = Users._find_or_create_from_clerk(clerk_data)
        except AccessDenied:
            _logger.info(
                "Blocked Clerk login for internal identity %s", email or clerk_user_id
            )
            return request.redirect(_build_native_login_url(redirect_url, login=email))

        if not odoo_user:
            _logger.error(
                "Could not find/create Odoo user for Clerk ID %s", clerk_user_id
            )
            return request.redirect(
                "/clerk/login?redirect=%s"
                % http_requests.utils.quote(redirect_url, safe="")
            )

        _finalize_clerk_session(odoo_user)
        _sync_website_session_flags(odoo_user)

        _logger.info(
            "Clerk auth successful: %s (uid=%s) -> %s",
            odoo_user.login,
            odoo_user.id,
            redirect_url,
        )
        return request.redirect(redirect_url)

    @http.route("/clerk/logout", type="http", auth="public", website=True, csrf=False)
    def clerk_logout(self, redirect=None, **kwargs):
        """Clear Odoo first, then let the browser SDK sign out the Clerk session."""
        redirect_path = _safe_redirect_path(redirect, default="/")
        request.session.logout()

        config = _get_clerk_config()
        if not config["frontend_api"]:
            return request.redirect(redirect_path)

        return request.redirect(_build_clerk_logout_bootstrap_url(redirect_path))

    @http.route(
        "/clerk/webhook",
        type="json",
        auth="none",
        csrf=False,
        methods=["POST"],
    )
    def clerk_webhook(self, **kwargs):
        """Handle Clerk webhook events (user.created, user.updated, user.deleted)."""
        try:
            body = json.loads(request.httprequest.get_data(as_text=True))
        except (ValueError, TypeError):
            return {"error": "Invalid JSON"}

        event_type = body.get("type", "")
        data = body.get("data", {})

        _logger.info("Clerk webhook received: %s", event_type)

        if event_type in ("user.created", "user.updated"):
            email = ""
            primary_email_id = data.get("primary_email_address_id")
            for addr in data.get("email_addresses", []):
                if addr.get("id") == primary_email_id:
                    email = addr.get("email_address", "")
                    break

            clerk_data = {
                "sub": data.get("id"),
                "email": (email or "").strip().lower(),
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
                "image_url": data.get("image_url", ""),
            }

            Users = request.env["res.users"].with_user(SUPERUSER_ID)
            try:
                Users._find_or_create_from_clerk(clerk_data)
            except AccessDenied:
                _logger.warning(
                    "Ignoring Clerk webhook for internal identity %s",
                    clerk_data["email"] or clerk_data["sub"],
                )

        elif event_type == "user.deleted":
            clerk_id = data.get("id")
            if clerk_id:
                user = (
                    request.env["res.users"]
                    .with_user(SUPERUSER_ID)
                    .search([("clerk_user_id", "=", clerk_id)], limit=1)
                )
                if user and not user._is_internal():
                    _logger.info(
                        "Clerk user.deleted: deactivating Odoo user %s", user.login
                    )
                    user.sudo().write({"active": False})
                elif user:
                    _logger.warning(
                        "Skipping deactivation for internal Clerk-linked user %s",
                        user.login,
                    )

        return {"status": "ok"}
