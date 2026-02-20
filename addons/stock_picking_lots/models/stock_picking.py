# Copyright 2022 Oihane Crucelaegui - AvanzOSC
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).

from odoo import _, api, fields, models
from odoo.exceptions import AccessError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    import_line_ids = fields.One2many(
        comodel_name='picking.lot.import',
        inverse_name='picking_id',
    )

    def _check_permission_lots(self):
        self.ensure_one()
        has_permission = self.user_has_groups(
            'stock_picking_lots.group_process_outgoing_picking')
        if self.picking_type_code == 'outgoing' and not has_permission:
            raise AccessError(
                _('You do not have permission to import lots.'))

    def action_import_lots_wizard(self):
        self.ensure_one()
        self._check_permission_lots()
        return self.sudo().env.ref(
            'stock_picking_lots.action_import_lots').read()[0]

    def _remove_lines_before_import(self):
        if self.picking_type_code == 'incoming':
            if not self.move_line_ids:
                self.action_assign()
            else:
                move_lines = self.move_line_ids.filtered(
                    lambda x: x.product_id.tracking == 'serial')
                move_lines.write({'lot_name': ''})
            return
        move_lines = self.move_lines.filtered(
            lambda x: x.product_id.tracking == 'serial').mapped('product_uom_qty')
        if sum(move_lines) == len(self.import_line_ids):
            self.move_line_ids.filtered(
                lambda x: x.product_id.tracking == 'serial').unlink()

    def clean_picking_lots(self):
        self.ensure_one()
        self.import_line_ids.unlink()

    def update_picking_lots(self):
        self.ensure_one()
        Line = self.env['stock.move.line']
        new_move = Line
        self._check_permission_lots()
        self._remove_lines_before_import()
        for line in self.import_line_ids.filtered(
                lambda x: x.import_now):
            for move in self.move_ids.filtered(
                    lambda m: m.has_tracking != "none" and
                          m.product_id == line.product_id):
                if self.picking_type_id.use_create_lots:
                    product_lines = move.move_line_ids.filtered(
                        lambda x: not x.lot_name and not line.lot_id)
                    if product_lines:
                        values = {
                            "lot_name": line.lot_name,
                            "lot_ref": line.lot_ref,
                            "qty_done": 1.0,
                        }
                        if line.location_id.id:
                            values.update({
                                'location_id': line.location_id.id})
                        if line.lot_ref:
                            values.update({'lot_ref': line.lot_ref})
                        product_lines[:1].write(values)
                        break
                if self.picking_type_id.use_existing_lots:
                    if move.state == "assigned":
                        move._do_unreserve()
                    if move.reserved_availability == move.product_qty:
                        continue
                    location_id = line.lot_id.location_id
                    lines_before = Line.search([('move_id', '=', move.id)])
                    move._update_reserved_quantity(
                        1.0, move.product_qty,
                        location_id, lot_id=line.lot_id)
                    if move.move_line_ids:
                        move.move_line_ids.filtered(
                            lambda ln: ln.lot_id == line.lot_id).qty_done = 1
                    lines_after = Line.search([('move_id', '=', move.id)])
                    move_line = lines_after - lines_before
                    if self.picking_type_code in ('internal', 'incoming'):
                        move_line.write(
                            {'location_dest_id': line.location_id.id})
                    if move.location_id.usage in ('supplier', 'customer'):
                        if not move_line or move_line != new_move:
                            new_move = line._create_move_line(self, move)
        self.move_ids._recompute_state()
