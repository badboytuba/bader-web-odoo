#!/usr/bin/env python3
"""Lightweight product detail smoke check for QAS/production pages."""

from __future__ import annotations

import argparse
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DEFAULT_BASE_URL = os.getenv("WEB_AUDIT_BASE_URL", "https://qas.bader.com.ar").rstrip("/")
DEFAULT_PATH = ""
DEFAULT_PERSONA = "mayorista"

REQUIRED_HTML_MARKERS = (
    "bader-app-hero-grid",
    "bader-app-trust-grid",
    "bader-app-detail-section",
    "bader-app-faq-section",
    "bader-app-related-section",
    "bader-app-help-cta",
)
DISALLOWED_HTML_MARKERS = (
    "bader-app-persona-switch",
    "bader-app-fit-grid",
)
SKU_PREFIX_RE = re.compile(r"^\[[^\]]+\]\s*")
PRODUCT_LINK_RE = re.compile(
    r'href=["\'](/shop/(?!cart|checkout|wishlist|category/|persona/|change_pricelist/)[^"\']*-\d+)["\']',
    re.IGNORECASE,
)

SCRIPT_SRC_UNSAFE_INLINE_RE = re.compile(r"(?:^|;)\s*script-src[^;]*'unsafe-inline'", re.IGNORECASE)
SCRIPT_SRC_NONCE_RE = re.compile(r"(?:^|;)\s*script-src[^;]*'nonce-[^']+'", re.IGNORECASE)
DESCRIPTION_MULTILANG_RE = re.compile(
    r'<div class="bader-app-description-body"[^>]*>.*?(?:ESPAÑOL:|INGL[ÉE]S:|ENGLISH:|PORTUGU[ÉE]S:)',
    re.IGNORECASE | re.DOTALL,
)


class ProductHtmlInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inline_scripts = 0
        self.inline_scripts_without_nonce = 0
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self.in_title = False
        self.in_product_h1 = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()

        if tag == "title":
            self.in_title = True
            return

        class_name = attr_map.get("class", "").strip().lower()
        if (
            tag == "h1"
            and attr_map.get("itemprop", "").strip().lower() == "name"
            and "d-none" not in class_name.split()
        ):
            self.in_product_h1 = True
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
        lowered = tag.lower()
        if lowered == "title":
            self.in_title = False
        elif lowered == "h1":
            self.in_product_h1 = False

    def handle_data(self, data: str) -> None:
        if self.in_title and data.strip():
            self.title_parts.append(data.strip())
        if self.in_product_h1 and data.strip():
            self.h1_parts.append(data.strip())

    @property
    def title(self) -> str:
        return " ".join(self.title_parts).strip()

    @property
    def product_h1(self) -> str:
        return " ".join(self.h1_parts).strip()


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
    parser.add_argument("--path", default=DEFAULT_PATH, help="Relative PDP path to validate. If omitted, auto-discover from /shop.")
    parser.add_argument("--persona", default=DEFAULT_PERSONA, help="Persona key to validate on the persona-specific PDP route.")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds.")
    return parser.parse_args()


def build_persona_path(path: str, persona: str) -> str:
    persona = (persona or "").strip().lower()
    path = (path or "").strip()
    if not persona or not path.startswith("/shop/"):
        return path
    if path.startswith("/shop/persona/"):
        return path
    return "/shop/persona/%s/%s" % (persona, path[len("/shop/"):].lstrip("/"))


def discover_pdp_path(base_url: str, timeout: int) -> str:
    shop_url = urljoin(base_url.rstrip("/") + "/", "shop")
    status, _headers, body = fetch(shop_url, timeout)
    if status != 200:
        raise RuntimeError(f"failed to fetch shop for PDP discovery: status={status}")
    match = PRODUCT_LINK_RE.search(body)
    if not match:
        raise RuntimeError("could not auto-discover a PDP path from /shop")
    return match.group(1)


def main() -> int:
    args = parse_args()
    target_path = (args.path or "").strip() or discover_pdp_path(args.base_url, args.timeout)
    url = urljoin(args.base_url.rstrip("/") + "/", target_path.lstrip("/"))
    persona_path = build_persona_path(target_path, args.persona)
    persona_url = urljoin(args.base_url.rstrip("/") + "/", persona_path.lstrip("/"))
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

    for marker in DISALLOWED_HTML_MARKERS:
        if marker in body:
            failures.append(f"unexpected marker: {marker}")

    if DESCRIPTION_MULTILANG_RE.search(body):
        failures.append("description body still renders multilingual source content")

    if parser.inline_scripts_without_nonce:
        failures.append(
            f"found {parser.inline_scripts_without_nonce} inline script(s) without nonce "
            f"out of {parser.inline_scripts} inline script(s)"
        )

    if parser.title:
        notes.append(f"title={parser.title}")
    if parser.product_h1:
        notes.append(f"h1={parser.product_h1}")
        if SKU_PREFIX_RE.match(parser.product_h1):
            failures.append("product H1 still contains SKU prefix")
    notes.append(f"inline_scripts={parser.inline_scripts}")
    notes.append(f"path={target_path}")

    persona_status, _persona_headers, persona_body = fetch(persona_url, args.timeout)
    if persona_status != 200:
        failures.append(f"unexpected persona status={persona_status}")
    else:
        notes.append(f"persona_route={persona_path}")

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
