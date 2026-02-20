from odoo import fields, models


class CrmTestSound(models.Model):
    _name = "crm.test.sound"
    _description = "Sound Result"

    name = fields.Text(
        required=True,
    )
