#!/usr/bin/env python3
"""Deploy Odoo modules to the production server.

Usage:
  python scripts/odoo_deploy.py <module_name>
  python scripts/odoo_deploy.py <module_name> --upload-only
  python scripts/odoo_deploy.py --restart-only
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

REMOTE_BADER_PATH = "/opt/odoo/src/bader"
LOCAL_ADDONS_PATH = Path(__file__).resolve().parent.parent / "addons"

SKIP_DIRS = {"__pycache__", ".git", "node_modules"}


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


def get_ssh_client() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    return client


def ssh_exec(client: paramiko.SSHClient, cmd: str, timeout: int = 60) -> int:
    print("CMD: %s" % cmd)
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out:
        print("OUT:\n%s" % out)
    if err:
        print("ERR:\n%s" % err)
    return exit_code


def upload_module(sftp: paramiko.SFTPClient, module_name: str) -> str:
    local_dir = LOCAL_ADDONS_PATH / module_name
    remote_dir = f"{REMOTE_BADER_PATH}/{module_name}"
    if not local_dir.is_dir():
        print(f"ERROR: module '{module_name}' not found at {local_dir}")
        sys.exit(1)

    print(f"Uploading {module_name} -> {remote_dir}")
    _upload_dir(sftp, str(local_dir), remote_dir)
    print(f"Upload complete: {module_name}")
    return remote_dir


def _upload_dir(sftp: paramiko.SFTPClient, local_path: str, remote_path: str) -> None:
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        sftp.mkdir(remote_path)

    for item in os.listdir(local_path):
        if item in SKIP_DIRS:
            continue
        local_item = os.path.join(local_path, item)
        remote_item = f"{remote_path}/{item}"
        if os.path.isdir(local_item):
            _upload_dir(sftp, local_item, remote_item)
        else:
            sftp.put(local_item, remote_item)
            print(f"  file: {item}")


def fix_line_endings(client: paramiko.SSHClient, remote_dir: str) -> None:
    print("Fixing line endings (CRLF -> LF)")
    cmd = (
        f"find {remote_dir} -type f \\( -name '*.xml' -o -name '*.py' -o -name '*.scss' "
        f"-o -name '*.js' -o -name '*.csv' -o -name '*.txt' \\) "
        f"-exec sed -i 's/\\r$//' {{}} +"
    )
    ssh_exec(client, cmd, timeout=20)


def restart_odoo(client: paramiko.SSHClient) -> int:
    print("Restarting Odoo service...")
    return ssh_exec(client, "systemctl restart odoo", timeout=90)


def upgrade_module(client: paramiko.SSHClient, module_name: str) -> int:
    print(f"Upgrading module: {module_name}")
    cmd = (
        "sudo -u odoo /opt/odoo/.venv/bin/python /opt/odoo/src/odoo/odoo-bin "
        "-c /opt/odoo/conf/odoo-server.conf "
        f"-d bader -u {module_name} --stop-after-init"
    )
    return ssh_exec(client, cmd, timeout=240)


def main() -> None:
    ensure_env()
    parser = argparse.ArgumentParser(description="Deploy Odoo modules")
    parser.add_argument("module", nargs="?", help="module name to deploy")
    parser.add_argument("--upload-only", action="store_true", help="only upload")
    parser.add_argument("--restart-only", action="store_true", help="only restart Odoo")
    parser.add_argument("--no-upgrade", action="store_true", help="upload + restart, skip upgrade")
    args = parser.parse_args()

    if not args.module and not args.restart_only:
        parser.error("Specify a module name or use --restart-only")

    client = get_ssh_client()
    try:
        if args.restart_only:
            code = restart_odoo(client)
            if code != 0:
                sys.exit(code)
            print("Done.")
            return

        sftp = client.open_sftp()
        remote_dir = upload_module(sftp, args.module)
        sftp.close()

        fix_line_endings(client, remote_dir)

        if args.upload_only:
            print("Upload-only completed.")
            return

        if not args.no_upgrade:
            upgrade_code = upgrade_module(client, args.module)
            if upgrade_code != 0:
                print(f"ERROR: module upgrade failed with exit code {upgrade_code}")
                sys.exit(upgrade_code)

        restart_code = restart_odoo(client)
        if restart_code != 0:
            print(f"ERROR: restart failed with exit code {restart_code}")
            sys.exit(restart_code)

        print("Deployment completed.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
