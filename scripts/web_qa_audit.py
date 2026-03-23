#!/usr/bin/env python3
"""Website QA audit for Odoo frontend pages.

Checks:
  - HTTP availability and response time
  - Basic functional marker per page
  - Security response headers

Usage:
  python scripts/web_qa_audit.py
  python scripts/web_qa_audit.py --base-url https://qas.bader.com.ar
  python scripts/web_qa_audit.py --timeout 20 --perf-warn-ms 1400 --perf-fail-ms 2600
"""

from __future__ import annotations

import argparse
import os
import re
import statistics
import sys
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
MENU_XML_PATH = ROOT / "addons" / "bader_website" / "data" / "website_menu.xml"


load_dotenv(ENV_PATH)


DEFAULT_BASE_URL = os.getenv("WEB_AUDIT_BASE_URL", "https://qas.bader.com.ar").rstrip("/")
DEFAULT_TIMEOUT = 15

# Functional markers are intentionally lightweight: they detect severe template/render regressions.
FUNCTIONAL_MARKERS: Dict[str, str] = {
    "/": "BADER",
    "/productos": "productos",
    "/sobre-nosotros": "bader",
    "/ser-distribuidor": "distribuidor",
    "/servicios": "servicios",
}

REQUIRED_SECURITY_HEADERS = (
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "referrer-policy",
    "permissions-policy",
)

RECOMMENDED_SECURITY_HEADERS = (
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "content-security-policy-report-only",
    "reporting-endpoints",
)

DEFAULT_EXTRA_PATHS = (
    "/shop",
    "/shop/cart",
    "/shop/checkout",
    "/terminos",
    "/privacidad",
    "/cookies",
)

DEFAULT_FORBIDDEN_DOMAINS = tuple(
    d.strip().lower()
    for d in os.getenv("WEB_AUDIT_FORBIDDEN_DOMAINS", "shop.bader.com.ar").split(",")
    if d.strip()
)


@dataclass
class PageResult:
    path: str
    url: str
    status: int
    elapsed_ms: int
    size_kb: float
    ok: bool
    warning: str
    error: str
    marker: str


class HTMLSignalsParser(HTMLParser):
    """Extract lightweight HTML quality/security/performance signals."""

    def __init__(self) -> None:
        super().__init__()
        self.title_text: List[str] = []
        self.in_title = False
        self.meta_description = ""
        self.meta_viewport = ""
        self.html_lang = ""
        self.canonical_href = ""
        self.link_hrefs: List[str] = []
        self.stylesheet_hrefs: List[str] = []
        self.script_srcs: List[str] = []
        self.form_actions: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        tag = tag.lower()

        if tag == "html":
            self.html_lang = attr_map.get("lang", "").strip()
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = attr_map.get("name", "").strip().lower()
            content = attr_map.get("content", "").strip()
            if name == "description" and content:
                self.meta_description = content
            elif name == "viewport" and content:
                self.meta_viewport = content
        elif tag == "link":
            href = attr_map.get("href", "").strip()
            rel = attr_map.get("rel", "").strip().lower()
            if href:
                self.link_hrefs.append(href)
            if href and "canonical" in rel:
                self.canonical_href = href
            if href and "stylesheet" in rel:
                self.stylesheet_hrefs.append(href)
        elif tag == "script":
            src = attr_map.get("src", "").strip()
            if src:
                self.script_srcs.append(src)
        elif tag == "form":
            action = attr_map.get("action", "").strip()
            if action:
                self.form_actions.append(action)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title and data:
            self.title_text.append(data.strip())

    @property
    def title(self) -> str:
        return " ".join(part for part in self.title_text if part).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit frontend website health/performance/security.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL to audit.")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout in seconds.")
    parser.add_argument("--perf-warn-ms", type=int, default=1200, help="Warn threshold for response time.")
    parser.add_argument("--perf-fail-ms", type=int, default=2500, help="Fail threshold for response time.")
    parser.add_argument(
        "--path",
        action="append",
        default=[],
        help="Extra relative path to audit. Repeat for multiple paths.",
    )
    parser.add_argument(
        "--forbidden-domain",
        action="append",
        default=[],
        help="Domain that must never appear in page links (repeatable).",
    )
    parser.add_argument(
        "--resource-probe-limit",
        type=int,
        default=4,
        help="How many CSS/JS resources to probe per page (0 disables).",
    )
    return parser.parse_args()


def normalize_path(path: str) -> str:
    value = (path or "").strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        value = parsed.path or "/"
        if parsed.query:
            value += "?" + parsed.query
    if not value.startswith("/"):
        value = "/" + value
    return value


def load_menu_paths() -> List[str]:
    if not MENU_XML_PATH.is_file():
        return []
    paths: List[str] = []
    try:
        root = ET.parse(MENU_XML_PATH).getroot()
    except ET.ParseError:
        return []
    for field in root.findall(".//field[@name='url']"):
        if field.text:
            path = normalize_path(field.text)
            if path:
                paths.append(path)
    return paths


def dedupe_preserve(items: Iterable[str]) -> List[str]:
    seen = set()
    result: List[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def build_audit_paths(extra_paths: Iterable[str]) -> List[str]:
    paths = ["/"]
    paths.extend(load_menu_paths())
    paths.extend(DEFAULT_EXTRA_PATHS)
    paths.extend(normalize_path(p) for p in extra_paths if normalize_path(p))
    return dedupe_preserve(paths)


def fetch_url(url: str, timeout: int) -> Tuple[int, Dict[str, str], bytes, str, int]:
    start = time.perf_counter()
    req = Request(
        url=url,
        headers={
            "User-Agent": "BaderWebAudit/1.0",
            "Accept": "text/html,application/xhtml+xml,*/*",
        },
    )
    try:
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            headers = {k.lower(): v for k, v in resp.headers.items()}
            final_url = resp.geturl()
            return int(resp.status), headers, body, final_url, elapsed_ms
    except HTTPError as exc:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        headers = {k.lower(): v for k, v in exc.headers.items()} if exc.headers else {}
        body = exc.read() if hasattr(exc, "read") else b""
        return int(exc.code), headers, body, url, elapsed_ms


def probe_status(url: str, timeout: int) -> Tuple[int, str]:
    req = Request(url=url, headers={"User-Agent": "BaderWebAudit/1.0", "Accept": "*/*"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            # Read a small chunk to ensure response body starts correctly.
            resp.read(2048)
            return int(resp.status), resp.geturl()
    except HTTPError as exc:
        return int(exc.code), url


def parse_html_signals(body: bytes) -> HTMLSignalsParser:
    parser = HTMLSignalsParser()
    html = body.decode("utf-8", errors="ignore")
    parser.feed(html)
    return parser


def host_from_url(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def get_csp_directive_value(csp_value: str, directive: str) -> str:
    for chunk in (csp_value or "").split(";"):
        normalized = chunk.strip()
        if normalized.lower().startswith(directive.lower() + " "):
            return normalized
    return ""


def is_forbidden_link(url: str, forbidden_domains: Tuple[str, ...]) -> bool:
    host = host_from_url(url)
    if not host:
        return False
    for blocked in forbidden_domains:
        if host == blocked or host.endswith("." + blocked):
            return True
    return False


def build_quality_warnings(
    parser: HTMLSignalsParser,
    page_url: str,
    base_url: str,
    forbidden_domains: Tuple[str, ...],
) -> List[str]:
    warnings: List[str] = []
    title = parser.title
    if not title:
        warnings.append("missing <title>")
    elif len(title) < 8:
        warnings.append("short <title>")

    if not parser.meta_viewport:
        warnings.append("missing viewport meta")

    if not parser.html_lang:
        warnings.append("missing html lang")

    if parser.meta_description and len(parser.meta_description) < 40:
        warnings.append("short meta description")
    if not parser.meta_description:
        warnings.append("missing meta description")

    if parser.canonical_href:
        canonical_abs = urljoin(page_url, parser.canonical_href)
        canonical_host = host_from_url(canonical_abs)
        base_host = host_from_url(base_url)
        if canonical_host and canonical_host != base_host:
            warnings.append("canonical points to another domain")
    else:
        warnings.append("missing canonical")

    all_urls = [urljoin(page_url, ref) for ref in parser.link_hrefs + parser.form_actions]
    forbidden_hits = [u for u in all_urls if is_forbidden_link(u, forbidden_domains)]
    if forbidden_hits:
        warnings.append("forbidden domain link found")

    return warnings


def check_marker(path: str, body: bytes) -> Tuple[bool, str]:
    marker = FUNCTIONAL_MARKERS.get(path, "")
    if not marker:
        return True, ""
    content = body.decode("utf-8", errors="ignore").lower()
    ok = marker.lower() in content
    return ok, marker


def audit_pages(
    base_url: str,
    paths: Iterable[str],
    timeout: int,
    perf_warn_ms: int,
    perf_fail_ms: int,
    forbidden_domains: Tuple[str, ...],
    resource_probe_limit: int,
) -> Tuple[List[PageResult], Dict[str, str], List[str], List[str]]:
    page_results: List[PageResult] = []
    baseline_headers: Dict[str, str] = {}
    required_missing: List[str] = []
    recommended_missing: List[str] = []
    resource_cache: Dict[str, int] = {}

    for idx, path in enumerate(paths):
        url = urljoin(base_url + "/", path.lstrip("/"))
        try:
            status, headers, body, final_url, elapsed_ms = fetch_url(url, timeout=timeout)
        except URLError as exc:
            page_results.append(
                PageResult(
                    path=path,
                    url=url,
                    status=0,
                    elapsed_ms=0,
                    size_kb=0.0,
                    ok=False,
                    warning="",
                    error=f"network error: {exc}",
                    marker="",
                )
            )
            continue

        missing_required = [h for h in REQUIRED_SECURITY_HEADERS if h not in headers]
        missing_recommended = [h for h in RECOMMENDED_SECURITY_HEADERS if h not in headers]
        csp_value = headers.get("content-security-policy", "").lower()
        script_src_value = get_csp_directive_value(csp_value, "script-src")
        csp_weak_flags: List[str] = []
        if "'unsafe-inline'" in script_src_value:
            csp_weak_flags.append("script-src unsafe-inline")
        if "'unsafe-eval'" in script_src_value:
            csp_weak_flags.append("script-src unsafe-eval")

        if idx == 0:
            baseline_headers = headers
            required_missing = list(missing_required)
            recommended_missing = list(missing_recommended)

        size_kb = round(len(body) / 1024.0, 1)
        marker_ok, marker = check_marker(path, body)

        ok = True
        warning = ""
        error = ""

        if status < 200 or status >= 400:
            ok = False
            error = f"status={status}"
        elif missing_required:
            ok = False
            error = "missing security headers: " + ", ".join(missing_required)
        elif elapsed_ms >= perf_fail_ms:
            ok = False
            error = f"slow response ({elapsed_ms}ms >= {perf_fail_ms}ms)"
        elif elapsed_ms >= perf_warn_ms:
            warning = f"slow response ({elapsed_ms}ms >= {perf_warn_ms}ms)"

        if ok and missing_recommended:
            warning = (warning + "; " if warning else "") + "recommended security headers missing: " + ", ".join(missing_recommended)
        if ok and csp_weak_flags:
            warning = (warning + "; " if warning else "") + "CSP contains " + ", ".join(csp_weak_flags)

        if ok and not marker_ok:
            ok = False
            error = f"marker not found: '{marker}'"

        quality_warnings: List[str] = []
        resource_failures: List[str] = []
        if status >= 200 and status < 400 and body:
            signals = parse_html_signals(body)
            quality_warnings = build_quality_warnings(
                parser=signals,
                page_url=final_url,
                base_url=base_url,
                forbidden_domains=forbidden_domains,
            )
            if "forbidden domain link found" in quality_warnings and ok:
                ok = False
                error = "forbidden domain link found"

            if resource_probe_limit > 0:
                resource_urls: List[str] = []
                for ref in signals.stylesheet_hrefs + signals.script_srcs:
                    abs_url = urljoin(final_url, ref)
                    if abs_url not in resource_urls:
                        resource_urls.append(abs_url)
                for resource_url in resource_urls[:resource_probe_limit]:
                    if resource_url in resource_cache:
                        resource_status = resource_cache[resource_url]
                    else:
                        try:
                            resource_status, _ = probe_status(resource_url, timeout=timeout)
                        except URLError:
                            resource_status = 0
                        resource_cache[resource_url] = resource_status
                    if resource_status < 200 or resource_status >= 400:
                        resource_failures.append(f"{resource_status} {resource_url}")
            if resource_failures and ok:
                ok = False
                error = "asset load failure: " + "; ".join(resource_failures[:2])

        if ok and quality_warnings:
            warning = (warning + "; " if warning else "") + "; ".join(quality_warnings)

        page_results.append(
            PageResult(
                path=path,
                url=final_url,
                status=status,
                elapsed_ms=elapsed_ms,
                size_kb=size_kb,
                ok=ok,
                warning=warning,
                error=error,
                marker=marker,
            )
        )

    return page_results, baseline_headers, required_missing, recommended_missing


def print_report(
    base_url: str,
    page_results: List[PageResult],
    baseline_headers: Dict[str, str],
    required_missing: List[str],
    recommended_missing: List[str],
) -> int:
    print("=" * 88)
    print(f"WEB QA AUDIT :: {base_url}")
    print("=" * 88)
    print("PATH".ljust(30), "STATUS".ljust(8), "TIME(ms)".ljust(10), "SIZE(KB)".ljust(10), "RESULT")
    print("-" * 88)

    fail_count = 0
    warn_count = 0
    times = []

    for item in page_results:
        times.append(item.elapsed_ms)
        if item.ok and not item.warning:
            result = "OK"
        elif item.ok and item.warning:
            result = f"WARN: {item.warning}"
            warn_count += 1
        else:
            result = f"FAIL: {item.error}"
            fail_count += 1

        print(
            item.path.ljust(30),
            str(item.status).ljust(8),
            str(item.elapsed_ms).ljust(10),
            str(item.size_kb).ljust(10),
            result,
        )

    print("-" * 88)
    if times:
        print(
            "Latency summary:",
            f"min={min(times)}ms",
            f"median={int(statistics.median(times))}ms",
            f"max={max(times)}ms",
        )
    print(f"Pages: {len(page_results)} | Failures: {fail_count} | Warnings: {warn_count}")

    print("\nSecurity headers (baseline page):")
    for header in REQUIRED_SECURITY_HEADERS:
        if header in baseline_headers:
            print(f"  [OK]   {header}: {baseline_headers[header]}")
        else:
            print(f"  [FAIL] {header}: missing")
    for header in RECOMMENDED_SECURITY_HEADERS:
        if header in baseline_headers:
            print(f"  [OK]   {header}: {baseline_headers[header]}")
        else:
            print(f"  [WARN] {header}: missing")

    if required_missing:
        print("\nSecurity verdict: FAIL (missing required headers)")
    elif fail_count:
        print("\nFunctional/performance verdict: FAIL")
    elif warn_count or recommended_missing:
        print("\nFunctional/performance/security verdict: WARN")
    else:
        print("\nFunctional/performance/security verdict: PASS")

    if required_missing:
        return 2
    if fail_count:
        return 1
    return 0


def main() -> None:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    forbidden_domains = tuple(
        d.strip().lower()
        for d in (list(DEFAULT_FORBIDDEN_DOMAINS) + list(args.forbidden_domain))
        if d and d.strip()
    )
    paths = build_audit_paths(args.path)
    page_results, baseline_headers, required_missing, recommended_missing = audit_pages(
        base_url=base_url,
        paths=paths,
        timeout=args.timeout,
        perf_warn_ms=args.perf_warn_ms,
        perf_fail_ms=args.perf_fail_ms,
        forbidden_domains=forbidden_domains,
        resource_probe_limit=max(0, int(args.resource_probe_limit)),
    )
    exit_code = print_report(
        base_url=base_url,
        page_results=page_results,
        baseline_headers=baseline_headers,
        required_missing=required_missing,
        recommended_missing=recommended_missing,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
