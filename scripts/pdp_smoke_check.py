#!/usr/bin/env python3
"""Lightweight product detail smoke check for QAS/production pages."""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://qas.bader4business.com"
DEFAULT_PATH = "/shop/09070084-compresor-25l-16182"

REQUIRED_HTML_MARKERS = (
    "bader-app-hero-grid",
    "bader-app-trust-grid",
    "bader-app-detail-section",
    "bader-app-faq-section",
    "bader-app-related-section",
    "bader-app-help-cta",
)

SCRIPT_SRC_UNSAFE_INLINE_RE = re.compile(r"(?:^|;)\s*script-src[^;]*'unsafe-inline'", re.IGNORECASE)
SCRIPT_SRC_NONCE_RE = re.compile(r"(?:^|;)\s*script-src[^;]*'nonce-[^']+'", re.IGNORECASE)


class ProductHtmlInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inline_scripts = 0
        self.inline_scripts_without_nonce = 0
        self.title_parts: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()

        if tag == "title":
            self.in_title = True
            return

        if tag != "script":
            return

        src = attr_map.get("src", "").strip()
        if src:
            return

        self.inline_scripts += 1
        if not attr_map.get("nonce", "").strip():
            self.inline_scripts_without_nonce += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title and data.strip():
            self.title_parts.append(data.strip())

    @property
    def title(self) -> str:
        return " ".join(self.title_parts).strip()


def fetch(url: str, timeout: int) -> tuple[int, dict[str, str], str]:
    request = Request(
        url,
        headers={
            "User-Agent": "BaderPdpSmoke/1.0",
            "Accept": "text/html,application/xhtml+xml,*/*",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="ignore")
            return int(response.status), {k.lower(): v for k, v in response.headers.items()}, body
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore") if hasattr(exc, "read") else ""
        return int(exc.code), {k.lower(): v for k, v in (exc.headers or {}).items()}, body
    except URLError as exc:
        raise RuntimeError(f"network error: {exc}") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-check a Bader product detail page.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL to request.")
    parser.add_argument("--path", default=DEFAULT_PATH, help="Relative PDP path to validate.")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    url = urljoin(args.base_url.rstrip("/") + "/", args.path.lstrip("/"))
    status, headers, body = fetch(url, args.timeout)

    failures: list[str] = []
    notes: list[str] = []

    if status != 200:
        failures.append(f"unexpected status={status}")

    csp = headers.get("content-security-policy", "")
    if not csp:
        failures.append("missing Content-Security-Policy header")
    else:
        if SCRIPT_SRC_UNSAFE_INLINE_RE.search(csp):
            failures.append("script-src still contains unsafe-inline")
        if not SCRIPT_SRC_NONCE_RE.search(csp):
            failures.append("script-src is missing nonce")

    parser = ProductHtmlInspector()
    parser.feed(body)

    for marker in REQUIRED_HTML_MARKERS:
        if marker not in body:
            failures.append(f"missing marker: {marker}")

    if parser.inline_scripts_without_nonce:
        failures.append(
            f"found {parser.inline_scripts_without_nonce} inline script(s) without nonce "
            f"out of {parser.inline_scripts} inline script(s)"
        )

    if parser.title:
        notes.append(f"title={parser.title}")
    notes.append(f"inline_scripts={parser.inline_scripts}")

    if failures:
        print(f"FAIL {url}")
        for item in failures:
            print(f" - {item}")
        for note in notes:
            print(f" * {note}")
        return 1

    print(f"OK {url}")
    for note in notes:
        print(f" - {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
