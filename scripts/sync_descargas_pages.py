#!/usr/bin/env python3
"""Sync page counts for /descargas catalogs in bader_website controller.

This script reads local PDF files from:
  addons/bader_website/static/src/pdf/descargas

Then updates the 'pages' values inside:
  addons/bader_website/controllers/main.py -> _descargas_catalogs()

Usage:
  python scripts/sync_descargas_pages.py --check
  python scripts/sync_descargas_pages.py --write
"""

from __future__ import annotations

import argparse
import ast
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
CONTROLLER_FILE = ROOT / "addons" / "bader_website" / "controllers" / "main.py"
PDF_DIR = ROOT / "addons" / "bader_website" / "static" / "src" / "pdf" / "descargas"


def _pdf_reader_cls():
    try:
        from pypdf import PdfReader  # type: ignore
        return PdfReader
    except Exception:
        pass

    try:
        from PyPDF2 import PdfReader  # type: ignore
        return PdfReader
    except Exception as exc:
        raise RuntimeError(
            "Missing PDF reader dependency. Install 'pypdf' or 'PyPDF2'."
        ) from exc


def _count_pdf_pages(pdf_path: Path) -> int:
    reader_cls = _pdf_reader_cls()
    reader = reader_cls(str(pdf_path))
    return len(reader.pages)


def _node_str_constant(node: ast.AST) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    raise ValueError("Expected string constant node")


def _find_descargas_return_list(tree: ast.Module) -> ast.List:
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or node.name != "BaderWebsite":
            continue
        for item in node.body:
            if not isinstance(item, ast.FunctionDef) or item.name != "_descargas_catalogs":
                continue
            for stmt in item.body:
                if isinstance(stmt, ast.Return) and isinstance(stmt.value, ast.List):
                    return stmt.value
    raise RuntimeError("Could not find BaderWebsite._descargas_catalogs return list")


def _collect_updates(source_text: str) -> List[Tuple[ast.Constant, str, str, str]]:
    """Return list of (pages_node, old_pages, new_pages, pdf_name)."""
    tree = ast.parse(source_text)
    catalog_list = _find_descargas_return_list(tree)
    updates: List[Tuple[ast.Constant, str, str, str]] = []

    for elem in catalog_list.elts:
        if not isinstance(elem, ast.Dict):
            continue

        fields: Dict[str, ast.AST] = {}
        for key_node, value_node in zip(elem.keys, elem.values):
            if key_node is None:
                continue
            if isinstance(key_node, ast.Constant) and isinstance(key_node.value, str):
                fields[key_node.value] = value_node

        if "download_url" not in fields or "pages" not in fields:
            continue

        download_url = _node_str_constant(fields["download_url"])
        pages_node = fields["pages"]
        if not isinstance(pages_node, ast.Constant) or not isinstance(pages_node.value, str):
            continue

        pdf_name = Path(download_url).name
        pdf_path = PDF_DIR / pdf_name
        if not pdf_path.exists():
            raise RuntimeError(f"PDF not found for catalog metadata: {pdf_path}")

        page_count = _count_pdf_pages(pdf_path)
        new_pages = str(page_count)
        old_pages = pages_node.value

        if old_pages != new_pages:
            updates.append((pages_node, old_pages, new_pages, pdf_name))

    return updates


def _apply_updates(source_text: str, updates: List[Tuple[ast.Constant, str, str, str]]) -> str:
    lines = source_text.splitlines(keepends=True)
    for pages_node, _old, new, _pdf in sorted(
        updates,
        key=lambda item: (item[0].lineno, item[0].col_offset),
        reverse=True,
    ):
        if pages_node.lineno is None or pages_node.end_lineno is None:
            raise RuntimeError("AST node is missing line information")
        if pages_node.lineno != pages_node.end_lineno:
            raise RuntimeError("Unexpected multiline string constant for pages value")
        if pages_node.end_col_offset is None:
            raise RuntimeError("AST node is missing end column information")

        row_idx = pages_node.lineno - 1
        line = lines[row_idx]
        replacement = f"'{new}'"
        lines[row_idx] = line[: pages_node.col_offset] + replacement + line[pages_node.end_col_offset :]

    return "".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync descargas PDF page counts")
    parser.add_argument("--check", action="store_true", help="check only, do not write")
    parser.add_argument("--write", action="store_true", help="apply updates to controller file")
    args = parser.parse_args()

    if args.check and args.write:
        print("ERROR: use either --check or --write, not both")
        return 2

    mode_write = bool(args.write)
    if not args.check and not args.write:
        # Default to check mode for safety.
        mode_write = False

    source_text = CONTROLLER_FILE.read_text(encoding="utf-8")
    updates = _collect_updates(source_text)

    if not updates:
        print("Descargas page counts are already up to date.")
        return 0

    print("Page count updates:")
    for _node, old, new, pdf_name in updates:
        print(f"  - {pdf_name}: {old} -> {new}")

    if not mode_write:
        print("Check mode: no files changed.")
        return 1

    updated_text = _apply_updates(source_text, updates)
    CONTROLLER_FILE.write_text(updated_text, encoding="utf-8")
    print(f"Updated {CONTROLLER_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

