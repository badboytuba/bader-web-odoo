from odoo import fields, models


class CrmTestOperation(models.Model):
    _name = "crm.test.operation"
    _description = "Operation Tests"

    name = fields.Text(
        required=True,
    )
