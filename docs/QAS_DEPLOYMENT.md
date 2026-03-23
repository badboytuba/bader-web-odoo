# QAS Deployment Flow

This repository now targets a single Odoo 16 QAS server:

- Domain: `https://qas.bader.com.ar`
- SSH user: `bader`
- Access model: SSH login plus `sudo`
- Odoo service: `odoo`
- Database: `bader`
- Remote custom addons path: `/opt/odoo/src/bader`

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill the SSH password and any Git credentials you need locally.
3. Keep `WEB_AUDIT_BASE_URL=https://qas.bader.com.ar`.

## Daily workflow

1. Edit the module in `addons/<module_name>/`.
2. Review the diff:
   ```bash
   git status
   git diff -- addons/<module_name>/
   ```
3. Commit to `develop`:
   ```bash
   git add addons/<module_name>/
   git commit -m "[<module_name>] <change summary>"
   git push origin develop
   ```
4. Deploy to QAS:
   ```bash
   python scripts/odoo_deploy.py <module_name>
   ```
5. Inspect the remote logs:
   ```bash
   python scripts/odoo_logs.py -n 50 --errors
   ```
6. Run the frontend checks when the change touches the website:
   ```bash
   python scripts/web_qa_audit.py
   python scripts/pdp_smoke_check.py
   ```

## How deploy works now

The deploy script no longer assumes SSH as `root`.

1. Upload the module to `/home/bader/.cache/bader_deploy/<module_name>`.
2. Promote it with `sudo rsync` into `/opt/odoo/src/bader/<module_name>`.
3. Run `odoo-bin -u <module_name> --stop-after-init`.
4. Restart the `odoo` service.
5. Warm up and audit `https://qas.bader.com.ar`.

## Notes

- Scripts prefer the new `QAS_*` variables and still accept `DEPLOY_*` as compatibility aliases.
- `.agent/` is local-only and not committed, so project workflows there are convenience helpers for the current machine.
