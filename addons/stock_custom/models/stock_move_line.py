from odoo import api, fields, models


class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    is_pack = fields.Boolean(
        related='move_id.is_pack',
        store=True,
    )
