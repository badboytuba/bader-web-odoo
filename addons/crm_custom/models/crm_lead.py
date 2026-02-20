from odoo import fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    claim_id = fields.Many2one(
        comodel_name="crm.claim",
        string="Claim",
    )
