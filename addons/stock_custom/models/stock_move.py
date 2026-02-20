from odoo import api, fields, models


class StockMove(models.Model):
    _inherit = "stock.move"

    is_pack = fields.Boolean(
        compute="_compute_is_pack",
        store=True,
    )

    @api.depends('sale_line_id.pack_parent_line_id',
                 'sale_line_id.pack_child_line_ids')
    def _compute_is_pack(self):
        for move in self:
            move.is_pack = move.sale_line_id.pack_parent_line_id or \
                move.sale_line_id.pack_child_line_ids or False
