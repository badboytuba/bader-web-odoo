# -*- coding: utf-8 -*-
from odoo import http
from odoo.addons.auth_signup.controllers.main import AuthSignupHome


class BaderAuthSignupAlias(AuthSignupHome):
    """Compat routes for language-prefixed signup URLs on website frontend."""

    @http.route([
        '/en_US/web/signup',
        '/es_ES/web/signup',
        '/es_AR/web/signup',
        '/pt_BR/web/signup',
        '/pt_PT/web/signup',
        '/fr_FR/web/signup',
        '/de_DE/web/signup',
        '/it_IT/web/signup',
    ], type='http', auth='public', website=True, sitemap=False)
    def web_auth_signup_lang(self, *args, **kw):
        return super(BaderAuthSignupAlias, self).web_auth_signup(*args, **kw)
