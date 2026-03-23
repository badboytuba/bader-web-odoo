"""Clear asset cache and restart Odoo."""
import paramiko
import sys

from deploy_env import load_settings

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
SETTINGS = load_settings()

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    SETTINGS.host,
    port=SETTINGS.port,
    username=SETTINGS.user,
    password=SETTINGS.password,
    timeout=15,
)

cmds = [
    f"sudo -u odoo psql -d {SETTINGS.db_name} -c \"DELETE FROM ir_attachment WHERE res_model='ir.ui.view' AND name LIKE '%assets_%';\" 2>&1",
    f"sudo systemctl restart {SETTINGS.service_name} 2>&1 && echo Odoo_restarted",
]

for cmd in cmds:
    print(f"\n>>> {cmd}")
    _, stdout, _ = c.exec_command(cmd, timeout=120)
    print(stdout.read().decode(errors='replace').strip())

c.close()
print("\nDone!")
