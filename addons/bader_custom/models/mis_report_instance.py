from odoo import fields, models


class MisReportInstance(models.Model):
    _inherit = "mis.report.instance"

    _order = "id desc"
