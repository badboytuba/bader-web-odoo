#!/usr/bin/env python3
"""Run the standard PDP release verification cycle."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import paramiko
from deploy_env import load_settings


ROOT = Path(__file__).resolve().parent.parent
SETTINGS = load_settings()
DEFAULT_BASE_URL = SETTINGS.base_url
DEFAULT_PDP_PATH = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify a PDP release on QAS.")
    parser.add_argument("--module", default="bader_website", help="Module name used by the deploy script.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL to verify.")
    parser.add_argument("--pdp-path", default=DEFAULT_PDP_PATH, help="Relative PDP path to verify. If omitted, auto-discover from /shop.")
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
    env = {
        "host": SETTINGS.host,
        "port": str(SETTINGS.port),
        "user": SETTINGS.user,
        "password": SETTINGS.password,
    }
    missing = [key for key, value in env.items() if not value]
    if missing:
        raise RuntimeError("Missing deploy environment variables: %s" % ", ".join(missing))
    return env


def remote_health_check(env: dict[str, str], since: str) -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        env["host"],
        port=int(env["port"]),
        username=env["user"],
        password=env["password"],
        timeout=20,
    )

    commands = [
        ("Service state", f"systemctl is-active {SETTINGS.service_name}"),
        (
            "Recent log issues",
            "sudo journalctl -u %s --since '%s' --no-pager -q | egrep -i 'traceback|exception|csp report' | tail -n 120"
            % (SETTINGS.service_name, since),
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
    pdp_smoke_cmd = [
        python,
        str(ROOT / "scripts" / "pdp_smoke_check.py"),
        "--base-url",
        args.base_url,
    ]
    if args.pdp_path:
        pdp_smoke_cmd.extend(["--path", args.pdp_path])
    run_step("PDP smoke check", pdp_smoke_cmd)
    remote_health_check(load_deploy_env(), args.log_since)
    print("[OK] PDP release verification completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
