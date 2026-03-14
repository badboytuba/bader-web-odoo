# -*- coding: utf-8 -*-
import base64
import os
import re

from odoo import models


_HTML_CONTENT_TYPES = (
    'text/html',
    'application/xhtml+xml',
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

        csp_nonce = cls._apply_html_csp_nonce(response)
        headers = response.headers
        headers.setdefault(
            'Content-Security-Policy',
            "default-src 'self' https: data: blob:; "
            "script-src 'self' 'unsafe-eval' https:%s; "
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data: https:; "
            "connect-src 'self' https: wss:; "
            "object-src 'none'; "
            "frame-src 'self' https:; "
            "frame-ancestors 'self'; "
            "base-uri 'self'; "
            "form-action 'self' https:; "
            "upgrade-insecure-requests;"
            % ((" 'nonce-%s'" % csp_nonce) if csp_nonce else "")
        )
        headers.setdefault(
            'Content-Security-Policy-Report-Only',
            "default-src 'self' https: data: blob:; "
            "script-src 'self' 'unsafe-eval' https:%s; "
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data: https:; "
            "connect-src 'self' https: wss:; "
            "object-src 'none'; "
            "frame-src 'self' https:; "
            "frame-ancestors 'self'; "
            "base-uri 'self'; "
            "form-action 'self' https:; "
            "report-uri /bader/csp-report;"
            % ((" 'nonce-%s'" % csp_nonce) if csp_nonce else "")
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
    def _apply_html_csp_nonce(cls, response):
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

        if '<script' not in html_text and '<style' not in html_text:
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

        if rewritten != html_text:
            response.set_data(rewritten.encode(charset))
            return nonce
        return None
