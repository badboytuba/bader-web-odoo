# Copyright 2023 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "CRM Custom",
    "summary": "Bader customizacion for CRM model",
    "version": "15.0.1.8.0",
    "license": "AGPL-3",
    "author": "cubells",
    "category": "Others",
    "website": "https://obertix.net",
    "depends": [
        "crm_claim_code",
        "sale_crm",
    ],
    "data": [
        "security/ir.model.access.csv",
        "reports/after_sale_report.xml",
        "reports/crm_lead_report.xml",
        "views/crm_claim_views.xml",
        "views/crm_force_result_views.xml",
        "views/crm_lead_views.xml",
        "views/crm_sound_result_views.xml",
        "views/crm_speed_result_views.xml",
        "views/crm_test_force_views.xml",
        "views/crm_test_operation_views.xml",
        "views/crm_test_sound_views.xml",
        "views/crm_test_speed_views.xml",
        "views/crm_test_torque_views.xml",
        "views/crm_torque_result_views.xml",
        "views/ir_actions_report.xml",
        "views/crm_menus.xml",
    ],
    "assets": {
        "web.report_assets_common": ["crm_custom/static/src/css/custom.scss"],
    },
    "installable": True,
}
