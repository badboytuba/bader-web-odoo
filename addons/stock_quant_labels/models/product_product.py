# Copyright 2025 Obertix, Free Software Solutions
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = "product.product"

    label_manufacturer = fields.Text(
        string="Manufacturer",
    )
    label_made_by = fields.Text(
        string="Made By",
    )
    label_warning = fields.Text(
        string="Warning",
    )
    on_label = fields.Char(
        string="ON",
    )
    tech_name_1 = fields.Char()
    tech_name_2 = fields.Char()
    tech_name_3 = fields.Char()
    tech_name_4 = fields.Char()
    tech_name_5 = fields.Char()
    tech_value_1 = fields.Char()
    tech_value_2 = fields.Char()
    tech_value_3 = fields.Char()
    tech_value_4 = fields.Char()
    tech_value_5 = fields.Char()
    tech_description = fields.Char(
        string="Description",
    )
