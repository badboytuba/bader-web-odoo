# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
from odoo import api, Command, fields, models


class AccountInvoice(models.Model):
    _inherit = "account.move"

    list_id = fields.Many2one(
        comodel_name='invoice.list.tag.data',
    )
    review_invoice_bank = fields.Boolean(
        related="partner_id.review_invoice_bank",
        store=True,
        readonly=True,
    )

    @api.onchange('fiscal_position_id')
    def onchange_fiscal_position_id_comment(self):
        for invoice in self:
            if invoice.fiscal_position_id:
                template = invoice.fiscal_position_id.comment_template_id
                if template:
                    invoice.comment_template_ids = [Command.link(template.id)]
