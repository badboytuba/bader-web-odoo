#!/usr/bin/env python3
"""View Odoo server logs.

Usage:
  python scripts/odoo_logs.py                    # Last 50 lines
  python scripts/odoo_logs.py -n 100             # Last 100 lines
  python scripts/odoo_logs.py --errors           # Only ERROR lines
  python scripts/odoo_logs.py --warnings         # ERROR + WARNING lines
  python scripts/odoo_logs.py --search "pattern" # Search for pattern
  python scripts/odoo_logs.py --follow           # Tail -f (live)
"""
import sys
import os
import argparse
from pathlib import Path

import paramiko
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

HOST = os.getenv("DEPLOY_HOST")
PORT = int(os.getenv("DEPLOY_PORT", 22))
USER = os.getenv("DEPLOY_USER")
PASSWORD = os.getenv("DEPLOY_PASSWORD")

LOG_PATH = "/var/log/odoo/odoo.log"


def main():
    parser = argparse.ArgumentParser(description="View Odoo logs")
    parser.add_argument("-n", "--lines", type=int, default=50, help="Number of lines (default: 50)")
    parser.add_argument("--errors", action="store_true", help="Only show ERROR lines")
    parser.add_argument("--warnings", action="store_true", help="Show ERROR + WARNING lines")
    parser.add_argument("--search", type=str, help="Search for pattern in logs")
    parser.add_argument("--follow", action="store_true", help="Follow log in real-time (Ctrl+C to stop)")
    args = parser.parse_args()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)

    if args.follow:
        print(f"📋 Following {LOG_PATH} (Ctrl+C to stop)...\n")
        cmd = f"tail -f {LOG_PATH}"
        if args.errors:
            cmd += " | grep --line-buffered ERROR"
        elif args.warnings:
            cmd += " | grep --line-buffered -E 'ERROR|WARNING'"
        elif args.search:
            cmd += f" | grep --line-buffered '{args.search}'"

        stdin, stdout, stderr = client.exec_command(cmd)
        try:
            for line in iter(stdout.readline, ""):
                print(line, end="")
        except KeyboardInterrupt:
            print("\n\n🛑 Stopped following logs.")
    else:
        if args.errors:
            cmd = f"grep ERROR {LOG_PATH} | tail -n {args.lines}"
        elif args.warnings:
            cmd = f"grep -E 'ERROR|WARNING' {LOG_PATH} | tail -n {args.lines}"
        elif args.search:
            cmd = f"grep '{args.search}' {LOG_PATH} | tail -n {args.lines}"
        else:
            cmd = f"tail -n {args.lines} {LOG_PATH}"

        print(f"📋 Odoo Logs (last {args.lines} lines):\n")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        print(stdout.read().decode("utf-8", errors="replace"))

        err = stderr.read().decode("utf-8", errors="replace")
        if err.strip():
            print(f"⚠️  {err.strip()}")

    client.close()


if __name__ == "__main__":
    main()
