from odoo import models, fields, api

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    call_token = fields.Char(
        "Call Token",
        config_parameter='call.notification.token',
    )

    register_api_endpoint = fields.Char(string="Register API Endpoint", readonly=True)
    finish_api_endpoint = fields.Char(string="Finish API Endpoint", readonly=True)
    show_api_endpoint = fields.Char(string="Show API Endpoint", readonly=True)
    hide_api_endpoint = fields.Char(string="Hide API Endpoint", readonly=True)

    def default_get(self, fields):
        res = super().default_get(fields)
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        token = self.env['ir.config_parameter'].sudo().get_param('call.notification.token')

        register = "%s/premiumnumbers/%s/%s" % (base_url, token, 'register')
        finish = "%s/premiumnumbers/%s/%s" % (base_url, token, 'finish')
        show = "%s/premiumnumbers/%s/%s" % (base_url, token, 'show')
        hide = "%s/premiumnumbers/%s/%s" % (base_url, token, 'hide')
        res.update({
            'register_api_endpoint': register,
            'finish_api_endpoint': finish,
            'show_api_endpoint': show,
            'hide_api_endpoint': hide,
        })
        return res
