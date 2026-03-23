#!/usr/bin/env python3
"""Shared deployment environment helpers for the Bader QAS server."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"

load_dotenv(ENV_PATH)


def _env_first(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return default


def _env_bool(*names: str, default: bool = False) -> bool:
    raw_value = _env_first(*names)
    if not raw_value:
        return default
    return raw_value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class DeploySettings:
    host: str
    port: int
    user: str
    password: str
    domain: str
    droplet_id: str
    base_url: str
    remote_addons_path: str
    remote_stage_path: str
    odoo_python: str
    odoo_bin: str
    odoo_config: str
    db_name: str
    service_name: str
    log_path: str
    use_sudo: bool

    def missing_ssh_vars(self) -> list[str]:
        missing: list[str] = []
        if not self.host:
            missing.append("QAS_SSH_HOST")
        if not self.user:
            missing.append("QAS_SSH_USER")
        if not self.password:
            missing.append("QAS_SSH_PASSWORD")
        return missing


def load_settings() -> DeploySettings:
    user = _env_first("QAS_SSH_USER", "DEPLOY_USER")
    domain = _env_first("QAS_DOMAIN", default="qas.bader.com.ar")
    return DeploySettings(
        host=_env_first("QAS_SSH_HOST", "DEPLOY_HOST"),
        port=int(_env_first("QAS_SSH_PORT", "DEPLOY_PORT", default="22")),
        user=user,
        password=_env_first("QAS_SSH_PASSWORD", "DEPLOY_PASSWORD"),
        domain=domain,
        droplet_id=_env_first("QAS_DROPLET_ID"),
        base_url=_env_first(
            "WEB_AUDIT_BASE_URL",
            default=f"https://{domain}",
        ).rstrip("/"),
        remote_addons_path=_env_first(
            "DEPLOY_REMOTE_ADDONS_PATH",
            default="/opt/odoo/src/bader",
        ),
        remote_stage_path=_env_first(
            "DEPLOY_REMOTE_STAGE_PATH",
            default=f"/home/{user}/.cache/bader_deploy",
        ),
        odoo_python=_env_first(
            "DEPLOY_ODOO_PYTHON",
            default="/opt/odoo/.venv/bin/python",
        ),
        odoo_bin=_env_first(
            "DEPLOY_ODOO_BIN",
            default="/opt/odoo/src/odoo/odoo-bin",
        ),
        odoo_config=_env_first(
            "DEPLOY_ODOO_CONFIG",
            default="/opt/odoo/conf/odoo-server.conf",
        ),
        db_name=_env_first("DEPLOY_DB_NAME", default="bader"),
        service_name=_env_first("DEPLOY_SERVICE_NAME", default="odoo"),
        log_path=_env_first("DEPLOY_LOG_PATH", default="/var/log/odoo/odoo.log"),
        use_sudo=_env_bool("DEPLOY_USE_SUDO", default=True),
    )

