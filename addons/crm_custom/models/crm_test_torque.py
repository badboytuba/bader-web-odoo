from odoo import fields, models


class CrmTestTorque(models.Model):
    _name = "crm.test.torque"
    _description = "Torque Tests"

    name = fields.Text(
        required=True,
    )
