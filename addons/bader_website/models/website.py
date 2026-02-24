# -*- coding: utf-8 -*-
from odoo import api, models


class Website(models.Model):
    _inherit = "website"

    @api.model
    def bader_sync_frontend_menus(self):
        """Keep a single Bader-AR style top menu per website."""
        menu_model = self.env["website.menu"].sudo()
        websites = self.sudo().search([])

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
            {"name": "Servicios", "url": "/servicios", "sequence": 70, "aliases": []},
        ]

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

        for website in websites:
            marker = "%s %s" % (website.name or "", website.domain or "")
            if "bader" not in marker.lower():
                continue

            root_menu = menu_model.search([
                ("website_id", "=", website.id),
                ("parent_id", "=", False),
            ], limit=1)
            if not root_menu:
                continue

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
                menu.with_context(lang="es_ES").write({"name": item["name"]})
                menu.with_context(lang="en_US").write({"name": item["name"]})

                kept |= menu
                duplicates = matches - menu
                if duplicates:
                    duplicates.unlink()

            final_top_level = menu_model.search([("parent_id", "=", root_menu.id)])
            stale_menus = final_top_level.filtered(lambda menu: menu.id not in kept.ids)
            if stale_menus:
                stale_menus.unlink()

        return True
