# Copyright 2025 Obertix, Free Software Solutions
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class QuantPrintLabel(models.TransientModel):
    _name = "quant.print.label"
    _description = "Print Quant Label"

    label_id = fields.Many2one(
        comodel_name="stock.quant.label",
        required=True,
    )
    quant_ids = fields.Many2many(
        comodel_name="stock.quant",
        string="Quants",
    )

    @api.model
    def default_get(self, fields):
        res = super().default_get(fields)
        active_model = self.env.context.get("active_model", False)
        if active_model == "stock.quant":
            res["quant_ids"] = self.env["stock.quant"].browse(
                self.env.context.get("active_ids", []))
        return res

    def button_print(self):
        self.ensure_one()
        reference = self.label_id.reference
        report = self.env.ref(reference, raise_if_not_found=False)
        if not report:
            raise ValidationError(_("That report is not available yet."))
        return report.report_action(
            self,
            data={
                'quant_ids': self.quant_ids.ids,
            },
        )
