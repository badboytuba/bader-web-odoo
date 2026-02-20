from odoo import fields, models


class RepairOrder(models.Model):
    _inherit = "repair.order"

    technician_id = fields.Many2one(
        comodel_name="res.partner",
    )
    partner_location_id = fields.Many2one(
        comodel_name="stock.location",
        string="Work Location",
    )
