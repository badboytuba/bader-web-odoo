#!/usr/bin/env python3
"""Deploy Odoo modules to the production server.

Usage:
  python scripts/odoo_deploy.py <module_name>
  python scripts/odoo_deploy.py <module_name> --upload-only
  python scripts/odoo_deploy.py --restart-only
"""

from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import paramiko
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

HOST = os.getenv("DEPLOY_HOST")
PORT = int(os.getenv("DEPLOY_PORT", 22))
USER = os.getenv("DEPLOY_USER")
PASSWORD = os.getenv("DEPLOY_PASSWORD")

REMOTE_BADER_PATH = "/opt/odoo/src/bader"
LOCAL_ADDONS_PATH = Path(__file__).resolve().parent.parent / "addons"
SCRIPTS_PATH = Path(__file__).resolve().parent
DEFAULT_AUDIT_URL = os.getenv("WEB_AUDIT_BASE_URL", "https://qas.bader4business.com").rstrip("/")
DEFAULT_READY_PATHS = (
    "/web/login",
    "/",
    "/productos",
    "/shop",
)

SKIP_DIRS = {"__pycache__", ".git", "node_modules"}


def ensure_env() -> None:
    missing = [
        name for name, value in [
            ("DEPLOY_HOST", HOST),
            ("DEPLOY_USER", USER),
            ("DEPLOY_PASSWORD", PASSWORD),
        ] if not value
    ]
    if missing:
        print("ERROR: missing env vars: %s" % ", ".join(missing))
        sys.exit(1)


def get_ssh_client() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    return client


def ssh_exec(client: paramiko.SSHClient, cmd: str, timeout: int = 60) -> int:
    print("CMD: %s" % cmd)
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out:
        print("OUT:\n%s" % out)
    if err:
        print("ERR:\n%s" % err)
    return exit_code


def upload_module(sftp: paramiko.SFTPClient, module_name: str) -> str:
    local_dir = LOCAL_ADDONS_PATH / module_name
    remote_dir = f"{REMOTE_BADER_PATH}/{module_name}"
    if not local_dir.is_dir():
        print(f"ERROR: module '{module_name}' not found at {local_dir}")
        sys.exit(1)

    print(f"Uploading {module_name} -> {remote_dir}")
    _upload_dir(sftp, str(local_dir), remote_dir)
    print(f"Upload complete: {module_name}")
    return remote_dir


def _upload_dir(sftp: paramiko.SFTPClient, local_path: str, remote_path: str) -> None:
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
            print(f"  file: {item}")


def fix_line_endings(client: paramiko.SSHClient, remote_dir: str) -> None:
    print("Fixing line endings (CRLF -> LF)")
    cmd = (
        f"find {remote_dir} -type f \\( -name '*.xml' -o -name '*.py' -o -name '*.scss' "
        f"-o -name '*.js' -o -name '*.csv' -o -name '*.txt' \\) "
        f"-exec sed -i 's/\\r$//' {{}} +"
    )
    ssh_exec(client, cmd, timeout=20)


def restart_odoo(client: paramiko.SSHClient) -> int:
    print("Restarting Odoo service...")
    return ssh_exec(client, "systemctl restart odoo", timeout=90)


def upgrade_module(client: paramiko.SSHClient, module_name: str) -> int:
    print(f"Upgrading module: {module_name}")
    cmd = (
        "sudo -u odoo /opt/odoo/.venv/bin/python /opt/odoo/src/odoo/odoo-bin "
        "-c /opt/odoo/conf/odoo-server.conf "
        f"-d bader -u {module_name} --stop-after-init "
        "--http-port=8079 --gevent-port=8080 --workers=0 --max-cron-threads=0"
    )
    return ssh_exec(client, cmd, timeout=240)


def http_probe(url: str, timeout: int) -> tuple[int, str, int]:
    req = Request(
        url=url,
        headers={
            "User-Agent": "BaderDeployWarmup/1.0",
            "Accept": "text/html,application/xhtml+xml,*/*",
        },
    )
    start = time.perf_counter()
    try:
        with urlopen(req, timeout=timeout) as resp:
            resp.read(4096)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            return int(resp.status), resp.geturl(), elapsed_ms
    except HTTPError as exc:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        try:
            exc.read(4096)
        except Exception:
            pass
        return int(exc.code), url, elapsed_ms
    except (TimeoutError, socket.timeout, URLError):
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return 0, url, elapsed_ms


def wait_for_http_ready(base_url: str, timeout_s: int, interval_s: int, paths: tuple[str, ...]) -> None:
    deadline = time.time() + max(1, int(timeout_s))
    interval = max(1, int(interval_s))
    pending = list(paths)
    print("Waiting for website readiness on: %s" % ", ".join(paths))
    while time.time() < deadline:
        remaining: list[str] = []
        for path in pending:
            url = urljoin(base_url + "/", path.lstrip("/"))
            status, final_url, elapsed_ms = http_probe(url, timeout=max(10, interval))
            print("READINESS %s -> %s (%dms) %s" % (path, status, elapsed_ms, final_url))
            if status < 200 or status >= 400:
                remaining.append(path)
        if not remaining:
            print("Website is ready.")
            return
        pending = remaining
        time.sleep(interval)
    raise RuntimeError("website did not become ready within %ss" % timeout_s)


def warm_up_routes(base_url: str, timeout: int, paths: tuple[str, ...], rounds: int) -> None:
    rounds = max(1, int(rounds))
    print("Warming up routes: %s" % ", ".join(paths))
    for round_idx in range(1, rounds + 1):
        print("Warm-up round %d/%d" % (round_idx, rounds))
        for path in paths:
            url = urljoin(base_url + "/", path.lstrip("/"))
            status, final_url, elapsed_ms = http_probe(url, timeout=max(10, timeout))
            print("WARMUP %s -> %s (%dms) %s" % (path, status, elapsed_ms, final_url))


def build_warmup_paths(extra_paths: list[str]) -> tuple[str, ...]:
    warmup_paths = list(DEFAULT_READY_PATHS)
    for path in extra_paths:
        normalized = (path or "").strip()
        if not normalized:
            continue
        if not normalized.startswith("/"):
            normalized = "/" + normalized
        if normalized not in warmup_paths:
            warmup_paths.append(normalized)
    return tuple(warmup_paths)


def run_post_restart_warmup(args: argparse.Namespace) -> None:
    if args.skip_warmup:
        return
    warmup_paths = build_warmup_paths(args.warmup_path)
    wait_for_http_ready(
        base_url=args.audit_url,
        timeout_s=args.ready_timeout,
        interval_s=args.ready_interval,
        paths=warmup_paths,
    )
    warm_up_routes(
        base_url=args.audit_url,
        timeout=max(5, args.ready_interval),
        paths=warmup_paths,
        rounds=args.warmup_rounds,
    )


def main() -> None:
    ensure_env()
    parser = argparse.ArgumentParser(description="Deploy Odoo modules")
    parser.add_argument("module", nargs="?", help="module name to deploy")
    parser.add_argument("--upload-only", action="store_true", help="only upload")
    parser.add_argument("--restart-only", action="store_true", help="only restart Odoo")
    parser.add_argument("--no-upgrade", action="store_true", help="upload + restart, skip upgrade")
    parser.add_argument(
        "--skip-sync-descargas-pages",
        action="store_true",
        help="skip automatic /descargas PDF page count sync for bader_website",
    )
    parser.add_argument("--skip-audit", action="store_true", help="skip frontend QA audit after deployment")
    parser.add_argument("--audit-url", type=str, default=DEFAULT_AUDIT_URL, help="base URL used by frontend QA audit")
    parser.add_argument("--audit-retries", type=int, default=6, help="audit retry attempts after restart")
    parser.add_argument("--audit-retry-delay", type=int, default=8, help="seconds between audit retries")
    parser.add_argument("--skip-warmup", action="store_true", help="skip HTTP readiness check and warm-up after restart")
    parser.add_argument("--ready-timeout", type=int, default=150, help="seconds to wait for frontend readiness after restart")
    parser.add_argument("--ready-interval", type=int, default=5, help="seconds between readiness probes")
    parser.add_argument("--warmup-rounds", type=int, default=2, help="how many warm-up passes to run before audit")
    parser.add_argument(
        "--warmup-path",
        action="append",
        default=[],
        help="extra relative path to warm up after restart; repeatable",
    )
    args = parser.parse_args()

    if not args.module and not args.restart_only:
        parser.error("Specify a module name or use --restart-only")

    if (
        args.module == "bader_website"
        and not args.restart_only
        and not args.skip_sync_descargas_pages
    ):
        sync_script = SCRIPTS_PATH / "sync_descargas_pages.py"
        if sync_script.is_file():
            sync_cmd = [sys.executable, str(sync_script), "--write"]
            print("Syncing /descargas PDF page counts: %s" % " ".join(sync_cmd))
            sync_result = subprocess.run(sync_cmd, check=False)
            if int(sync_result.returncode) != 0:
                print(
                    "ERROR: failed to sync /descargas page counts "
                    f"(exit {int(sync_result.returncode)})"
                )
                sys.exit(int(sync_result.returncode))
        else:
            print(f"WARN: sync script not found: {sync_script}")

    client = get_ssh_client()
    try:
        if args.restart_only:
            code = restart_odoo(client)
            if code != 0:
                sys.exit(code)
            try:
                run_post_restart_warmup(args)
            except RuntimeError as exc:
                print(f"ERROR: {exc}")
                sys.exit(1)
            print("Done.")
            return

        sftp = client.open_sftp()
        remote_dir = upload_module(sftp, args.module)
        sftp.close()

        fix_line_endings(client, remote_dir)

        if args.upload_only:
            print("Upload-only completed.")
            return

        if not args.no_upgrade:
            upgrade_code = upgrade_module(client, args.module)
            if upgrade_code != 0:
                print(f"ERROR: module upgrade failed with exit code {upgrade_code}")
                sys.exit(upgrade_code)

        restart_code = restart_odoo(client)
        if restart_code != 0:
            print(f"ERROR: restart failed with exit code {restart_code}")
            sys.exit(restart_code)

        if not args.skip_warmup:
            try:
                run_post_restart_warmup(args)
            except RuntimeError as exc:
                print(f"ERROR: {exc}")
                sys.exit(1)

        if not args.skip_audit:
            audit_script = SCRIPTS_PATH / "web_qa_audit.py"
            audit_cmd = [sys.executable, str(audit_script), "--base-url", args.audit_url]
            attempts = max(1, int(args.audit_retries))
            delay = max(1, int(args.audit_retry_delay))
            last_code = 0
            for attempt in range(1, attempts + 1):
                print("Running frontend QA audit (attempt %d/%d): %s" % (attempt, attempts, " ".join(audit_cmd)))
                audit_result = subprocess.run(audit_cmd, check=False)
                last_code = int(audit_result.returncode)
                if last_code == 0:
                    break
                if attempt < attempts:
                    print(f"Audit failed with exit code {last_code}. Waiting {delay}s before retry...")
                    time.sleep(delay)
            if last_code != 0:
                print(f"ERROR: frontend QA audit failed with exit code {last_code}")
                sys.exit(last_code)

        print("Deployment completed.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
