import datetime

from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = "product.product"

    def price_compute(
            self, price_type, uom=False, currency=False, company=None,
            date=False
    ):
        if price_type == "offer":
            partner_id = self.env.context.get(
                "partner_id", False
            ) or self.env.context.get("partner", False)
            if partner_id and isinstance(partner_id, models.BaseModel):
                partner_id = partner_id.id
            prices = super().price_compute(
                "list_price", uom, currency, company, date=date
            )
            for product in self:
                price = product._get_price_from_customerinfo(partner_id)
                if not price:
                    continue
                prices[product.id] = price
                if not uom and self._context.get("uom"):
                    uom = self.env["uom.uom"].browse(self._context["uom"])
                if not currency and self._context.get("currency"):
                    currency = self.env["res.currency"].browse(
                        self._context["currency"]
                    )
                if uom:
                    prices[product.id] = product.uom_id._compute_price(
                        prices[product.id], uom
                    )
                if currency:
                    date = self.env.context.get("date",
                                                datetime.datetime.now())
                    prices[product.id] = product.currency_id._convert(
                        prices[product.id], currency, company, date
                    )
            return prices
        return super().price_compute(
            price_type, uom, currency, company,date=date)
