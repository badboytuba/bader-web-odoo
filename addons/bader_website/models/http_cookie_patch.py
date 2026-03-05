# -*- coding: utf-8 -*-
import functools

import odoo.http as odoo_http
from odoo.http import request


_PATCH_ATTR = '_bader_cookie_hardened'


def _is_https_request():
    httprequest = getattr(request, 'httprequest', None)
    if not httprequest:
        return False
    if (getattr(httprequest, 'scheme', '') or '').lower() == 'https':
        return True
    forwarded_proto = (httprequest.headers.get('X-Forwarded-Proto') or '').split(',')[0].strip().lower()
    return forwarded_proto == 'https'


def _deduplicate_cookie_header(headers, cookie_key):
    if not headers or not hasattr(headers, 'getlist') or not hasattr(headers, 'setlist'):
        return
    raw_cookies = headers.getlist('Set-Cookie') or []
    if not raw_cookies:
        return

    cookie_prefix = f'{cookie_key}='.lower()
    filtered = []
    for cookie in raw_cookies:
        first_part = (cookie.split(';', 1)[0] or '').strip().lower()
        if first_part.startswith(cookie_prefix):
            continue
        filtered.append(cookie)
    headers.setlist('Set-Cookie', filtered)


def _deduplicate_all_cookies(headers):
    if not headers or not hasattr(headers, 'getlist') or not hasattr(headers, 'setlist'):
        return
    raw_cookies = headers.getlist('Set-Cookie') or []
    if len(raw_cookies) < 2:
        return

    dedup_reversed = []
    seen_keys = set()
    for cookie in reversed(raw_cookies):
        key = (cookie.split(';', 1)[0].split('=', 1)[0] or '').strip().lower()
        if not key:
            dedup_reversed.append(cookie)
            continue
        if key in seen_keys:
            continue
        seen_keys.add(key)
        dedup_reversed.append(cookie)

    headers.setlist('Set-Cookie', list(reversed(dedup_reversed)))


def _patch_set_cookie(owner):
    if owner is None:
        return
    original = getattr(owner, 'set_cookie', None)
    if not callable(original) or getattr(original, _PATCH_ATTR, False):
        return

    @functools.wraps(original)
    def _wrapped(
        self,
        key,
        value='',
        max_age=None,
        expires=None,
        path='/',
        domain=None,
        secure=False,
        httponly=False,
        samesite=None,
        cookie_type='required',
    ):
        _deduplicate_cookie_header(getattr(self, 'headers', None), key)
        if samesite is None:
            samesite = 'Lax'
        if _is_https_request():
            secure = True
        return original(
            self,
            key,
            value=value,
            max_age=max_age,
            expires=expires,
            path=path,
            domain=domain,
            secure=secure,
            httponly=httponly,
            samesite=samesite,
            cookie_type=cookie_type,
        )

    setattr(_wrapped, _PATCH_ATTR, True)
    setattr(owner, 'set_cookie', _wrapped)


def _patch_inject_future_response():
    request_cls = getattr(odoo_http, 'Request', None)
    if request_cls is None:
        return
    original = getattr(request_cls, '_inject_future_response', None)
    if not callable(original) or getattr(original, _PATCH_ATTR, False):
        return

    @functools.wraps(original)
    def _wrapped(self, response):
        result = original(self, response)
        _deduplicate_all_cookies(getattr(response, 'headers', None))
        return result

    setattr(_wrapped, _PATCH_ATTR, True)
    setattr(request_cls, '_inject_future_response', _wrapped)


_patch_set_cookie(getattr(odoo_http, 'FutureResponse', None))
_patch_set_cookie(getattr(odoo_http, '_Response', None))
_patch_inject_future_response()
