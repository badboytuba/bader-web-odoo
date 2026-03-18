# -*- coding: utf-8 -*-
"""Shared helper functions for bader_website controllers (M10)."""

import logging
import re
from odoo.http import request

_logger = logging.getLogger(__name__)

FALLBACK_BASE_URL = 'https://www.bader4business.com'


def _client_ip():
    """Extract the client IP from request headers."""
    httprequest = getattr(request, 'httprequest', None)
    if not httprequest:
        return 'unknown'
    forwarded_for = (httprequest.headers.get('X-Forwarded-For') or '').strip()
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()[:96] or 'unknown'
    return (httprequest.remote_addr or 'unknown')[:96]


def _base_url():
    """Return current request base URL (no trailing slash)."""
    try:
        if request and getattr(request, 'httprequest', None):
            root = (request.httprequest.url_root or '').strip()
            if root:
                return root.rstrip('/')
        if request and getattr(request, 'website', None):
            domain = (request.website.sudo().domain or '').strip()
            if domain:
                if not domain.startswith(('http://', 'https://')):
                    domain = 'https://' + domain
                return domain.rstrip('/')
        if request and getattr(request, 'env', None):
            base = (
                request.env['ir.config_parameter']
                .sudo()
                .get_param('web.base.url')
                or ''
            ).strip()
            if base:
                return base.rstrip('/')
    except Exception:
        pass
    return FALLBACK_BASE_URL


def _is_same_origin_request():
    """Check the request Referer/Origin against the current domain."""
    httprequest = getattr(request, 'httprequest', None)
    if not httprequest:
        return False
    base = _base_url().lower()
    origin = (httprequest.headers.get('Origin') or '').strip().rstrip('/').lower()
    referer = (httprequest.headers.get('Referer') or '').strip().lower()
    if origin and origin == base:
        return True
    if referer and referer.startswith(base):
        return True
    return False


def _is_spam(kw):
    """Check honeypot field — bots fill hidden 'website_url' field, humans don't."""
    return bool(kw.get('website_url', '').strip())


def _clean_text_line(value, max_len=255):
    text = '' if value is None else str(value)
    text = re.sub(r'[\x00-\x1f\x7f]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:max_len]


def _clean_text_block(value, max_len=2000):
    text = '' if value is None else str(value)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[^\S\n]+', ' ', text)
    text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
    return text[:max_len]


def _clean_email(value, max_len=320):
    email = _clean_text_line(value, max_len=max_len).lower()
    if not email:
        return ''
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return ''
    return email


def _clean_phone(value, max_len=40):
    raw = _clean_text_line(value, max_len=max_len * 2)
    if not raw:
        return ''
    cleaned = re.sub(r'[^0-9+().\-\s]', '', raw).strip()
    return cleaned[:max_len]
