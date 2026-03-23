#!/usr/bin/env python3
"""SSH helper to run commands on the Odoo server.
Usage: python scripts/ssh_cmd.py "command to run on server"
"""
import sys
import paramiko

from deploy_env import load_settings


SETTINGS = load_settings()


def ssh_exec(command: str, timeout: int = 30) -> tuple[str, str, int]:
    """Execute a command via SSH and return (stdout, stderr, exit_code)."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            SETTINGS.host,
            port=SETTINGS.port,
            username=SETTINGS.user,
            password=SETTINGS.password,
            timeout=10,
        )
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
