"""Clear asset cache and restart Odoo."""
import paramiko, os, sys
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
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

cmds = [
    "sudo -u odoo psql -d bader -c \"DELETE FROM ir_attachment WHERE res_model='ir.ui.view' AND name LIKE '%assets_%';\" 2>&1",
    "systemctl restart odoo 2>&1 && echo Odoo_restarted",
]

for cmd in cmds:
    print(f"\n>>> {cmd}")
    _, stdout, _ = c.exec_command(cmd, timeout=120)
    print(stdout.read().decode(errors='replace').strip())

c.close()
print("\nDone!")
