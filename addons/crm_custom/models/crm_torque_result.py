from odoo import fields, models


class CrmTorqueResult(models.Model):
    _name = "crm.torque.result"
    _description = "Torque REsult"

    name = fields.Text(
        required=True,
    )
