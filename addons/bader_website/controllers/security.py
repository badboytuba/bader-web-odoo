# -*- coding: utf-8 -*-
import json
import logging
import threading
import time
from urllib.parse import urlsplit

from odoo import http
from odoo.http import request

# M10: unified helper
from .helpers import _client_ip


_logger = logging.getLogger(__name__)

_REPORT_MAX_BYTES = 65535
_REPORT_LOG_WINDOW_SECONDS = 60
_REPORT_LOG_MAX_KEYS = 1000
_REPORT_LOG_STATE = {}
_REPORT_LOG_LOCK = threading.Lock()


def _normalize_report_path(url_value):
    cleaned = (url_value or "").strip()
    if not cleaned:
        return ""
    try:
        return (urlsplit(cleaned).path or "").strip()
    except Exception:
        return ""


def _is_noisy_login_report(directive, blocked_uri, document_uri):
    return (
        directive == "script-src-attr"
        and blocked_uri == "inline"
        and _normalize_report_path(document_uri) == "/web/login"
    )


def _cleanup_report_log_state(now_ts):
    if len(_REPORT_LOG_STATE) <= _REPORT_LOG_MAX_KEYS:
        return
    cutoff = now_ts - (_REPORT_LOG_WINDOW_SECONDS * 2)
    stale_keys = [
        key for key, ts in _REPORT_LOG_STATE.items()
        if float(ts or 0.0) < cutoff
    ]
    for key in stale_keys[: max(0, len(_REPORT_LOG_STATE) - _REPORT_LOG_MAX_KEYS)]:
        _REPORT_LOG_STATE.pop(key, None)


def _should_log_report(fingerprint):
    now_ts = time.time()
    with _REPORT_LOG_LOCK:
        _cleanup_report_log_state(now_ts)
        last_seen = float(_REPORT_LOG_STATE.get(fingerprint) or 0.0)
        if now_ts - last_seen < _REPORT_LOG_WINDOW_SECONDS:
            return False
        _REPORT_LOG_STATE[fingerprint] = now_ts
        return True


class BaderSecurityController(http.Controller):
    """Security telemetry endpoints."""

    @http.route('/bader/csp-report', type='http', auth='public', methods=['POST'], csrf=False, sitemap=False)
    def bader_csp_report(self, **kwargs):
        httprequest = getattr(request, 'httprequest', None)
        if not httprequest:
            return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)

        raw_body = httprequest.get_data(cache=False, as_text=True) or ''
        if not raw_body or len(raw_body) > _REPORT_MAX_BYTES:
            return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)

        try:
            payload = json.loads(raw_body)
        except Exception:
            return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)

        if not isinstance(payload, dict):
            return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)

        report = payload.get('csp-report') or payload.get('body') or payload
        if not isinstance(report, dict):
            return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)

        directive = str(report.get('effective-directive') or report.get('violated-directive') or 'unknown')[:120]
        blocked_uri = str(report.get('blocked-uri') or 'unknown')[:220]
        document_uri = str(report.get('document-uri') or 'unknown')[:220]
        source_file = str(report.get('source-file') or 'unknown')[:220]
        disposition = str(report.get('disposition') or 'unknown')[:60]
        line_number = str(report.get('line-number') or report.get('lineNumber') or '')[:20]
        column_number = str(report.get('column-number') or report.get('columnNumber') or '')[:20]
        script_sample = str(report.get('script-sample') or report.get('sample') or '')[:200]
        fingerprint = '|'.join([_client_ip(), directive, blocked_uri, document_uri])

        # Native Odoo login still emits inline script-attribute reports in report-only mode.
        # They are expected on this route and only add log noise.
        if _is_noisy_login_report(directive, blocked_uri, document_uri):
            return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)

        if _should_log_report(fingerprint):
            _logger.warning(
                "CSP report ip=%s directive=%s blocked=%s document=%s source=%s line=%s col=%s sample=%s disposition=%s",
                _client_ip(),
                directive,
                blocked_uri,
                document_uri,
                source_file,
                line_number or '-',
                column_number or '-',
                script_sample or '-',
                disposition,
            )

        return request.make_response('', [('Content-Type', 'text/plain; charset=utf-8')], status=204)
