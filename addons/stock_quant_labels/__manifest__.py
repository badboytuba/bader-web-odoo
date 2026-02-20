# Copyright 2025 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Stock Quant Labels",
    "summary": "Custom Labels For Quants and Lots",
    "version": "16.0.1.10.0",
    "license": "AGPL-3",
    "author": "cubells",
    "category": "Others",
    "website": "https://obertix.net",
    "depends": [
        "product",
        "stock",
    ],
    "data": [
        "security/ir.model.access.csv",
        "data/stock_quant_label.xml",
        "wizards/quant_print_label_views.xml",
        "reports/label_10_10.xml",
        "reports/label_10_10_warning.xml",
        "reports/label_32_52.xml",
        "reports/label_54_34.xml",
        "reports/label_70_40_rotaries.xml",
        "reports/label_70_40.xml",
        "reports/label_70_40_warning.xml",
        "reports/label_100_100_rotaries.xml",
        "views/ir_actions_report.xml",
        "views/product_product_views.xml",
    ],
    "assets": {
        "web.report_assets_common": [
            "stock_quant_labels/static/src/scss/report.scss",
        ],
    },
    "installable": True,
}
