#!/usr/bin/env python3
"""Summarize CSP reports from remote Odoo logs.

Usage:
  python scripts/csp_report_summary.py
  python scripts/csp_report_summary.py --tail 500
  python scripts/csp_report_summary.py --contains eval
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

import paramiko
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

HOST = os.getenv("DEPLOY_HOST")
PORT = int(os.getenv("DEPLOY_PORT", 22))
USER = os.getenv("DEPLOY_USER")
PASSWORD = os.getenv("DEPLOY_PASSWORD")
LOG_PATH = "/var/log/odoo/odoo.log"


def ensure_env() -> None:
    missing = [
        name
        for name, value in [
            ("DEPLOY_HOST", HOST),
            ("DEPLOY_USER", USER),
            ("DEPLOY_PASSWORD", PASSWORD),
        ]
        if not value
    ]
    if missing:
        print("ERROR: missing env vars: %s" % ", ".join(missing))
        sys.exit(1)


def ssh_exec(command: str, timeout: int = 40) -> tuple[str, str, int]:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
        _stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        return out, err, code
    finally:
        client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize CSP report lines from remote Odoo logs.")
    parser.add_argument("--tail", type=int, default=400, help="How many latest CSP lines to fetch.")
    parser.add_argument("--contains", type=str, default="", help="Optional case-insensitive text filter.")
    return parser.parse_args()


def extract_field(name: str, line: str) -> str:
    pattern = re.compile(r"\b%s=([^ ]+)" % re.escape(name))
    match = pattern.search(line)
    return match.group(1) if match else "-"


def main() -> None:
    ensure_env()
    args = parse_args()
    tail_n = max(10, int(args.tail))

    cmd = "grep -a 'CSP report' %s | tail -n %d" % (LOG_PATH, tail_n)
    out, err, code = ssh_exec(cmd)
    if code != 0 and not out.strip():
        print("No CSP report lines found.")
        if err.strip():
            print("SSH stderr:", err.strip())
        return

    lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
    if args.contains:
        token = args.contains.lower().strip()
        lines = [ln for ln in lines if token in ln.lower()]

    if not lines:
        print("No CSP report lines match the current filter.")
        return

    directive_counter = Counter()
    blocked_counter = Counter()
    document_counter = Counter()
    source_counter = Counter()

    for line in lines:
        directive_counter[extract_field("directive", line)] += 1
        blocked_counter[extract_field("blocked", line)] += 1
        document_counter[extract_field("document", line)] += 1
        source_counter[extract_field("source", line)] += 1

    print("=" * 88)
    print("CSP REPORT SUMMARY")
    print("=" * 88)
    print("Lines analyzed:", len(lines))
    print()

    print("By directive:")
    for key, value in directive_counter.most_common(10):
        print("  %4d  %s" % (value, key))

    print("\nBy blocked-uri:")
    for key, value in blocked_counter.most_common(10):
        print("  %4d  %s" % (value, key))

    print("\nBy document:")
    for key, value in document_counter.most_common(15):
        print("  %4d  %s" % (value, key))

    print("\nTop source files:")
    for key, value in source_counter.most_common(10):
        print("  %4d  %s" % (value, key))

    print("\nLast 10 report lines:")
    for line in lines[-10:]:
        print("  " + line)


if __name__ == "__main__":
    main()

