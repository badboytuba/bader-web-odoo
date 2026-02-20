# Copyright 2024 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).


from odoo import _, fields, models
from odoo.exceptions import ValidationError


class ProductLotExportXlsx(models.AbstractModel):
    _name = "report.product_export.lots_xlsx"
    _inherit = "report.report_xlsx.abstract"
    _description = "Product Lot XLSX Report"

    def _get_data_dict(self):
        return {
            0: _("Default Code"),
            1: _("Name"),
            2: _("Location"),
            3: _("Lot/Serial"),
            4: _("Real Stock"),
        }

    def _write_header(self, workbook, sheet):
        bold = workbook.add_format({"bold": True})
        data = self._get_data_dict()
        for item in data:
            sheet.write(0, item, data[item], bold)

    def generate_xlsx_report(self, workbook, data, objects):
        Quant = self.env["stock.quant"].sudo()
        Product = self.env["product.product"]
        sheet = workbook.add_worksheet("Report")
        line = 1
        for product in Product.browse(data["product_ids"]):
            quant_domain = []
            if data.get("internal_locations"):
                quant_domain += [("location_id.usage", "=", "internal")]
            quant_domain += [("product_id", "=", product.id)]
            for quant in Quant.search(quant_domain):
                sheet.write(line, 0, product.default_code)
                sheet.write(line, 1, product.name)
                sheet.write(line, 2, quant.location_id.name)
                sheet.write(line, 3, quant.lot_id.name)
                sheet.write(line, 4, quant.inventory_quantity_auto_apply)
                line += 1
        self._write_header(workbook, sheet)
