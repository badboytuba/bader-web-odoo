#!/usr/bin/env python3
"""Sync Bader-AR download PDFs into the Odoo module static folder."""

import argparse
from pathlib import Path
import subprocess
import sys
from urllib.request import urlopen


FILES = [
    (
        "https://bader.es/wp-content/uploads/2024/08/Catalogo-general-BADER-ES.pdf",
        "catalogo-general-bader-es.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/08/Catalogo-Fantasia-Dental-2023-ES.pdf",
        "catalogo-fantasia-dental-2023-es.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/10/Catalogo-Equipos-Dentales-Bader-Europe-Group.pdf",
        "catalogo-equipos-dentales-bader-europe-group.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/08/Catalogo-tipodontos-y-fantomas-2023-ES.pdf",
        "catalogo-tipodontos-y-fantomas-2023-es.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/08/Folleto-Endodoncia-2019-ES.pdf",
        "folleto-endodoncia-2019-es.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/08/folleto-fresas-BADER-1.pdf",
        "folleto-fresas-bader-1.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/08/catalago-muebles-clinica-dental.pdf",
        "catalago-muebles-clinica-dental.pdf",
    ),
    (
        "https://bader.es/wp-content/uploads/2024/08/CATALOGO-INSTRUMENTAL-ES.pdf",
        "catalogo-instrumental-es.pdf",
    ),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync /descargas PDFs from Bader source")
    parser.add_argument(
        "--skip-page-sync",
        action="store_true",
        help="skip running scripts/sync_descargas_pages.py after download",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    out_dir = root / "addons" / "bader_website" / "static" / "src" / "pdf" / "descargas"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Output directory: {out_dir}")
    for url, filename in FILES:
        target = out_dir / filename
        print(f"Downloading {filename}...")
        with urlopen(url) as response:
            data = response.read()
        target.write_bytes(data)
        print(f"Saved {filename} ({len(data)} bytes)")

    sync_pages_script = root / "scripts" / "sync_descargas_pages.py"
    if sync_pages_script.is_file() and not args.skip_page_sync:
        print("Syncing PDF page counts in controller metadata...")
        subprocess.run([sys.executable, str(sync_pages_script), "--write"], check=True)

    print("Done.")


if __name__ == "__main__":
    main()
