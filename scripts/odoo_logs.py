#!/usr/bin/env python3
"""View Odoo server logs over SSH.

Usage:
  python scripts/odoo_logs.py
  python scripts/odoo_logs.py -n 100
  python scripts/odoo_logs.py --errors
  python scripts/odoo_logs.py --warnings
  python scripts/odoo_logs.py --search "pattern"
  python scripts/odoo_logs.py --follow
"""

from __future__ import annotations

import argparse
import os
import sys
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
        name for name, value in [
            ("DEPLOY_HOST", HOST),
            ("DEPLOY_USER", USER),
            ("DEPLOY_PASSWORD", PASSWORD),
        ] if not value
    ]
    if missing:
        print("ERROR: missing env vars: %s" % ", ".join(missing))
        sys.exit(1)


def build_cmd(args: argparse.Namespace) -> str:
    if args.follow:
        base = f"tail -f {LOG_PATH}"
        if args.errors:
            return base + " | grep --line-buffered ERROR"
        if args.warnings:
            return base + " | grep --line-buffered -E 'ERROR|WARNING'"
        if args.search:
            return base + f" | grep --line-buffered '{args.search}'"
        return base

    if args.errors:
        return f"grep ERROR {LOG_PATH} | tail -n {args.lines}"
    if args.warnings:
        return f"grep -E 'ERROR|WARNING' {LOG_PATH} | tail -n {args.lines}"
    if args.search:
        return f"grep '{args.search}' {LOG_PATH} | tail -n {args.lines}"
    return f"tail -n {args.lines} {LOG_PATH}"


def main() -> None:
    ensure_env()
    parser = argparse.ArgumentParser(description="View Odoo logs")
    parser.add_argument("-n", "--lines", type=int, default=50, help="number of lines")
    parser.add_argument("--errors", action="store_true", help="only ERROR lines")
    parser.add_argument("--warnings", action="store_true", help="ERROR + WARNING lines")
    parser.add_argument("--search", type=str, help="search pattern")
    parser.add_argument("--follow", action="store_true", help="follow log in real-time")
    args = parser.parse_args()

    cmd = build_cmd(args)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)

    try:
        if args.follow:
            print(f"Following {LOG_PATH} (Ctrl+C to stop)")
            _stdin, stdout, _stderr = client.exec_command(cmd)
            try:
                for line in iter(stdout.readline, ""):
                    print(line, end="")
            except KeyboardInterrupt:
                print("\nStopped.")
            return

        print(f"Odoo logs (last {args.lines} lines)")
        _stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out:
            print(out)
        if err.strip():
            print(f"ERR: {err.strip()}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
