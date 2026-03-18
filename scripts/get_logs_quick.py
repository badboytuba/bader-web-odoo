#!/usr/bin/env python3
"""Get recent Odoo error logs via SSH with password auth."""
import paramiko, os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    os.getenv("DEPLOY_HOST"),
    port=int(os.getenv("DEPLOY_PORT", 22)),
    username=os.getenv("DEPLOY_USER"),
    password=os.getenv("DEPLOY_PASSWORD"),
    timeout=15,
)

# Try journalctl first, fallback to strings on log file
cmds = [
    'journalctl -u odoo --since "20 min ago" --no-pager 2>/dev/null | tail -100',
    'strings /var/log/odoo/odoo-server.log 2>/dev/null | grep -iE "error|traceback|gemini|generate_image|exception" | tail -40',
    'strings /var/log/odoo/odoo.log 2>/dev/null | grep -iE "error|traceback|gemini|generate_image|exception" | tail -40',
]

for cmd in cmds:
    print(f"\n{'='*60}")
    print(f"CMD: {cmd[:80]}...")
    print('='*60)
    _, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    if out.strip():
        print(out)
    else:
        print("(no output)")
    if err.strip():
        print("STDERR:", err[:200])

c.close()
