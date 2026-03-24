# -*- coding: utf-8 -*-
import re
from urllib.parse import urlsplit

from odoo import api, models


class Website(models.Model):
    _inherit = "website"

    @api.model
    def _bader_clean_system_param(self, key, default=""):
        value = (self.env["ir.config_parameter"].sudo().get_param(key, default) or "").strip()
        if value.upper() == "CHANGE_ME_VIA_SETTINGS":
            return ""
        return value

    @api.model
    def _bader_clerk_frontend_ready(self):
        publishable_key = self._bader_clean_system_param("clerk.publishable_key")
        secret_key = self._bader_clean_system_param("clerk.secret_key")
        frontend_api = self._bader_clean_system_param("clerk.frontend_api")
        jwks_url = self._bader_clean_system_param("clerk.jwks_url")

        if not jwks_url and frontend_api:
            if "://" not in frontend_api:
                frontend_api = "https://%s" % frontend_api.lstrip("/")
            try:
                host = (urlsplit(frontend_api).netloc or "").strip()
            except Exception:
                host = ""
            if host:
                jwks_url = "%s://%s/.well-known/jwks.json" % (
                    urlsplit(frontend_api).scheme or "https",
                    host,
                )

        return bool(publishable_key and secret_key and jwks_url)

    @api.model
    def _bader_parse_host_aliases(self, raw_value):
        aliases = set()
        for chunk in re.split(r"[\s,;]+", raw_value or ""):
            candidate = (chunk or "").strip().lower()
            if not candidate:
                continue
            if "://" not in candidate:
                candidate = "https://%s" % candidate.lstrip("/")
            try:
                host = (urlsplit(candidate).hostname or "").strip().lower()
            except Exception:
                host = ""
            if not host:
                continue
            aliases.add(host)
            if host.startswith("www."):
                aliases.add(host[4:])
        return aliases

    @api.model
    def _bader_internal_hosts(self, website=False):
        default_hosts = {
            "shop.bader.com.ar",
            "www.shop.bader.com.ar",
            "bader.com.ar",
            "www.bader.com.ar",
            "bader4business.com",
            "www.bader4business.com",
            "qas.bader.com.ar",
            "www.qas.bader.com.ar",
            "bader.es",
            "www.bader.es",
        }
        configured_hosts = self._bader_parse_host_aliases(
            self.env["ir.config_parameter"].sudo().get_param(
                "bader_website.internal_host_aliases",
                "",
            )
        )
        website_hosts = self._bader_parse_host_aliases(
            website.domain if website else ""
        )
        return default_hosts | configured_hosts | website_hosts

    @api.model
    def _bader_internal_hosts_csv(self):
        website = self[:1] if self else self.env["website"]
        if website:
            hosts = website._bader_internal_hosts(website)
        else:
            hosts = self._bader_internal_hosts()
        return ",".join(sorted(hosts))

    @api.model
    def bader_sync_frontend_menus(self):
        """Keep a single Bader website menu tree per website."""
        menu_model = self.env["website.menu"].sudo()
        website_model = self.sudo()
        websites = website_model.search([])
        lang_model = self.env["res.lang"].sudo()
        all_lang_codes = set(lang_model.search([]).mapped("code"))
        es_lang = lang_model.search([("code", "=", "es_ES")], limit=1)

        canonical_items = [
            {"name": "Home", "url": "/", "sequence": 10, "aliases": ["/home"]},
            {
                "name": "Ofertas",
                "url": "/ofertas",
                "sequence": 20,
                "aliases": ["/oferta", "/productos?bader_qf=ofertas"],
            },
            {
                "name": "Promociones",
                "url": "/promociones",
                "sequence": 30,
                "aliases": [
                    "/promocion",
                    "/productos?bader_qf=destacados",
                    "/productos?bader_qf=destacados&order=website_sequence+asc",
                ],
            },
            {
                "name": "Catálogo",
                "url": "/productos",
                "sequence": 40,
                "aliases": ["/shop", "#productos", "/#productos"],
            },
            {
                "name": "Formación",
                "url": "/formacion",
                "sequence": 50,
                "aliases": ["/capacitacion"],
                "children": [
                    {
                        "name": "Cursos de Especialidades",
                        "url": "/formacion/cursos-de-especialidades",
                        "sequence": 10,
                        "aliases": [],
                    },
                    {
                        "name": "Dictantes",
                        "url": "/formacion/dictantes",
                        "sequence": 20,
                        "aliases": [],
                    },
                    {
                        "name": "Workshops",
                        "url": "/formacion/workshops",
                        "sequence": 30,
                        "aliases": [],
                    },
                ],
            },
            {
                "name": "Post-Venta",
                "url": "/post-venta",
                "sequence": 60,
                "aliases": ["/postventa", "/post-ventas"],
                "children": [
                    {
                        "name": "Compra de Repuestos",
                        "url": "/post-venta/compra-repuestos",
                        "sequence": 10,
                        "aliases": [],
                    },
                    {
                        "name": "Servicio Técnico Oficial",
                        "url": "/post-venta/servicio-tecnico-oficial",
                        "sequence": 20,
                        "aliases": [],
                    },
                    {
                        "name": "Asistencia técnica",
                        "url": "/post-venta/asistencia-tecnica",
                        "sequence": 30,
                        "aliases": [],
                    },
                ],
            },
            {
                "name": "Quienes Somos",
                "url": "/sobre-nosotros",
                "sequence": 80,
                "aliases": ["/nosotros", "/quienes-somos"],
            },
            {
                "name": "Ser Distribuidor",
                "url": "/ser-distribuidor",
                "sequence": 90,
                "aliases": [],
            },
            {"name": "Descargas", "url": "/descargas", "sequence": 100, "aliases": []},
            {"name": "Blog", "url": "/blog", "sequence": 110, "aliases": []},
            {
                "name": "Contacto",
                "url": "/contacto",
                "sequence": 120,
                "aliases": ["/servicios", "/#contacto"],
            },
        ]

        canonical_urls = set()
        internal_hosts = self._bader_internal_hosts()

        def collect_urls(items):
            for item in items:
                canonical_urls.add(item["url"])
                canonical_urls.update(item.get("aliases", []))
                collect_urls(item.get("children", []))

        def normalize_url(url):
            if not url:
                return ""
            cleaned = (url or "").strip()
            if not cleaned:
                return ""
            lower_cleaned = cleaned.lower()
            if lower_cleaned.startswith(("http://", "https://")):
                try:
                    parsed = urlsplit(cleaned)
                    host = (parsed.hostname or "").lower()
                    if host and any(
                        host == alias or host.endswith(".%s" % alias)
                        for alias in internal_hosts
                    ):
                        cleaned = parsed.path or "/"
                        if parsed.query:
                            cleaned += "?" + parsed.query
                        if parsed.fragment:
                            cleaned += "#" + parsed.fragment
                    else:
                        return cleaned
                except Exception:
                    return cleaned
            if not cleaned.startswith(("/", "#")):
                cleaned = "/" + cleaned
            if cleaned.startswith("/") and cleaned != "/" and cleaned.endswith("/"):
                cleaned = cleaned.rstrip("/")
            return cleaned

        def sync_menu_branch(parent_menu, items, website):
            kept_children = menu_model.browse()
            translation_langs = set(website.language_ids.mapped("code"))
            translation_langs |= {"es_ES"}
            translation_langs &= all_lang_codes

            for item in items:
                current_children = menu_model.search(
                    [("parent_id", "=", parent_menu.id)],
                    order="sequence, id",
                )
                target_urls = {normalize_url(item["url"])}
                target_urls |= {
                    normalize_url(alias) for alias in item.get("aliases", [])
                }
                matches = current_children.filtered(
                    lambda menu: normalize_url(menu.url) in target_urls
                )
                menu = matches[:1]
                if not menu:
                    menu = menu_model.create({
                        "name": item["name"],
                        "url": item["url"],
                        "sequence": item["sequence"],
                        "parent_id": parent_menu.id,
                        "website_id": website.id,
                        "new_window": False,
                    })

                menu.write({
                    "name": item["name"],
                    "url": item["url"],
                    "sequence": item["sequence"],
                    "new_window": False,
                })

                for lang_code in sorted(translation_langs):
                    menu.with_context(lang=lang_code).write({"name": item["name"]})

                duplicates = matches - menu
                if duplicates:
                    duplicates.unlink()

                sync_menu_branch(menu, item.get("children", []), website)
                kept_children |= menu

            final_children = menu_model.search([("parent_id", "=", parent_menu.id)])
            stale_children = final_children.filtered(
                lambda menu: menu.id not in kept_children.ids
            )
            if stale_children:
                stale_children.unlink()

        collect_urls(canonical_items)
        normalized_canonical_urls = {normalize_url(url) for url in canonical_urls}

        for website in websites:
            website_updates = {}
            internal_hosts = website._bader_internal_hosts(website)
            root_menu = menu_model.search([
                ("website_id", "=", website.id),
                ("parent_id", "=", False),
            ], limit=1)
            if not root_menu:
                continue

            marker = "%s %s" % (website.name or "", website.domain or "")
            is_bader_marker = "bader" in marker.lower()
            top_level = menu_model.search([("parent_id", "=", root_menu.id)])
            has_bader_top_menu = bool(
                top_level.filtered(
                    lambda menu: normalize_url(menu.url) in normalized_canonical_urls
                )
            )
            if not is_bader_marker and not has_bader_top_menu:
                continue

            if es_lang:
                if set(website.language_ids.ids) != {es_lang.id}:
                    website_updates["language_ids"] = [(6, 0, [es_lang.id])]
                if website.default_lang_id != es_lang:
                    website_updates["default_lang_id"] = es_lang.id
            if website.auto_redirect_lang:
                website_updates["auto_redirect_lang"] = False
            if website_updates:
                website.write(website_updates)

            sync_menu_branch(root_menu, canonical_items, website)

        return True
