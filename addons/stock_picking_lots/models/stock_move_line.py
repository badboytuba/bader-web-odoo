# Copyright 2019 Mikel Arregi Etxaniz - AvanzOSC
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
from odoo import api, fields, models


class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    lot_ref = fields.Char(
        string="Lot Internal Reference",
    )

    @api.onchange("lot_name", "lot_id")
    def _onchange_serial_number(self):
        result = super()._onchange_serial_number()
        if self.lot_id:
            self.lot_ref = self.lot_id.ref if self.lot_id.ref else self.lot_ref
        return result
