# Copyright 2023 Obertix, Free Software Solutions
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Stock Custom",
    "summary": "Bader customizacion for stock model",
    "version": "16.0.1.2.0",
    "license": "AGPL-3",
    "author": "cubells",
    "category": "Others",
    "website": "https://obertix.net",
    "depends": [
        "delivery_state",
        "delivery_package_number",
        "stock_picking_send_by_mail",
        "sale_product_pack",
    ],
    "data": [
        "views/stock_location_views.xml",
        "views/stock_picking_views.xml",
        "views/stock_move_line_views.xml",
    ],
    "installable": True,
}
