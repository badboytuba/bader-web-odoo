#!/usr/bin/env python3
"""Deploy Odoo modules to the production server.

Usage:
  python scripts/odoo_deploy.py <module_name>         # Upload + restart + upgrade
  python scripts/odoo_deploy.py <module_name> --upload-only   # Upload only
  python scripts/odoo_deploy.py --restart-only        # Just restart Odoo
"""
import sys
import os
import stat
import argparse
from pathlib import Path

import paramiko
from dotenv import load_dotenv

# Load .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

HOST = os.getenv("DEPLOY_HOST")
PORT = int(os.getenv("DEPLOY_PORT", 22))
USER = os.getenv("DEPLOY_USER")
PASSWORD = os.getenv("DEPLOY_PASSWORD")

REMOTE_BADER_PATH = "/opt/odoo/src/bader"
LOCAL_ADDONS_PATH = Path(__file__).resolve().parent.parent / "addons"

SKIP_DIRS = {"__pycache__", ".git", "node_modules"}


def get_ssh_client():
    """Create and return an SSH client."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    return client


def ssh_exec(client, cmd, timeout=60):
    """Execute command and print output."""
    print(f"  🔧 {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(f"  ✅ {out.strip()}")
    if err.strip():
        print(f"  ⚠️  {err.strip()}")
    return exit_code


def upload_module(sftp, module_name):
    """Upload a module directory to the server."""
    local_dir = LOCAL_ADDONS_PATH / module_name
    remote_dir = f"{REMOTE_BADER_PATH}/{module_name}"

    if not local_dir.is_dir():
        print(f"❌ Module '{module_name}' not found at {local_dir}")
        sys.exit(1)

    print(f"📤 Uploading {module_name} → {remote_dir}")
    _upload_dir(sftp, str(local_dir), remote_dir)
    print(f"✅ Upload complete: {module_name}")


def _upload_dir(sftp, local_path, remote_path):
    """Recursively upload a directory."""
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
            print(f"  📄 {item}")


def restart_odoo(client):
    """Restart the Odoo service."""
    print("\n🔄 Restarting Odoo service...")
    ssh_exec(client, "systemctl restart odoo")
    print("✅ Odoo restarted")


def upgrade_module(client, module_name):
    """Upgrade a module in Odoo (via CLI)."""
    print(f"\n⬆️  Upgrading module: {module_name}")
    cmd = (
        f"su - odoo -s /bin/bash -c "
        f"'/opt/odoo/src/odoo/odoo-bin --config=/opt/odoo/conf/odoo-server.conf "
        f"-d bader -u {module_name} --stop-after-init'"
    )
    exit_code = ssh_exec(client, cmd, timeout=120)
    if exit_code == 0:
        print(f"✅ Module {module_name} upgraded successfully")
    else:
        print(f"❌ Module upgrade failed with exit code {exit_code}")
    return exit_code


def main():
    parser = argparse.ArgumentParser(description="Deploy Odoo modules")
    parser.add_argument("module", nargs="?", help="Module name to deploy")
    parser.add_argument("--upload-only", action="store_true", help="Only upload, don't restart/upgrade")
    parser.add_argument("--restart-only", action="store_true", help="Only restart Odoo")
    parser.add_argument("--no-upgrade", action="store_true", help="Upload + restart but skip module upgrade")
    args = parser.parse_args()

    if not args.module and not args.restart_only:
        parser.error("Specify a module name or use --restart-only")

    client = get_ssh_client()

    try:
        if args.restart_only:
            restart_odoo(client)
            return

        sftp = client.open_sftp()
        upload_module(sftp, args.module)
        sftp.close()

        if args.upload_only:
            return

        if not args.no_upgrade:
            upgrade_module(client, args.module)

        restart_odoo(client)

    finally:
        client.close()

    print("\n🎉 Deployment complete!")


if __name__ == "__main__":
    main()
