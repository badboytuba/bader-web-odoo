# Copyright 2025 Obertix, Free Software Solutions
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
from odoo import fields, models


class StockQuantLabel(models.Model):
    _name = "stock.quant.label"
    _description = "Stock Quant Label"

    name = fields.Char(
        string="Label Name",
        required=True,
        translate=True,
    )
    reference = fields.Char(
        required=True,
    )

    _sql_constraints = [
        ('name_uniq', 'unique (name)',
         "A label with the same name already exists."),
    ]
