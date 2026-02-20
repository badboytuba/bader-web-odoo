from odoo import fields, models


class CrmTestForce(models.Model):
    _name = "crm.test.force"
    _description = "Force Tests"

    name = fields.Text(
        required=True,
    )
