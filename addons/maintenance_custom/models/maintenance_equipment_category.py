from odoo import api, fields, models


class MaintenanceEquipmentCategory(models.Model):
    _inherit = "maintenance.equipment.category"

    plan_id = fields.Many2one(
        comodel_name="maintenance.plan",
        string="Default Plan",
    )
