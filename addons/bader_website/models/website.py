# -*- coding: utf-8 -*-
from odoo import api, models


class Website(models.Model):
    _inherit = "website"

    @api.model
    def bader_sync_frontend_menus(self):
        """Keep a single Bader-AR style top menu per website."""
        menu_model = self.env["website.menu"].sudo()
        website_model = self.sudo()
        websites = website_model.search([])
        lang_model = self.env["res.lang"].sudo()
        all_lang_codes = set(lang_model.search([]).mapped("code"))
        es_lang = lang_model.search([("code", "=", "es_ES")], limit=1)

        canonical_items = [
            {"name": "Inicio", "url": "/", "sequence": 10, "aliases": ["/home"]},
            {
                "name": "Nosotros",
                "url": "/sobre-nosotros",
                "sequence": 20,
                "aliases": ["/nosotros", "/quienes-somos"],
            },
            {
                "name": "Productos",
                "url": "/productos",
                "sequence": 30,
                "aliases": ["/shop", "#productos", "/#productos"],
            },
            {"name": "Ser Distribuidor", "url": "/ser-distribuidor", "sequence": 40, "aliases": []},
            {"name": "Descargas", "url": "/descargas", "sequence": 50, "aliases": []},
            {"name": "Blog", "url": "/blog", "sequence": 60, "aliases": []},
        ]

        canonical_urls = set()
        for item in canonical_items:
            canonical_urls.add(item["url"])
            canonical_urls |= set(item.get("aliases", []))

        def normalize_url(url):
            if not url:
                return ""
            cleaned = (url or "").strip()
            if not cleaned:
                return ""
            if not cleaned.startswith(("/", "#")):
                cleaned = "/" + cleaned
            if cleaned.startswith("/") and cleaned != "/" and cleaned.endswith("/"):
                cleaned = cleaned.rstrip("/")
            return cleaned

        normalized_canonical_urls = {normalize_url(url) for url in canonical_urls}

        for website in websites:
            website_updates = {}
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
                if es_lang not in website.language_ids:
                    website_updates["language_ids"] = [(4, es_lang.id)]
                if website.default_lang_id != es_lang:
                    website_updates["default_lang_id"] = es_lang.id
            if website.auto_redirect_lang:
                website_updates["auto_redirect_lang"] = False
            if website_updates:
                website.write(website_updates)

            kept = menu_model.browse()

            for item in canonical_items:
                top_level = menu_model.search(
                    [("parent_id", "=", root_menu.id)],
                    order="sequence, id",
                )
                target_urls = {normalize_url(item["url"])}
                target_urls |= {normalize_url(alias) for alias in item.get("aliases", [])}

                matches = top_level.filtered(
                    lambda m: normalize_url(m.url) in target_urls
                )
                menu = matches[:1]
                if not menu:
                    menu = menu_model.create({
                        "name": item["name"],
                        "url": item["url"],
                        "sequence": item["sequence"],
                        "parent_id": root_menu.id,
                        "website_id": website.id,
                        "new_window": False,
                    })

                menu.write({
                    "name": item["name"],
                    "url": item["url"],
                    "sequence": item["sequence"],
                    "new_window": False,
                })

                translation_langs = set(website.language_ids.mapped("code"))
                translation_langs |= {"es_ES", "en_US", "pt_PT", "pt_BR", "es_AR"}
                translation_langs &= all_lang_codes
                for lang_code in sorted(translation_langs):
                    menu.with_context(lang=lang_code).write({"name": item["name"]})

                kept |= menu
                duplicates = matches - menu
                if duplicates:
                    duplicates.unlink()

            final_top_level = menu_model.search([("parent_id", "=", root_menu.id)])
            stale_menus = final_top_level.filtered(lambda menu: menu.id not in kept.ids)
            if stale_menus:
                stale_menus.unlink()

        return True
