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
    parser.add_argument(
        "--second-pass-description-sale",
        action="store_true",
        help="Try a conservative rule-based recovery for skipped description_sale summaries.",
    )
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
import re

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


def sanitize_summary_candidate(text):
    cleaned = sale._pdp_description_plaintext(text or '')
    cleaned = cleaned.replace('·', '. ').replace('•', '. ')
    cleaned = re.sub(r'\\s+', ' ', cleaned).strip(' -:;,.')
    cleaned = re.sub(r'^(?:ref(?:erencia)?|sku|modelo)\\s*[:\\-]\\s*', '', cleaned, flags=re.I)
    cleaned = re.sub(r'^\\[[^\\]]+\\]\\s*', '', cleaned)
    cleaned = re.sub(r'^(?:image|imagen)\\s*\\[[^\\]]+\\]\\s*$', '', cleaned, flags=re.I)
    cleaned = re.sub(r'^(?:ref\\.?\\s*)?[A-Z0-9\\-/]{2,20}\\s*[:\\-]\\s*', '', cleaned)
    cleaned = cleaned.strip(' -:;,.')
    return cleaned


def word_count(text):
    return len([part for part in re.split(r'\\s+', (text or '').strip()) if part])


def prettify_product_name(text):
    value = sanitize_summary_candidate(text)
    if not value:
        return ''
    if value == value.upper():
        value = value.title()
        for source, target in (
            (' De ', ' de '),
            (' Del ', ' del '),
            (' Y ', ' y '),
            (' Con ', ' con '),
            (' Sin ', ' sin '),
            (' Para ', ' para '),
        ):
            value = value.replace(source, target)
    return value


def split_summary_fragments(text):
    plain = sanitize_summary_candidate(text)
    if not plain:
        return []

    fragments = [plain]
    fragments.extend(re.split(r'(?<=[\\.!?])\\s+(?=[A-ZÁÉÍÓÚÜÑ])', plain))
    fragments.extend(re.split(r'\\s+[;·•]\\s+', plain))
    items = []
    for fragment in fragments:
        candidate = sanitize_summary_candidate(fragment)
        if candidate:
            items.append(candidate)
    return items


def summary_quality_score(summary, product_name):
    text = (summary or '').strip()
    issues = summary_quality_issues(text)
    if not text:
        return -999

    score = 100
    score -= len(issues) * 25
    score -= abs(92 - len(text)) * 0.25
    normalized = sale._normalize_pdp_text(text)
    product_token = sale._normalize_pdp_text(product_name or '')
    if product_token and normalized == product_token:
        score -= 35
    if product_token and product_token and product_token in normalized and len(text) < 28:
        score -= 20
    if text[-1:] not in '.!?':
        score -= 6
    return score


def is_commercial_summary_safe(summary, min_len=20, min_words=3):
    text = sanitize_summary_candidate(summary)
    if not text or not is_summary_safe(text):
        return False
    if len(text) < min_len:
        return False
    if word_count(text) < min_words:
        return False
    if not text[:1].isalpha():
        return False

    normalized = sale._normalize_pdp_text(text)
    if any(token in normalized for token in ('rpm', 'kgf', 'kpa', 'image 1')):
        return False
    if any(char in text for char in '[]'):
        return False
    if len(text) >= 70 and text[-1:].isalnum():
        return False
    return True


def best_safe_summary(candidates, product_name, min_len=20, min_words=3):
    unique_candidates = []
    seen = set()
    for raw in candidates:
        candidate = sanitize_summary_candidate(raw)
        token = sale._normalize_pdp_text(candidate)
        if not candidate or not token or token in seen:
            continue
        seen.add(token)
        unique_candidates.append(candidate)

    safe_candidates = [
        candidate for candidate in unique_candidates
        if is_commercial_summary_safe(candidate, min_len=min_len, min_words=min_words)
    ]
    if not safe_candidates:
        return ''

    safe_candidates.sort(key=lambda item: summary_quality_score(item, product_name), reverse=True)
    return safe_candidates[0]


def feature_to_clause(feature):
    candidate = sanitize_summary_candidate(feature)
    if not candidate:
        return ''
    if ':' in candidate and candidate.count(':') == 1:
        left, right = [part.strip() for part in candidate.split(':', 1)]
        if right and len(right) >= 6:
            candidate = right
    candidate = candidate.strip(' -:;,.')
    if not candidate:
        return ''
    token = sale._normalize_pdp_text(candidate)
    if token.startswith(('compatible con', 'incluye', 'ideal para', 'para ')):
        return candidate[0].lower() + candidate[1:] if candidate[:1].isupper() else candidate
    if len(candidate) <= 72 and not any(char in candidate for char in '.!?'):
        return "con %s" % (candidate[0].lower() + candidate[1:] if candidate[:1].isupper() else candidate)
    return candidate


def build_second_pass_summary(product, payload, current_summary):
    product_name = (payload.get('product_name') or product.name or '').strip()
    pretty_product_name = prettify_product_name(product_name)
    paragraphs = list(payload.get('description_paragraphs') or [])

    paragraph_candidates = []
    if current_summary:
        paragraph_candidates.extend(split_summary_fragments(current_summary))
    for paragraph in paragraphs[:3]:
        paragraph_candidates.extend(split_summary_fragments(paragraph))

    best_direct = best_safe_summary(paragraph_candidates, product_name, min_len=42, min_words=6)
    if best_direct:
        return best_direct

    generic_fallback = ''
    label = pretty_product_name or sanitize_summary_candidate(product_name)
    if label and word_count(label) >= 2:
        generic_fallback = "%s para uso odontológico profesional." % label

    return best_safe_summary([generic_fallback], product_name, min_len=34, min_words=5)


stats = {
    'products_scanned': len(products),
    'description_sale_candidates': 0,
    'description_sale_updates': 0,
    'description_sale_skipped_quality': 0,
    'description_sale_second_pass_candidates': 0,
    'description_sale_second_pass_updates': 0,
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
            second_pass_summary = ''
            if options.get('second_pass_description_sale'):
                second_pass_summary = build_second_pass_summary(product, payload, summary_text)
            if second_pass_summary:
                stats['description_sale_second_pass_candidates'] += 1
                if current_sale != second_pass_summary:
                    updates['description_sale'] = second_pass_summary
                    stats['description_sale_second_pass_updates'] += 1
                    summary_text = second_pass_summary
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
        "second_pass_description_sale": bool(args.second_pass_description_sale),
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
