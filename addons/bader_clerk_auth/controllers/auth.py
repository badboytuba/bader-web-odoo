"""Clerk authentication controller: JWT validation, callback, and webhook."""

import base64
import hashlib
import hmac
import json
import logging
import math
import threading
import time

import requests as http_requests
from odoo import SUPERUSER_ID, http
from odoo.exceptions import AccessDenied
from odoo.http import request

_logger = logging.getLogger(__name__)

# ─── M3: Lazy singleton JWKClient ──────────────────────────────
_jwks_client = None
_jwks_client_url = None
_jwks_lock = threading.Lock()

# ─── M5: Callback rate limiter ─────────────────────────────────
_CALLBACK_RATE_WINDOW = 60  # seconds
_CALLBACK_RATE_MAX = 10     # max attempts per IP per window
_CALLBACK_RATE_LOCK_SECONDS = 120
_CALLBACK_RATE_STATE = {}
_CALLBACK_RATE_LOCK = threading.Lock()
_CALLBACK_RATE_MAX_KEYS = 2000


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


def _get_jwks_client(jwks_url):
    """M3: Return a singleton PyJWKClient, reused across requests."""
    global _jwks_client, _jwks_client_url
    if _jwks_client and _jwks_client_url == jwks_url:
        return _jwks_client
    with _jwks_lock:
        if _jwks_client and _jwks_client_url == jwks_url:
            return _jwks_client
        try:
            from jwt import PyJWKClient
        except ImportError:
            _logger.error("PyJWT not installed. Run: pip install PyJWT cryptography")
            return None
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        _jwks_client_url = jwks_url
    return _jwks_client


def _decode_clerk_jwt(token, config):
    """Decode and validate a Clerk JWT token."""
    try:
        import jwt
    except ImportError:
        _logger.error("PyJWT not installed. Run: pip install PyJWT cryptography")
        return None

    jwks_url = config["jwks_url"]
    if not jwks_url:
        _logger.error("clerk.jwks_url not configured")
        return None

    try:
        jwks_client = _get_jwks_client(jwks_url)
        if not jwks_client:
            return None
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


# ─── M5: Callback rate limiting ────────────────────────────────
def _callback_client_ip():
    """Extract client IP for rate limiting."""
    httprequest = getattr(request, "httprequest", None)
    if not httprequest:
        return "unknown"
    forwarded = (httprequest.headers.get("X-Forwarded-For") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()[:96] or "unknown"
    return (httprequest.remote_addr or "unknown")[:96]


def _callback_rate_check():
    """M5: Check callback rate limit. Returns (allowed, retry_after)."""
    now_ts = time.time()
    ip = _callback_client_ip()
    key = "clerk_callback|%s" % ip

    with _CALLBACK_RATE_LOCK:
        # Cleanup stale keys
        if len(_CALLBACK_RATE_STATE) > _CALLBACK_RATE_MAX_KEYS:
            stale_cutoff = now_ts - (_CALLBACK_RATE_WINDOW + _CALLBACK_RATE_LOCK_SECONDS) * 2
            stale = [
                k for k, v in _CALLBACK_RATE_STATE.items()
                if float(v.get("locked_until", 0)) < now_ts
                and (v.get("attempts", [])[-1] if v.get("attempts") else 0) < stale_cutoff
            ]
            for k in stale[:max(0, len(_CALLBACK_RATE_STATE) - _CALLBACK_RATE_MAX_KEYS)]:
                _CALLBACK_RATE_STATE.pop(k, None)

        state = _CALLBACK_RATE_STATE.setdefault(key, {"attempts": [], "locked_until": 0.0})

        locked_until = float(state.get("locked_until", 0))
        if locked_until > now_ts:
            return False, int(math.ceil(locked_until - now_ts))

        recent = [ts for ts in state.get("attempts", []) if (now_ts - float(ts)) <= _CALLBACK_RATE_WINDOW]
        recent.append(now_ts)
        state["attempts"] = recent

        if len(recent) > _CALLBACK_RATE_MAX:
            state["attempts"] = []
            state["locked_until"] = now_ts + _CALLBACK_RATE_LOCK_SECONDS
            return False, _CALLBACK_RATE_LOCK_SECONDS

    return True, 0


# ─── M2: Svix webhook signature verification ──────────────────
def _verify_svix_signature(raw_body, headers, webhook_secret):
    """Verify Clerk/Svix webhook signature using HMAC-SHA256.

    Clerk uses Svix for webhooks. The signing secret is base64-encoded
    with a 'whsec_' prefix. The signature is computed over:
        msg_id.timestamp.body
    """
    svix_id = headers.get("svix-id", "")
    svix_timestamp = headers.get("svix-timestamp", "")
    svix_signature = headers.get("svix-signature", "")

    if not svix_id or not svix_timestamp or not svix_signature:
        _logger.warning("Webhook missing Svix headers")
        return False

    # Validate timestamp (reject if > 5 min old to prevent replay)
    try:
        ts = int(svix_timestamp)
        if abs(time.time() - ts) > 300:
            _logger.warning("Webhook timestamp too old: %s", svix_timestamp)
            return False
    except (ValueError, TypeError):
        _logger.warning("Webhook invalid timestamp: %s", svix_timestamp)
        return False

    # Decode the secret (strip 'whsec_' prefix, base64 decode)
    secret = webhook_secret
    if secret.startswith("whsec_"):
        secret = secret[6:]
    try:
        secret_bytes = base64.b64decode(secret)
    except Exception:
        _logger.error("Could not decode webhook signing secret")
        return False

    # Compute expected signature
    msg = "%s.%s.%s" % (svix_id, svix_timestamp, raw_body)
    expected = hmac.new(secret_bytes, msg.encode("utf-8"), hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode("utf-8")

    # Compare against all provided signatures (Svix sends comma-separated)
    for sig_entry in svix_signature.split(" "):
        parts = sig_entry.split(",", 1)
        if len(parts) == 2:
            sig_b64 = parts[1]
        else:
            sig_b64 = parts[0]
        if hmac.compare_digest(expected_b64, sig_b64):
            return True

    _logger.warning("Webhook signature mismatch")
    return False


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
        # M5: Rate limit callback requests
        allowed, retry_after = _callback_rate_check()
        if not allowed:
            _logger.warning(
                "Clerk callback rate limited for IP %s (retry in %ss)",
                _callback_client_ip(), retry_after,
            )
            return request.make_response(
                "Too many requests. Retry after %s seconds." % retry_after,
                headers=[("Content-Type", "text/plain"), ("Retry-After", str(retry_after))],
            )

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
        except Exception as exc:
            _logger.exception(
                "Clerk callback error for %s: %s", email or clerk_user_id, exc
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
        # M2: Verify Svix signature before processing
        raw_body = request.httprequest.get_data(as_text=True)
        webhook_secret = (
            request.env["ir.config_parameter"]
            .sudo()
            .get_param("clerk.webhook_signing_secret", "")
        )
        if webhook_secret and webhook_secret != "CHANGE_ME_VIA_SETTINGS":
            if not _verify_svix_signature(
                raw_body, request.httprequest.headers, webhook_secret
            ):
                _logger.warning("Clerk webhook rejected: invalid Svix signature")
                return {"error": "Invalid signature"}
        else:
            _logger.warning(
                "Clerk webhook signing secret not configured — "
                "skipping signature verification (INSECURE)"
            )

        try:
            body = json.loads(raw_body)
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
