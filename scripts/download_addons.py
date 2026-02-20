"""Download all bader custom addons from server via SFTP."""
import os
import sys
import stat
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from ssh_cmd import ssh_exec

import paramiko
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

HOST = os.getenv("DEPLOY_HOST")
PORT = int(os.getenv("DEPLOY_PORT", 22))
USER = os.getenv("DEPLOY_USER")
PASSWORD = os.getenv("DEPLOY_PASSWORD")

REMOTE_BADER_PATH = "/opt/odoo/src/bader"
LOCAL_ADDONS_PATH = Path(__file__).resolve().parent.parent / "addons"

SKIP_DIRS = {"__pycache__", ".git", "node_modules"}
SKIP_FILES = {"actualitzar.sh", "repos.yaml"}


def download_dir(sftp, remote_path, local_path, depth=0):
    """Recursively download a directory from SFTP."""
    local_path.mkdir(parents=True, exist_ok=True)

    for entry in sftp.listdir_attr(remote_path):
        remote_entry = f"{remote_path}/{entry.filename}"
        local_entry = local_path / entry.filename

        if entry.filename in SKIP_DIRS:
            continue
        if entry.filename in SKIP_FILES and depth == 0:
            continue

        if stat.S_ISDIR(entry.st_mode):
            print(f"{'  ' * depth}📁 {entry.filename}/")
            download_dir(sftp, remote_entry, local_entry, depth + 1)
        else:
            size_kb = entry.st_size / 1024
            print(f"{'  ' * depth}📄 {entry.filename} ({size_kb:.1f} KB)")
            sftp.get(remote_entry, str(local_entry))


def main():
    print(f"Connecting to {HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)

    sftp = client.open_sftp()

    print(f"\nDownloading {REMOTE_BADER_PATH} → {LOCAL_ADDONS_PATH}\n")
    download_dir(sftp, REMOTE_BADER_PATH, LOCAL_ADDONS_PATH)

    sftp.close()
    client.close()
    print(f"\n✅ Download complete! Files saved to: {LOCAL_ADDONS_PATH}")


if __name__ == "__main__":
    main()
