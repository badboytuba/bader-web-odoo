import csv

from odoo import models


class ReportReportCsvProduct(models.AbstractModel):
    _name = "report.report_csv.product"
    _description = "Report CSV Product"
    _inherit = "report.report_csv.abstract"


    def csv_report_options(self):
        res = super().csv_report_options()
        res["fieldnames"].append("Nombre del producto")
        res["fieldnames"].append("Referencia interna")
        res["fieldnames"].append("Código de barras")
        res["fieldnames"].append("Lote")
        res["delimiter"] = ":"
        res["quoting"] = csv.QUOTE_NONE
        return res

    def generate_csv_report(self, writer, data, products):
        Lot = self.env['stock.production.lot']
        writer.writeheader()
        for product in products:
            for variant in product.product_variant_ids:
                values = {
                    "Nombre del producto": variant.name or "",
                    "Referencia interna": variant.default_code or "",
                    "Código de barras": variant.barcode or "",
                }
                lots = Lot.search([('product_id', '=', variant.id)])
                if not lots:
                    values.update({
                        "Lote": "",
                    })
                    writer.writerow(values)
                else:
                    for lot in lots:
                        values.update({
                            "Lote": lot.name or "",
                        })
                        writer.writerow(values)
