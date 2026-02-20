# -*- coding: utf-8 -*-
from odoo import _, http, fields
from odoo.http import request
from odoo.http import Response
import logging


_logger = logging.getLogger(__name__)
import json

class CallNotification(http.Controller):

    @http.route('/premiumnumbers/<string:token>/register', auth='none', cors='*', csrf=False, save_session=False)
    def register(self, token, **kw):
        user_id = kw.get('USER_ID')
        phone_number = kw.get('PHONE_NUMBER')
        call_type = kw.get('TYPE', '1')
        if not (user_id and phone_number):
            return Response('USER_ID or PHONE_NUMBER not provided', status=500)
        config_token = request.env['ir.config_parameter'].sudo().get_param('call.notification.token')
        if token != config_token:
            return Response('Invalid Token', status=500)
        user_id = int(user_id)
        user = request.env['res.users'].browse(user_id).sudo()
        if user.exists():
            vals = {
                'user_id': user.id,
                'phone': phone_number,
                'status': 'start',
                'call_type': 'outbound' if call_type == '1' else 'inbound'
            }
            call = user.partner_id._register_call(vals)
            body = _('%s call has start from %s') % (call.call_type, phone_number)
            if call.partner_id:
                call.partner_id.sudo().with_user(user).message_post(body=body)
        else:
            return Response('User not found in system', status=500)

        headers_json = {'Content-Type': 'application/json'}
        result = {
            'type': 'json',
            'response': {
                "CALL_ID": call.id or 0
            }
        }
        return Response(json.dumps(result), headers=headers_json)

    @http.route('/premiumnumbers/<string:token>/finish', auth='none', cors='*', csrf=False, save_session=False)
    def finish(self, token, **kw):
        user_id = kw.get('USER_ID')
        caller_id = kw.get('CALL_ID')
        if not (user_id and caller_id):
            return Response('USER_ID or CALL_ID not provided', status=500)
        config_token = request.env['ir.config_parameter'].sudo().get_param('call.notification.token')
        if token != config_token:
            return Response('Invalid Token', status=500)
        user_id = int(user_id)
        user = request.env['res.users'].browse(user_id)
        register = request.env['call.register'].sudo().browse(int(caller_id))
        _logger.info('finish caller ID %s found', register.id)
        if user.exists():
            register.write({
                'call_end': fields.Datetime.now(),
                'status': 'stop'
            })
            body = _('%s call has stop from %s') % (register.call_type, register.phone)
            register.partner_id and register.partner_id.sudo().with_user(user).message_post(body=body)
            user.partner_id and user.partner_id.sudo().with_user(user).message_post(body=body)
        else:
            return Response('User not found in system', status=500)
        headers_json = {'Content-Type': 'application/json'}
        result = {
            'type': 'json',
            'response': [register.id or 0]
        }
        return Response(json.dumps(result), headers=headers_json)

    @http.route('/premiumnumbers/<string:token>/show', auth='none', cors='*', csrf=False, save_session=False)
    def show(self, token, **kw):
        user_id = kw.get('USER_ID')
        caller_id = kw.get('CALL_ID')
        if not (user_id and caller_id):
            return Response('USER_ID or CALL_ID not provided', status=500)
        config_token = request.env['ir.config_parameter'].sudo().get_param('call.notification.token')
        if token != config_token:
            return Response('Invalid Token', status=500)
        user_id = int(user_id)
        user = request.env['res.users'].browse(user_id)
        register = request.env['call.register'].sudo().browse(int(caller_id))
        _logger.info('show caller ID %s found', register.id)
        if user.exists():
            vals = {
                'user_id': user.id,
                'phone': register.phone,
                'status': 'stop',
                'type': 'show'
            }
            user.partner_id._notify_call(vals)
        else:
            return Response('User not found in system', status=500)
        return Response('success', status=200)

    @http.route('/premiumnumbers/<string:token>/hide', auth='none', cors='*', csrf=False, save_session=False)
    def hide(self, token, **kw):
        user_id = kw.get('USER_ID')
        caller_id = kw.get('CALL_ID')
        if not (user_id and caller_id):
            return Response('USER_ID or CALL_ID not provided', status=500)
        config_token = request.env['ir.config_parameter'].sudo().get_param('call.notification.token')
        if token != config_token:
            return Response('Invalid Token', status=500)
        user_id = int(user_id)
        user = request.env['res.users'].browse(user_id)
        register = request.env['call.register'].sudo().browse(int(caller_id))
        _logger.info('show caller ID %s found', register.id)
        if user.exists():
            vals = {
                'user_id': user.id,
                'phone': register.phone,
                'status': 'stop',
                'type': 'hide'
            }
            user.partner_id._notify_call(vals)
        else:
            return Response('User not found in system', status=500)
        return Response('success', status=200)
