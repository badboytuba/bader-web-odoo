#!/usr/bin/env python3
"""SSH helper to run commands on the Odoo server.
Usage: python scripts/ssh_cmd.py "command to run on server"
"""
import sys
import os
import paramiko
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

HOST = os.getenv("DEPLOY_HOST")
PORT = int(os.getenv("DEPLOY_PORT", 22))
USER = os.getenv("DEPLOY_USER")
PASSWORD = os.getenv("DEPLOY_PASSWORD")

def ssh_exec(command: str, timeout: int = 30) -> tuple[str, str, int]:
    """Execute a command via SSH and return (stdout, stderr, exit_code)."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=10)
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        return stdout.read().decode("utf-8", errors="replace"), stderr.read().decode("utf-8", errors="replace"), exit_code
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ssh_cmd.py 'command'")
        sys.exit(1)

    cmd = sys.argv[1]
    out, err, code = ssh_exec(cmd)
    if out:
        print(out)
    if err:
        print(f"[STDERR] {err}", file=sys.stderr)
    sys.exit(code)
