# Copyright 2019 Mikel Arregi Etxaniz - AvanzOSC
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
from odoo import api, fields, models


class StockLot(models.Model):
    _inherit = "stock.lot"

    def _get_domain_quant(self, outgoing):
        self.ensure_one()
        domain = [
            ('product_id', '=', self.product_id.id),
            ('lot_id', '=', self.id),
            ('company_id', '=', self.env.user.company_id.id),
            ('quantity', '>', 0),
            ('reserved_quantity', '=', 0),
        ]
        if outgoing:
            domain.append(('quantity', '>', 0))
            domain.append(('reserved_quantity', '=', 0))
        return domain

    def _get_quant_from_lot(self, outgoing):
        self.ensure_one()
        return self.env['stock.quant'].search(
            self._get_domain_quant(outgoing))[:1]
