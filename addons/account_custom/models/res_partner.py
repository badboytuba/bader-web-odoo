# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    review_invoice_bank = fields.Boolean(
        help="Check this field if you want to filter invoice later to review its bank",
    )
