#!/usr/bin/env python3
"""Audit and normalize website product copy directly in Odoo."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

import paramiko
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)

HOST = os.getenv("DEPLOY_HOST", "").strip()
PORT = int(os.getenv("DEPLOY_PORT", "22").strip())
USER = os.getenv("DEPLOY_USER", "").strip()
PASSWORD = os.getenv("DEPLOY_PASSWORD", "").strip()

GENERIC_SUMMARY = (
    "Producto profesional Bader con respaldo oficial, envio coordinado y "
    "soporte tecnico especializado."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize website product copy on the Odoo server.")
    parser.add_argument("--sku", help="Restrict normalization to one default_code/SKU.")
    parser.add_argument("--limit", type=int, default=0, help="Limit the number of products processed.")
    parser.add_argument("--sample-size", type=int, default=12, help="How many sample products to print.")
    parser.add_argument("--include-unpublished", action="store_true", help="Include unpublished products.")
    parser.add_argument("--skip-description-sale", action="store_true", help="Do not fill description_sale.")
    parser.add_argument("--skip-website-description", action="store_true", help="Do not normalize website_description.")
    parser.add_argument("--write", action="store_true", help="Apply changes instead of running a dry audit.")
    parser.add_argument("--export-review-csv", help="Write the pending manual-review queue to a local CSV file.")
    parser.add_argument("--export-review-json", help="Write the pending manual-review queue to a local JSON file.")
    return parser.parse_args()


def ensure_env() -> None:
    missing = [
        name for name, value in (
            ("DEPLOY_HOST", HOST),
            ("DEPLOY_USER", USER),
            ("DEPLOY_PASSWORD", PASSWORD),
        ) if not value
    ]
    if missing:
        raise RuntimeError("Missing deploy environment variables: %s" % ", ".join(missing))


def remote_code(options: dict[str, object]) -> str:
    options_json = json.dumps(options)
    template = """sudo -u odoo /opt/odoo/.venv/bin/python /opt/odoo/src/odoo/odoo-bin shell -c /opt/odoo/conf/odoo-server.conf -d bader --no-http <<'PY'
import html
import json

from odoo.addons.bader_website.controllers.main import BaderWebsiteSale


GENERIC_SUMMARY = __GENERIC_SUMMARY__
options = json.loads(__OPTIONS_JSON__)
sale = BaderWebsiteSale()

domain = [('sale_ok', '=', True)]
if not options.get('include_unpublished'):
    domain.append(('website_published', '=', True))
if options.get('sku'):
    domain.append(('default_code', '=', options['sku']))

products = env['product.template'].sudo().search(
    domain,
    limit=(int(options.get('limit') or 0) or None),
    order='id asc',
)


def has_language_markers(raw_html):
    plain = sale._pdp_description_plaintext(raw_html or '')
    for raw_line in plain.split('\\n'):
        if sale._pdp_detect_language_marker(raw_line):
            return True
    return False


def build_clean_html(payload):
    paragraphs = payload.get('description_paragraphs') or []
    feature_points = payload.get('feature_points') or []
    if not paragraphs and not feature_points:
        return ''

    parts = []
    for paragraph in paragraphs:
        parts.append('<p>%s</p>' % html.escape(paragraph))
    if feature_points:
        parts.append('<p><strong>Caracteristicas destacadas</strong></p>')
        parts.append('<ul>')
        for point in feature_points:
            parts.append('<li>%s</li>' % html.escape(point))
        parts.append('</ul>')
    return ''.join(parts)


def is_summary_safe(summary):
    text = (summary or '').strip()
    if not text or text == GENERIC_SUMMARY:
        return False
    if len(text) < 20 or len(text) > 180:
        return False
    if text[:1].isdigit():
        return False
    if text.endswith('...') or text.count(':') > 1:
        return False

    normalized = sale._normalize_pdp_text(text)
    if any(flag in normalized for flag in ('caca', 'lorem', 'test')):
        return False

    digit_count = sum(1 for char in text if char.isdigit())
    letter_count = sum(1 for char in text if char.isalpha())
    if digit_count and letter_count and digit_count > (letter_count * 0.35):
        return False
    return True


def summary_quality_issues(summary):
    text = (summary or '').strip()
    issues = []
    if not text:
        issues.append('empty')
        return issues
    if text == GENERIC_SUMMARY:
        issues.append('generic_fallback')
    if len(text) < 20:
        issues.append('too_short')
    if len(text) > 180:
        issues.append('too_long')
    if text[:1].isdigit():
        issues.append('starts_with_digit')
    if text.endswith('...'):
        issues.append('truncated')
    if text.count(':') > 1:
        issues.append('too_many_colons')

    normalized = sale._normalize_pdp_text(text)
    for flag in ('caca', 'lorem', 'test'):
        if flag in normalized:
            issues.append('blocked_token_%s' % flag)

    digit_count = sum(1 for char in text if char.isdigit())
    letter_count = sum(1 for char in text if char.isalpha())
    if digit_count and letter_count and digit_count > (letter_count * 0.35):
        issues.append('digit_heavy')
    return issues


stats = {
    'products_scanned': len(products),
    'description_sale_candidates': 0,
    'description_sale_updates': 0,
    'description_sale_skipped_quality': 0,
    'website_description_candidates': 0,
    'website_description_updates': 0,
    'products_changed': 0,
    'products_without_real_copy': 0,
}
samples = []
review_queue = []

for product in products:
    payload = sale._build_pdp_content_payload(product)
    summary_text = (payload.get('summary_text') or '').strip()
    clean_html = build_clean_html(payload)
    source_html = product.website_description or ''
    current_sale = (product.description_sale or '').strip()
    current_web = (source_html or '').strip()
    has_real_copy = bool((payload.get('description_paragraphs') or []) or (payload.get('feature_points') or []))
    multilingual = has_language_markers(source_html)
    updates = {}

    if not has_real_copy:
        stats['products_without_real_copy'] += 1
        review_queue.append({
            'id': product.id,
            'sku': product.default_code or '',
            'name': product.name or '',
            'reason': 'missing_copy',
            'quality_issues': [],
            'current_description_sale': current_sale[:220],
            'suggested_summary': '',
            'source_preview': sale._pdp_description_plaintext(source_html or product.description or '')[:280],
        })

    if (
        options.get('fill_description_sale')
        and has_real_copy
        and summary_text
        and (not current_sale or current_sale == (product.name or '').strip())
    ):
        quality_issues = summary_quality_issues(summary_text)
        if is_summary_safe(summary_text):
            stats['description_sale_candidates'] += 1
            if current_sale != summary_text:
                updates['description_sale'] = summary_text
        else:
            stats['description_sale_skipped_quality'] += 1
            review_queue.append({
                'id': product.id,
                'sku': product.default_code or '',
                'name': product.name or '',
                'reason': 'skipped_quality',
                'quality_issues': quality_issues,
                'current_description_sale': current_sale[:220],
                'suggested_summary': summary_text[:220],
                'source_preview': ((payload.get('description_paragraphs') or [''])[0])[:280],
            })

    if (
        options.get('normalize_website_description')
        and clean_html
        and (multilingual or not current_web)
    ):
        stats['website_description_candidates'] += 1
        if current_web != clean_html:
            updates['website_description'] = clean_html

    if updates:
        stats['products_changed'] += 1
        if 'description_sale' in updates:
            stats['description_sale_updates'] += 1
        if 'website_description' in updates:
            stats['website_description_updates'] += 1
        if options.get('write'):
            product.write(updates)
        if len(samples) < int(options.get('sample_size') or 12):
            samples.append({
                'id': product.id,
                'sku': product.default_code or '',
                'name': product.name or '',
                'updated_fields': sorted(updates.keys()),
                'summary_preview': summary_text[:180],
            })

if options.get('write'):
    env.cr.commit()

print(json.dumps({
    'mode': 'write' if options.get('write') else 'dry-run',
    'stats': stats,
    'samples': samples,
    'review_queue': review_queue,
}, ensure_ascii=False, indent=2))
PY"""
    return (
        template
        .replace("__GENERIC_SUMMARY__", repr(GENERIC_SUMMARY))
        .replace("__OPTIONS_JSON__", repr(options_json))
    )


def run_remote(options: dict[str, object]) -> tuple[str, str, int]:
    ensure_env()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
        stdin, stdout, stderr = client.exec_command(remote_code(options), timeout=1800)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        return out, err, int(exit_code)
    finally:
        client.close()


def write_review_reports(payload: dict[str, object], csv_path: str | None, json_path: str | None) -> None:
    review_queue = list(payload.get("review_queue") or [])
    if json_path:
        target = ROOT / json_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(review_queue, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if csv_path:
        target = ROOT / csv_path
        target.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "id",
            "sku",
            "name",
            "reason",
            "quality_issues",
            "current_description_sale",
            "suggested_summary",
            "source_preview",
        ]
        with target.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in review_queue:
                normalized_row = dict(row)
                normalized_row["quality_issues"] = "|".join(row.get("quality_issues") or [])
                writer.writerow({key: normalized_row.get(key, "") for key in fieldnames})


def emit_text(text: str, stream) -> None:
    encoding = getattr(stream, "encoding", None) or "utf-8"
    stream.write(text.encode(encoding, errors="replace").decode(encoding))
    stream.write("\n")


def main() -> int:
    args = parse_args()
    options = {
        "sku": (args.sku or "").strip(),
        "limit": int(args.limit or 0),
        "sample_size": int(args.sample_size or 12),
        "include_unpublished": bool(args.include_unpublished),
        "fill_description_sale": not args.skip_description_sale,
        "normalize_website_description": not args.skip_website_description,
        "write": bool(args.write),
    }
    out, err, code = run_remote(options)
    payload = None
    if out.strip():
        payload = json.loads(out)
        write_review_reports(payload, args.export_review_csv, args.export_review_json)
    if out.strip():
        emit_text(out.strip(), sys.stdout)
    if err.strip():
        emit_text(err.strip(), sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())
