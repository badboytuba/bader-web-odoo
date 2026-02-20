# Copyright 2023 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Account Custom",
    "version": "15.0.1.1.0",
    "license": "AGPL-3",
    "author": "cubells",
    "category": "Others",
    "website": "https://obertix.net",
    "depends": [
        'account_asset_management',
        'account_comment_template',
        'l10n_es_mis_report',
    ],
    "data": [
        'security/ir.model.access.csv',
        #'data/mis_report_balance_normal.xml',
        'wizards/invoices_list_by_tag_views.xml',
        'views/account_move_views.xml',
        'views/res_partner_views.xml',
        'views/account_fiscal_position_views.xml',
        'views/invoice_list_tag_data_views.xml',
    ],
    "installable": True,
}
