# Copyright 2023 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
from odoo import fields, models


class ProductLotExport(models.TransientModel):
    _name = "product.lot.export"
    _description = "Product Lot Export"

    internal_locations = fields.Boolean(
        string="Internal Locations Only",
        default=True,
    )

    def _prepare_products_data(self):
        wizard = self[0]
        return {
            "product_ids": self.env.context.get("active_ids"),
            "internal_locations": wizard.internal_locations,
        }

    def export_lots(self):
        self.ensure_one()
        report_name = "product_export.lots_xlsx"
        data = self._prepare_products_data()
        return (
            self.env["ir.actions.report"]
            .search([
                ("report_name", "=", report_name),
                ("report_type", "=", "xlsx")
            ],
                limit=1,
            )
            .report_action(self.ids, data)
        )
