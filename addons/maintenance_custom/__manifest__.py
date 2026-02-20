# Copyright 2023 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Maintenance Custom",
    "summary": "Bader customizacion for Maintenance model",
    "version": "16.0.1.1.0",
    "license": "AGPL-3",
    "author": "cubells",
    "category": "Others",
    "website": "https://obertix.net",
    "depends": [
        "maintenance_equipment_sequence",
        "maintenance_plan",
        "maintenance_product",
        "stock",
    ],
    "data": [
        "data/mail_activity_type_data.xml",
        "views/maintenance_equipment_category_views.xml",
        "views/maintenance_equipment_views.xml",
        "views/maintenance_request_views.xml",
    ],
    "installable": True,
}
