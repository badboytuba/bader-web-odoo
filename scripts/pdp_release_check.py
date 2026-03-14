#!/usr/bin/env python3
"""Run the standard PDP release verification cycle."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import paramiko
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)
DEFAULT_BASE_URL = os.getenv("WEB_AUDIT_BASE_URL", "https://qas.bader4business.com").rstrip("/")
DEFAULT_PDP_PATH = "/shop/09070084-compresor-25l-16182"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify a PDP release on QAS.")
    parser.add_argument("--module", default="bader_website", help="Module name used by the deploy script.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL to verify.")
    parser.add_argument("--pdp-path", default=DEFAULT_PDP_PATH, help="Relative PDP path to verify.")
    parser.add_argument("--log-since", default="10 minutes ago", help="How far back to inspect remote logs.")
    parser.add_argument("--skip-deploy", action="store_true", help="Skip module deployment and only run verification.")
    return parser.parse_args()


def run_step(label: str, cmd: list[str]) -> None:
    print(f"[STEP] {label}")
    print("       " + " ".join(cmd))
    completed = subprocess.run(cmd, cwd=ROOT, check=False)
    if completed.returncode != 0:
        raise RuntimeError(f"{label} failed with exit code {completed.returncode}")


def load_deploy_env() -> dict[str, str]:
    load_dotenv(ENV_PATH)
    env = {
        "DEPLOY_HOST": os.getenv("DEPLOY_HOST", "").strip(),
        "DEPLOY_PORT": os.getenv("DEPLOY_PORT", "22").strip(),
        "DEPLOY_USER": os.getenv("DEPLOY_USER", "").strip(),
        "DEPLOY_PASSWORD": os.getenv("DEPLOY_PASSWORD", "").strip(),
    }
    missing = [key for key, value in env.items() if not value]
    if missing:
        raise RuntimeError("Missing deploy environment variables: %s" % ", ".join(missing))
    return env


def remote_health_check(env: dict[str, str], since: str) -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        env["DEPLOY_HOST"],
        port=int(env["DEPLOY_PORT"]),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_PASSWORD"],
        timeout=20,
    )

    commands = [
        ("Service state", "systemctl is-active odoo"),
        (
            "Recent log issues",
            "journalctl -u odoo --since '%s' --no-pager | egrep -i 'traceback|exception|csp report' | tail -n 120"
            % since,
        ),
    ]
    try:
        for label, command in commands:
            print(f"[STEP] {label}")
            stdin, stdout, stderr = client.exec_command(command, timeout=120)
            out = stdout.read().decode("utf-8", errors="replace").strip()
            err = stderr.read().decode("utf-8", errors="replace").strip()
            if err:
                raise RuntimeError(f"{label} stderr: {err}")
            if label == "Service state" and out != "active":
                raise RuntimeError(f"Odoo service is not active: {out or 'unknown'}")
            if out:
                print(out)
    finally:
        client.close()


def main() -> int:
    args = parse_args()
    python = sys.executable

    if not args.skip_deploy:
        run_step(
            "Deploy module",
            [python, str(ROOT / "scripts" / "odoo_deploy.py"), args.module],
        )

    run_step(
        "Frontend QA audit",
        [python, str(ROOT / "scripts" / "web_qa_audit.py"), "--base-url", args.base_url],
    )
    run_step(
        "PDP smoke check",
        [
            python,
            str(ROOT / "scripts" / "pdp_smoke_check.py"),
            "--base-url",
            args.base_url,
            "--path",
            args.pdp_path,
        ],
    )
    remote_health_check(load_deploy_env(), args.log_since)
    print("[OK] PDP release verification completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
