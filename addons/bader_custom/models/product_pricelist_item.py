from odoo import fields, models, tools


class ProductPricelistItem(models.Model):
    _inherit = "product.pricelist.item"

    base = fields.Selection(
        selection_add=[("offer", "Product Offer")],
        ondelete={"offer": "set default"},
    )
    offer_price = fields.Float()

    def _compute_price(self, product, quantity, uom, date, currency=None):
        product_uom = product.uom_id
        if product_uom != uom:
            convert = lambda p: product_uom._compute_price(p, uom)
        else:
            convert = lambda p: p
        if self.base == "offer":
            base_price = self._compute_base_price(
                product, quantity, uom, date, currency)
            price_limit = base_price
            price = (base_price - (
                        base_price * (self.price_discount / 100))) or 0.0
            if self.price_round:
                price = tools.float_round(
                    price, precision_rounding=self.price_round)
            if self.price_surcharge:
                price += convert(self.price_surcharge)
            if self.price_min_margin:
                price = max(
                    price, price_limit + convert(self.price_min_margin))
            if self.price_max_margin:
                price = min(
                    price, price_limit + convert(self.price_max_margin))
            return price
        else:
            return super()._compute_price(
                product, quantity, uom, date, currency=currency)

    def _compute_base_price(self, product, quantity, uom, date,
                            target_currency):
        rule_base = self.base or "list_price"
        if rule_base == "offer":
            return self.offer_price
        else:
            return super()._compute_base_price(
                product, quantity, uom, date, target_currency)
