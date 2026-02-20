# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo import fields, models


class AccountFiscalPosition(models.Model):
    _inherit = "account.fiscal.position"

    comment_template_id = fields.Many2one(
        comodel_name='base.comment.template',
        string='Bottom Comment Template',
    )
