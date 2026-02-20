from odoo import fields, models


class CrmSpeedResult(models.Model):
    _name = "crm.speed.result"
    _description = "Speed Result"

    name = fields.Text(
        required=True,
    )
