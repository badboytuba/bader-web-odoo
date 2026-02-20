"""Quick script to query installed website modules from Odoo DB."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from ssh_cmd import ssh_exec

cmd = """sudo -u odoo psql -d bader -t -A -c "SELECT name FROM ir_module_module WHERE state='installed' AND (name LIKE 'website%' OR name LIKE 'theme%' OR name LIKE 'portal%') ORDER BY name;" """
out, err, code = ssh_exec(cmd)
if out:
    print(out)
if err:
    print(f"STDERR: {err}")
