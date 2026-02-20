# Copyright 2022 Oihane Crucelaegui - AvanzOSC
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).

from odoo import _, api, fields, models
from odoo.tools import float_compare


class PickingLotImport(models.Model):
    _name = "picking.lot.import"
    _description = 'Picking Lot Import'

    picking_id = fields.Many2one(
        comodel_name='stock.picking',
    )
    product_id = fields.Many2one(
        comodel_name='product.product',
    )
    location_id = fields.Many2one(
        comodel_name='stock.location',
    )
    lot_id = fields.Many2one(
        comodel_name='stock.lot',
    )
    lot_name = fields.Char()
    lot_ref = fields.Char()
    error = fields.Char()
    import_now = fields.Boolean()

    @api.onchange('lot_id')
    def _onchange_lot_id(self):
        Quant = self.env['stock.quant'].sudo()
        if self.lot_id:
            quants = Quant.search([
                ('product_id', '=', self.product_id.id),
                ('lot_id', '=', self.lot_id.id),
            ])
            quant_available = False
            for quant in quants:
                if Quant._get_available_quantity(
                        self.product_id, quant.location_id,
                        lot_id=self.lot_id):
                    quant_available = quant
                    break
            if quant_available:
                self.location_id = quant_available.location_id.id
                self.import_now = True
                self.error = ''
            else:
                self.location_id = False
                self.import_now = False
                self.error = _("Lot {} is not available.").format(
                    self.lot_id.name)

    def recheck_lots(self):
        self.ensure_one()
        Quant = self.env['stock.quant'].sudo()
        Line = self.env['stock.move.line']
        quants = Quant.search(Line._get_domain(
            product_id=self.product_id, lot_id=self.lot_id, usage=True))
        move_lines = Line
        for quant in quants:
            move_lines |= Line.search(Line._get_move_line_domain(quant))
            if move_lines[:1].state == 'done' and \
                    not quant.location_id.should_bypass_reservation():
                quant.write({'reserved_quantity': 0})

    @staticmethod
    def _compare(qty1, qty2, precision_rounding):
        return float_compare(
            qty1, qty2,
            precision_rounding=precision_rounding)

    def _get_available_quantity(self, origin_location_id):
        self.ensure_one()
        if not self.product_id:
            return 0
        search_args = [
            ('location_id', '=', origin_location_id.id),
            ('product_id', '=', self.product_id.id),
        ]
        if self.lot_id:
            search_args.append(('lot_id', '=', self.lot_id.id))
        else:
            search_args.append(('lot_id', '=', False))
        res = self.env['stock.quant'].read_group(search_args, ['quantity'], [])
        available_qty = res[0]['quantity']
        if not available_qty:
            return 0
        rounding = self.product_id.uom_id.rounding
        available_qty_lt_move_qty = self._compare(
            available_qty, 1.0, rounding) == -1
        if available_qty_lt_move_qty:
            return 0, available_qty
        return 0, 1.0

    def _get_move_line_values(self, picking, move):
        self.ensure_one()
        qty_todo, qty_done = self._get_available_quantity(move.location_id)
        return {
            "product_id": self.product_id.id,
            "lot_id": self.lot_id.id,
            "location_id": move.location_id.id,
            "location_dest_id": move.location_dest_id.id,
            "product_uom_qty": qty_done,
            "product_uom_id": self.product_id.uom_id.id,
            "picking_id": picking.id,
            "move_id": move.id,
        }

    def _create_move_line(self, picking, move):
        self.ensure_one()
        values = self._get_move_line_values(picking, move)
        return self.env['stock.move.line'].create(values)
