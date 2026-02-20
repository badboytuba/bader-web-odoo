from odoo import _, api, fields, models
from odoo.exceptions import UserError


class InvoiceListTagWizard(models.TransientModel):
    _name = 'invoice.list.tag.wizard'
    _description = 'Create a list of invoices'

    date_from = fields.Date(
        string='From Date',
        required=True,
    )
    date_to = fields.Date(
        string='To Date',
        required=True,
    )
    tag_ids = fields.Many2many(
        comodel_name='res.partner.category',
        string='Tags',
    )
    user_ids = fields.Many2many(
        comodel_name='res.users',
        string='Users',
    )

    _sql_constraints = [
        ('date_check',
         "CHECK ((date_from <= date_to))",
         "The end date must be greater than the start date."),
    ]

    def _get_partners(self, tag_ids):
        return self.env['res.partner'].search([
            ('category_id', 'in', tag_ids.ids)
        ])

    def _create_invoices(self, invoices):
        data_obj = self.env['invoice.list.tag.data']
        values = {}
        for invoice in invoices:
            if not invoice.partner_id.id in values:
                values.update({invoice.partner_id.id: [invoice.id]})
            else:
                values[invoice.partner_id.id].append(invoice.id)
        if values:
            for partner_id in values:
                data_obj.create({
                    'partner_id': partner_id,
                    'invoice_ids': [(6, 0, values[partner_id])]
                })

    def get_invoice_list(self):
        self.env['invoice.list.tag.data'].search([]).unlink()
        invoice_obj = self.env['account.move']
        for data in self:
            domain = [
                ('date_invoice', '>=', data.date_from),
                ('date_invoice', '<=', data.date_to),
            ]
            if data.tag_ids:
                partners = self._get_partners(data.tag_ids)
                if partners:
                    domain += [('partner_id', 'in', partners.ids)]
            if data.user_ids:
                domain += [('user_id', 'in', data.user_ids.ids)]
            invoices = invoice_obj.search(domain)
            if not invoices:
                raise UserError(_(
                    "There is not invoices to show."))
            self._create_invoices(invoices)
            return {
                'name': _('Invoice List'),
                'view_type': 'form',
                "view_mode": 'tree',
                'res_model': 'invoice.list.tag.data',
                'type': 'ir.actions.act_window',
                'view_id': False,
                'res_id': self.env['invoice.list.tag.data'].search([]),
            }
