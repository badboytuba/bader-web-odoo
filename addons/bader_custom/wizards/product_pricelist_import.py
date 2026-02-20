import base64
import xlrd
from xlrd.xldate import xldate_as_datetime

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class ProductPricelistImport(models.TransientModel):
    _name = 'product.pricelist.import'
    _description = 'Wizard to import pricelists'

    data_file = fields.Binary(
        string="Import File (*.xlsx)",
        required=True,
    )
    pricelist_id = fields.Many2one(
        comodel_name='product.pricelist',
        required=True,
    )
    remove_old = fields.Boolean(
        default=True,
    )
    remove_outdated = fields.Boolean()

    def import_file(self):
        self.ensure_one()
        Product = self.env['product.product']
        items = self.env['product.pricelist.item']
        header_fields = [
            "SKU", "OFERTA", "FECHA INICIO", "FECHA FIN", "DESCUENTO"]
        if self.data_file:
            decoded_data = base64.decodebytes(self.data_file)
            workbook = xlrd.open_workbook(file_contents=decoded_data)
            sheet = workbook.sheet_by_index(0)
            values = sheet.row_values(0)
            if not all([item in values for item in header_fields]):
                raise ValidationError(
                    _("The file does not contain the correct header fields"))
            compute_price = "formula"
            base = "offer"
            applied_on = "1_product"
            count = 1
            while count < sheet.nrows:
                values = sheet.row_values(count)
                if values[0]:
                    default_code = values[0]
                    offer = values[1]
                    if offer:
                        offer = float(offer)
                    else:
                        offer = 0.0
                    start_date = xldate_as_datetime(
                        values[2], workbook.datemode)
                    end_date = xldate_as_datetime(
                        values[3], workbook.datemode)
                    discount = values[4]
                    if discount:
                        discount = float(discount)
                    else:
                         discount = 0.0
                    product = Product.search(
                        [('default_code', '=', default_code)])
                    if not product:
                        raise ValidationError(
                            _("The product with code %s does not exist") %
                            default_code)
                    if self.remove_old:
                        self.pricelist_id.item_ids.filtered(
                            lambda r: r.product_id == product
                            and r.base == "offer"
                            and r.compute_price == compute_price
                            and r.applied_on == applied_on
                        ).unlink()
                    if self.remove_outdated:
                        self.pricelist_id.item_ids.filtered(
                            lambda r: r.base == "offer"
                            and r.compute_price == compute_price
                            and r.applied_on == applied_on
                            and r.date_end < fields.datetime.now()
                        ).unlink()
                    item = self.pricelist_id.item_ids.create({
                        'compute_price': compute_price,
                        'base': base,
                        'applied_on': applied_on,
                        'product_tmpl_id': product.product_tmpl_id.id,
                        'offer_price': offer,
                        'date_start': start_date,
                        'date_end': end_date,
                        'price_discount': discount,
                        'pricelist_id': self.pricelist_id.id,
                        'min_quantity': 1,
                    })
                    items |= item
                count += 1
        if items:
            action = self.env.ref('product.product_pricelist_item_action')
            result = action.read()[0]
            result['domain'] = [("id", "in", items.ids)]
            result['context'] = self.env.context
            result['name'] = _("Products with Price Updated")
            result['view_mode'] = 'tree,form'
            return result
        return True
