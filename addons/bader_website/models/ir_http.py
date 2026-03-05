# -*- coding: utf-8 -*-
from odoo import models


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

        headers = response.headers
        headers.setdefault(
            'Content-Security-Policy',
            "default-src 'self' https: data: blob:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
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
        )
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
