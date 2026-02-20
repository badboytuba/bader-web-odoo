# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

import string
import random

class CallRegister(models.Model):
    _name = 'call.register'
    _description = "Call Register"
    _rec_name = 'phone'

    user_id = fields.Many2one('res.users', string='User')
    partner_id = fields.Many2one('res.partner', string='Contact')
    phone = fields.Char('Phone')
    status = fields.Selection([
        ('start', 'Start'),
        ('stop', 'Stop')
    ], string="Status")
    call_type = fields.Selection([
        ('inbound', 'Inbound'),
        ('outbound', 'Outbound'),
    ], string="Type", default="inbound")
    call_end = fields.Datetime()
    duration = fields.Char(compute="_compute_duration", string="Duration(sec)")

    def _compute_duration(self):
        for record in self:
            if record.create_date and record.call_end:
                diff = (record.call_end - record.create_date)
                days, seconds = diff.days, diff.seconds
                hours = days * 24 + seconds // 3600
                minutes = (seconds % 3600) // 60
                seconds = seconds % 60
                record.duration = '{:02d}:{:02d}:{:02d}'.format(hours, minutes, seconds)
            else:
                record.duration = '00:00:00'

    @api.model_create_multi
    def create(self, vals):
        calls = super().create(vals)
        for call in calls:
            if call.phone:
                call.partner_id = self.env['res.partner'].search([('phone', '=', call.phone)], limit=1)
        return calls

    @api.model
    def show_popup(self, *args, **kw):
        phone = kw.get('phone')
        action = self.env.ref('call_notification.notification_popup_action')
        action_data = action.read()[0]
        parnter = self.env['res.partner'].search([('phone', '=', phone)], limit=1)
        rec = self.env['notification.popup'].create({
            'partner_id': parnter.id,
            'phone': phone
        })
        if not parnter:
            action_data['context'] = {'phone': phone}
        action_data['res_id'] = rec.id
        return action_data

    @api.model
    def set_notification_token(self):
        if not self.env['ir.config_parameter'].sudo().get_param('call.notification.token'):
            token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
            self.env['ir.config_parameter'].sudo().set_param('call.notification.token', token)

class CallNotification(models.Model):
    _inherit = 'res.partner'

    def _notify_call(self, notify):
        self.env['bus.bus']._sendmany([
            (self, 'call_notification', notify)
        ])

    def _register_call(self, vals):
        call = self.env['call.register'].sudo().create(vals)
        phone = vals.get('phone')
        status = vals.get('status')
        body = _('%s call has %s from %s') % (call.call_type, status, phone)
        self.sudo().with_user(vals['user_id']).message_post(body=body)
        return call

class NotificationPopup(models.TransientModel):
    _name = "notification.popup"
    _description = "Call Notification Popup"

    partner_id = fields.Many2one('res.partner')
    partner_image = fields.Binary(related='partner_id.image_1920')
    phone = fields.Char()

    def create_contact(self):
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'name': _("Create Contact"),
            'res_model': 'res.partner',
            'views': [(False, "form")],
            'context': {
                'default_phone': self.phone,
                'no_breadcrumbs': True,
            },
        }
