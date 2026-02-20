import csv

from odoo import models


class ReportReportCsvSale(models.AbstractModel):
    _name = "report.report_csv.sale"
    _description = "Repost CSV Sale"
    _inherit = "report.report_csv.abstract"

    @staticmethod
    def localize_floats(row):
        res = {}
        for key, value in row.items():
            if isinstance(value, float):
                value = str(value).replace(".", ",")
            res[key] = value
        return res

    def csv_report_options(self):
        res = super().csv_report_options()
        res["fieldnames"].append("ID")
        res["fieldnames"].append("Referencia cliente")
        res["fieldnames"].append("Referencia del pedido")
        res["fieldnames"].append("Número de factura")
        res["fieldnames"].append("Fecha factura")
        res["fieldnames"].append("Referencia interna")
        res["fieldnames"].append("Nombre")
        res["fieldnames"].append("Cantidad pedida")
        res["fieldnames"].append("Precio unitario")
        res["fieldnames"].append("Descuento (%)")
        res["fieldnames"].append("Total de impuestos")
        res["fieldnames"].append("Total")
        res["fieldnames"].append("Seguimiento")
        res["delimiter"] = ","
        res["quoting"] = csv.QUOTE_ALL
        return res

    def generate_csv_report(self, writer, data, sales):
        writer.writeheader()
        for sale in sales:
            current = 0
            refs = sale.mapped('picking_ids.carrier_tracking_ref')
            tracking = [x for x in refs if x != False]
            if tracking:
                tracking = "\n".join(tracking)
            for line in sale.order_line.filtered(
                    lambda x: not x.pack_parent_line_id):
                values = {
                    "ID": sale.id,
                    "Referencia cliente": sale.client_order_ref or "",
                    "Referencia del pedido": sale.name,
                    "Número de factura": sale.invoice_ids[:1].name
                    if sale.invoice_ids else "",
                    "Fecha factura": sale.invoice_ids[:1].invoice_date
                    if sale.invoice_ids else "",
                }
                if sale.id != current:
                    current = sale.id

                    values.update({
                        "Referencia interna":
                            line.product_id.default_code or "",
                        "Nombre": line.name,
                        "Cantidad pedida": line.product_uom_qty,
                        "Precio unitario": "%.2f" % line.price_unit,
                        "Descuento (%)": line.discount,
                        "Total de impuestos": "%.2f" % line.price_tax,
                        "Total": "%.2f" % line.price_total,
                        "Seguimiento": tracking or "",
                    })
                else:
                    values = {
                        "Referencia interna":
                            line.product_id.default_code or "",
                        "Nombre": line.name,
                        "Cantidad pedida": line.product_uom_qty,
                        "Precio unitario": "%.2f" % line.price_unit,
                        "Descuento (%)": line.discount,
                        "Total de impuestos": "%.2f" % line.price_tax,
                        "Total": "%.2f" % line.price_total,
                        "Seguimiento": tracking or "",
                    }
                writer.writerow(self.localize_floats(values))
