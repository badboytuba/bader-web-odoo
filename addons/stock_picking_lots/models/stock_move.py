# Copyright 2019 Mikel Arregi Etxaniz - AvanzOSC
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
from odoo import models


class StockMove(models.Model):
    _inherit = "stock.move"

    def _action_done(self, cancel_backorder=False):
        res = super()._action_done(cancel_backorder=cancel_backorder)
        for line in res.mapped("move_line_ids").filtered(
                lambda l: l.lot_ref and l.lot_id):
            if line.lot_ref:
                line.lot_id.ref = line.lot_ref
        return res

    def _prepare_move_line_vals(self, quantity=None, reserved_quant=None):
        vals = super()._prepare_move_line_vals(
            quantity=quantity, reserved_quant=reserved_quant)
        if reserved_quant:
            vals = dict(
                vals,
                lot_ref=reserved_quant.lot_id.ref,
            )
        return vals
