from odoo import fields, models


class CrmTestSpeed(models.Model):
    _name = "crm.test.speed"
    _description = "Speed Tests"

    name = fields.Text(
        required=True,
    )
