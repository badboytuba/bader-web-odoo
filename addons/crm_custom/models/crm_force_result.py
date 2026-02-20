from odoo import fields, models


class CrmForceResult(models.Model):
    _name = "crm.force.result"
    _description = "Force Result"

    name = fields.Text(
        required=True,
    )
