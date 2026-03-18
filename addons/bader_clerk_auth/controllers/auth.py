"""Clerk authentication controller — JWT validation, login, callback, webhook."""

import json
import logging
import time
import uuid

import requests as http_requests
from odoo import http, SUPERUSER_ID
from odoo.http import request

_logger = logging.getLogger(__name__)

# Cache JWKS for 1 hour
_jwks_cache = {"keys": None, "expires": 0}
JWKS_TTL = 3600


def _get_clerk_config():
    """Read Clerk settings from ir.config_parameter."""
    ICP = request.env["ir.config_parameter"].sudo()
    return {
        "publishable_key": ICP.get_param("clerk.publishable_key", ""),
        "secret_key": ICP.get_param("clerk.secret_key", ""),
        "jwks_url": ICP.get_param("clerk.jwks_url", ""),
        "frontend_api": ICP.get_param("clerk.frontend_api", ""),
    }


def _decode_clerk_jwt(token, config):
    """Decode and validate a Clerk JWT token.

    Returns dict with user claims, or None on failure.
    """
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
        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return decoded
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

    # --- Fix #3: auth='public' for DB context ---

    @http.route("/clerk/config", type="http", auth="public", csrf=False,
                website=True)
    def clerk_config(self, **kwargs):
        """Return Clerk publishable config for the JS SDK (public)."""
        config = _get_clerk_config()
        payload = json.dumps({
            "publishable_key": config["publishable_key"],
            "frontend_api": config["frontend_api"],
        })
        return request.make_response(
            payload,
            headers=[("Content-Type", "application/json")],
        )

    @http.route("/clerk/login", type="http", auth="public", csrf=False,
                website=True)
    def clerk_login(self, redirect=None, **kwargs):
        """Redirect to a website page that auto-opens the Clerk sign-in modal."""
        config = _get_clerk_config()
        frontend_api = config["frontend_api"]

        if not frontend_api:
            return request.redirect("/web/login?native=1")

        redirect_path = redirect or "/"
        bootstrap_url = "/?clerk_login=1&redirect=%s" % (
            http_requests.utils.quote(redirect_path, safe="")
        )
        return request.redirect(bootstrap_url)

    @http.route("/clerk/callback", type="http", auth="public", csrf=False,
                website=True)
    def clerk_callback(self, **kwargs):
        """Handle Clerk callback after authentication.

        Validates the JWT, finds/creates Odoo user, establishes session.
        """
        config = _get_clerk_config()

        # Get token from __session cookie (Clerk default) or query param
        token = request.httprequest.cookies.get("__session")
        if not token:
            token = kwargs.get("token") or kwargs.get("__clerk_session")

        if not token:
            _logger.warning("No Clerk session token in callback")
            return request.redirect("/clerk/login")

        # Decode JWT
        claims = _decode_clerk_jwt(token, config)
        if not claims:
            _logger.warning("Invalid JWT in Clerk callback")
            return request.redirect("/clerk/login")

        clerk_user_id = claims.get("sub")
        if not clerk_user_id:
            _logger.error("Clerk JWT missing 'sub' claim")
            return request.redirect("/clerk/login")

        # Fetch full user details from Clerk API
        clerk_user = _fetch_clerk_user(clerk_user_id, config["secret_key"])

        # Build user data
        email = ""
        if clerk_user:
            primary_email_id = clerk_user.get("primary_email_address_id")
            for addr in clerk_user.get("email_addresses", []):
                if addr.get("id") == primary_email_id:
                    email = addr.get("email_address", "")
                    break
            if not email and clerk_user.get("email_addresses"):
                email = clerk_user["email_addresses"][0].get("email_address", "")

        clerk_data = {
            "sub": clerk_user_id,
            "email": email or claims.get("email", ""),
            "first_name": (clerk_user or {}).get("first_name")
                or claims.get("given_name", ""),
            "last_name": (clerk_user or {}).get("last_name")
                or claims.get("family_name", ""),
            "image_url": (clerk_user or {}).get("image_url")
                or claims.get("picture", ""),
        }

        # Find or create Odoo user
        Users = request.env["res.users"].with_user(SUPERUSER_ID)
        odoo_user = Users._find_or_create_from_clerk(clerk_data)

        if not odoo_user:
            _logger.error(
                "Could not find/create Odoo user for Clerk ID %s",
                clerk_user_id,
            )
            return request.redirect("/clerk/login")

        # --- Fix #4: Proper Odoo 16 session establishment ---
        # Set a random password for Clerk-only users so authenticate() works
        temp_pw = "clerk_" + uuid.uuid4().hex[:16]
        odoo_user.sudo().write({"password": temp_pw})

        # Standard Odoo session authentication
        request.session.authenticate(request.db, odoo_user.login, temp_pw)

        redirect_url = kwargs.get("redirect", "/")
        _logger.info(
            "Clerk auth successful: %s (uid=%s) → %s",
            odoo_user.login,
            odoo_user.id,
            redirect_url,
        )
        return request.redirect(redirect_url)

    @http.route("/clerk/logout", type="http", auth="user", website=True)
    def clerk_logout(self, **kwargs):
        """Log out from Odoo and redirect to Clerk sign-out."""
        config = _get_clerk_config()
        request.session.logout()

        frontend_api = config["frontend_api"]
        if frontend_api:
            return_url = request.httprequest.host_url.rstrip("/") + "/"
            sign_out_url = "%s/sign-out?redirect_url=%s" % (
                frontend_api,
                http_requests.utils.quote(return_url, safe=""),
            )
            return request.redirect(sign_out_url, local=False)

        return request.redirect("/")

    @http.route(
        "/clerk/webhook",
        type="json",
        auth="none",
        csrf=False,
        methods=["POST"],
    )
    def clerk_webhook(self, **kwargs):
        """Handle Clerk webhook events (user.created, user.updated, user.deleted)."""
        # Parse the raw body
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
                "email": email,
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
                "image_url": data.get("image_url", ""),
            }

            Users = request.env["res.users"].with_user(SUPERUSER_ID)
            Users._find_or_create_from_clerk(clerk_data)

        elif event_type == "user.deleted":
            clerk_id = data.get("id")
            if clerk_id:
                user = (
                    request.env["res.users"]
                    .with_user(SUPERUSER_ID)
                    .search([("clerk_user_id", "=", clerk_id)], limit=1)
                )
                if user:
                    _logger.info(
                        "Clerk user.deleted: deactivating Odoo user %s",
                        user.login,
                    )
                    user.sudo().write({"active": False})

        return {"status": "ok"}
