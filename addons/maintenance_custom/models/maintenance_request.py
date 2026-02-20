from odoo import api, fields, models


class MaintenanceRequest(models.Model):
    _inherit = "maintenance.request"

    lot_id = fields.Many2one(
        comodel_name="stock.lot",
        related="equipment_id.lot_id",
        store=True,
        readonly=True,
    )
