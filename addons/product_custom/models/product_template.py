from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    offer_price = fields.Float(
        digits="Product Price",
    )
    description_manipulation = fields.Html()
