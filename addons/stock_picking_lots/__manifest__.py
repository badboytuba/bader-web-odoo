# Copyright (C) 2013 Obertix Free Software Solutions (<http://obertix.net>).
#                    cubells <info@obertix.net>
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).
{
    "name": "Stock Picking Lots and Locations",
    "version": "15.0.1.2.1",
    "license": "AGPL-3",
    "category": "Tools",
    "author": "cubells",
    "website": "https://obertix.net",
    "depends": [
        "stock",
    ],
    "data": [
        "security/ir.model.access.csv",
        "security/security.xml",
        "wizard/import_lots_views.xml",
        "views/stock_picking_views.xml",
    ],
    "external_dependencies": {
        "python": [
            "xlrd",
        ],
    },
    "installable": True
}
