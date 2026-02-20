from odoo import fields, models


class CrmSoundResult(models.Model):
    _name = "crm.sound.result"
    _description = "Sound Result"

    name = fields.Text(
        required=True,
    )
