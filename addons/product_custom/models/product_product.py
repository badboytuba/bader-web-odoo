from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = "product.product"

    qr_code = fields.Char()
    drawer = fields.Char()
    rotation = fields.Char()

    def get_product_multiline_description_sale(self):
        result = super().get_product_multiline_description_sale()
        if not self.env.user.has_group('base.portal_group'):
            return self.display_name
        return result
