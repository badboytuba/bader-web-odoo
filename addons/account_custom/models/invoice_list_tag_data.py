# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo import _, api, fields, models


class InvoiceListTagData(models.Model):
    _name = 'invoice.list.tag.data'
    _description = 'Invoices Data'

    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Partner',
    )
    invoice_count = fields.Integer(
        string='# Invoices',
        compute='_compute_invoice_count',
    )
    invoice_ids = fields.One2many(
        comodel_name='account.move',
        inverse_name='list_id',
    )
    total_import = fields.Float(
        string='Import Total',
        compute='_compute_amount_total',
    )

    @api.depends('invoice_ids')
    def _compute_invoice_count(self):
        for data in self:
            data.invoice_count = len(data.invoice_ids.ids)

    @api.depends('invoice_ids')
    def _compute_amount_total(self):
        for data in self:
            data.total_import = sum(data.mapped('invoice_ids.amount_total'))

    def open_invoices(self):
        action = dict(
            name=_('Invoices'),
            view_type='form',
            view_mode='tree,form',
            res_model='account.move',
            view_id=False,
            type='ir.actions.act_window',
            domain=[('id', 'in', [x.id for x in self.invoice_ids])])
        action['views'] = [
            (self.env.ref('account.view_invoice_tree').id, 'tree'),
            (self.env.ref('account.view_move_form').id, 'form')]
        return action
