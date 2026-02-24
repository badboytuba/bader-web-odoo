#!/usr/bin/env python3
"""Deploy complete shop redesign: XML template + SCSS + JS, update module, restart Odoo."""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from ssh_cmd import ssh_exec
from deploy_text_files import deploy_text_file, ensure_remote_dir

MODULE = "bader_website"
LOCAL_BASE = os.path.join(os.path.dirname(__file__), "..", "addons", MODULE)
REMOTE_DIR = f"/opt/odoo/src/bader/{MODULE}"

# 1. Deploy files (XML + SCSS + JS)
FILES = [
    ("views/shop.xml", "shop.xml (QWeb template)"),
    ("static/src/js/main.js", "main.js"),
    ("static/src/scss/_shop.scss", "_shop.scss"),
]

print("📦 Deploying files...")
for rel_path, label in FILES:
    local = os.path.join(LOCAL_BASE, rel_path)
    remote = f"{REMOTE_DIR}/{rel_path}"
    ensure_remote_dir(os.path.dirname(remote))
    deploy_text_file(local, remote)
    print(f"  ✅ {label}")

# 2. Clear compiled asset cache
print("\n🗑  Clearing compiled asset cache...")
out, _, _ = ssh_exec(
    'sudo -u odoo psql -d bader -c "DELETE FROM ir_attachment WHERE url LIKE \'/web/assets/%\';"',
    timeout=15
)
print(f"  Result: {out.strip()}")

# 3. Update module (to load new QWeb template)
print("\n🔧 Updating bader_website module (loading new QWeb templates)...")
out, _, _ = ssh_exec(
    "systemctl stop odoo && "
    f"sudo -u odoo /opt/odoo/venv/bin/python3 /opt/odoo/src/odoo/odoo-bin "
    f"-d bader -u {MODULE} --stop-after-init --no-http "
    f"--addons-path=/opt/odoo/src/odoo/addons,/opt/odoo/src/enterprise,/opt/odoo/src/bader "
    "2>&1 | tail -20",
    timeout=120
)
print(f"  {out.strip()}")

# 4. Restart Odoo
print("\n🔄 Restarting Odoo...")
ssh_exec("systemctl restart odoo", timeout=15)
print("  Waiting 15s for Odoo to start...")
time.sleep(15)

# 5. Trigger bundle generation
print("\n🌐 Triggering bundle generation...")
out, _, _ = ssh_exec(
    "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:8069/pt/shop'",
    timeout=30
)
print(f"  Page status: {out.strip()}")
time.sleep(5)

# 6. Check bundles for new classes
print("\n=== Check bundles for Bader-AR classes ===")
out, _, _ = ssh_exec(
    'sudo -u odoo psql -d bader -t -A -c "'
    "SELECT id, url, store_fname FROM ir_attachment "
    "WHERE url LIKE '/web/assets/%' AND (mimetype LIKE '%javascript%' OR mimetype LIKE '%css%') "
    "ORDER BY id DESC LIMIT 10;"
    '"',
    timeout=10
)

for line in out.strip().split('\n'):
    if not line.strip():
        continue
    parts = line.split('|')
    if len(parts) < 3 or not parts[2]:
        continue
    att_id, url, store_fname = parts[0], parts[1], parts[2]
    fpath = f"/opt/odoo/.local/share/Odoo/filestore/bader/{store_fname}"
    
    out2, _, _ = ssh_exec(f"grep -c 'bader-hero\\|bader-segment\\|bader-price-row\\|bader-floating-cart' {fpath} 2>/dev/null", timeout=5)
    count = out2.strip()
    short_url = url.split('/')[-1][:60]
    
    if count != '0':
        print(f"  ✅ {short_url}: {count} bader-ar references")

# 7. Check for errors
print("\n=== Odoo errors ===")
out, _, _ = ssh_exec(
    "journalctl -u odoo --since '2 min ago' --no-pager | grep -i 'error\\|traceback' | tail -5",
    timeout=10
)
print(out.strip() or "(no errors)")
print("\n✅ Deployment complete!")
