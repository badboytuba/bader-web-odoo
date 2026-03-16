# -*- coding: utf-8 -*-
import base64
import os
import re

from odoo import models
from odoo.http import request as http_request


_HTML_CONTENT_TYPES = (
    'text/html',
    'application/xhtml+xml',
)
_STRICT_CSP_PATHS = frozenset((
    '/terminos',
    '/privacidad',
    '/cookies',
))
_LAZY_ASSET_SCRIPT_RE = re.compile(
    r'<script\b[^>]*\bsrc=(["\'])(?P<src>[^"\']*web\.assets_frontend_lazy[^"\']*)\1[^>]*>\s*</script>',
    re.IGNORECASE,
)
_SCRIPT_NONCE_RE = re.compile(r'<script(?![^>]*\bnonce=)', re.IGNORECASE)
_STYLE_NONCE_RE = re.compile(r'<style(?![^>]*\bnonce=)', re.IGNORECASE)


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    @classmethod
    def _post_dispatch(cls, response):
        super(IrHttp, cls)._post_dispatch(response)
        cls._apply_response_hardening(response)

    @classmethod
    def _apply_response_hardening(cls, response):
        if not response or not getattr(response, 'headers', None):
            return

        request_path = cls._get_request_path()
        strict_csp = cls._is_strict_csp_path(request_path)
        csp_nonce = cls._rewrite_html_response(response, strip_lazy_asset=strict_csp)
        headers = response.headers
        headers['Content-Security-Policy'] = cls._build_csp_header(
            nonce=csp_nonce,
            allow_unsafe_eval=not strict_csp,
            report_only=False,
        )
        headers['Content-Security-Policy-Report-Only'] = cls._build_csp_header(
            nonce=csp_nonce,
            allow_unsafe_eval=not strict_csp,
            report_only=True,
        )
        headers.setdefault(
            'Report-To',
            '{"group":"bader-csp","max_age":10886400,"endpoints":[{"url":"/bader/csp-report"}]}'
        )
        headers.setdefault('Reporting-Endpoints', 'bader-csp="/bader/csp-report"')
        headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
        headers.setdefault('X-Content-Type-Options', 'nosniff')
        headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        headers.setdefault('Cross-Origin-Resource-Policy', 'same-site')
        headers.setdefault('Origin-Agent-Cluster', '?1')
        headers.setdefault(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
        )
        headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')

    @classmethod
    def _get_request_path(cls):
        try:
            return (http_request.httprequest.path or '').strip()
        except Exception:
            return ''

    @classmethod
    def _is_strict_csp_path(cls, path):
        return path in _STRICT_CSP_PATHS

    @classmethod
    def _build_csp_header(cls, nonce=None, allow_unsafe_eval=True, report_only=False):
        script_eval = " 'unsafe-eval'" if allow_unsafe_eval else ''
        nonce_value = (" 'nonce-%s'" % nonce) if nonce else ''
        tail = "report-uri /bader/csp-report;" if report_only else "upgrade-insecure-requests;"
        return (
            "default-src 'self' https: data: blob:; "
            "script-src 'self'%s https:%s; "
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data: https:; "
            "connect-src 'self' https: wss:; "
            "object-src 'none'; "
            "frame-src 'self' https:; "
            "frame-ancestors 'self'; "
            "base-uri 'self'; "
            "form-action 'self' https:; "
            "%s"
            % (script_eval, nonce_value, tail)
        )

    @classmethod
    def _rewrite_html_response(cls, response, strip_lazy_asset=False):
        content_type = (response.headers.get('Content-Type') or '').lower()
        if not any(token in content_type for token in _HTML_CONTENT_TYPES):
            return None
        if getattr(response, 'direct_passthrough', False):
            return None

        try:
            html_bytes = response.get_data()
        except Exception:
            return None

        if not html_bytes:
            return None

        charset = getattr(response, 'charset', None) or 'utf-8'
        try:
            html_text = html_bytes.decode(charset)
        except Exception:
            html_text = html_bytes.decode('utf-8', errors='ignore')

        modified = False
        if strip_lazy_asset and 'web.assets_frontend_lazy' in html_text:
            rewritten = _LAZY_ASSET_SCRIPT_RE.sub('', html_text)
            if rewritten != html_text:
                html_text = rewritten
                modified = True

        if '<script' not in html_text and '<style' not in html_text:
            if modified:
                response.set_data(html_text.encode(charset))
            return None

        nonce = base64.b64encode(os.urandom(18)).decode('ascii').rstrip('=')
        rewritten = _SCRIPT_NONCE_RE.sub(
            '<script nonce="%s"' % nonce,
            html_text,
        )
        rewritten = _STYLE_NONCE_RE.sub(
            '<style nonce="%s"' % nonce,
            rewritten,
        )

        if rewritten != html_text or modified:
            response.set_data(rewritten.encode(charset))
            return nonce if rewritten != html_text else None
        return None
