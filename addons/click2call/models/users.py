# -*- coding: utf-8 -*-

from odoo import models, fields


class User(models.Model):
    _inherit = 'res.users'

    premium_extension = fields.Char()
