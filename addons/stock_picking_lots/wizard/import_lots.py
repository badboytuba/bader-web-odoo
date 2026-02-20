# Copyright (C) 2013 Obertix Free Software Solutions (<http://obertix.net>).
#                    cubells <info@obertix.net>
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).

from odoo import _, api, exceptions, fields,  models
import xlrd
import base64


def convert2str(value):
    new_value = str(value).strip()
    if "." in new_value:
        new_value = new_value[:new_value.index(".")]
    return new_value


class ImportInventory(models.TransientModel):
    _name = "import.lots"
    _description = "Import lots"

    data = fields.Binary(
        string="File",
        required=True,
    )
    name = fields.Char(
        string="Filename",
    )

    def action_import(self):
        self.ensure_one()
        Picking = self.env["stock.picking"]
        Product = self.env["product.product"]
        Lot = self.env["stock.lot"]
        Quant = self.env["stock.quant"]
        Import = self.env['picking.lot.import']
        picking = Picking.browse(self.env.context["active_id"])
        picking._check_permission_lots()
        outgoing = picking.picking_type_id.code == "outgoing"
        picking.import_line_ids.unlink()
        file_1 = base64.decodebytes(self.data)
        book = xlrd.open_workbook(file_contents=file_1)
        sheet = book.sheet_by_index(0)
        error_logs = []
        for counter in range(sheet.nrows):
            line_error_log = []
            rowValues = sheet.row_values(counter, 0, end_colx=sheet.ncols)
            try:
                default_code = convert2str(rowValues[0])
                if default_code.upper() == "REFERENCIA":
                    continue
                lot_name = convert2str(rowValues[1])
                variant = convert2str(rowValues[2])
                locationname = ""
                lotref = ""
                if len(rowValues) > 3:
                    locationname = convert2str(rowValues[3])
                if len(rowValues) > 4:
                    lotref = convert2str(rowValues[4])
                if not lot_name:
                    error_logs.append(_("Line {}:\nLot Name is not included.").format(
                        counter + 1))
                    continue
            except Exception:
                raise exceptions.Warning(
                    _("The file has not a valid format: REFERENCE, "
                      "SERIAL NUMBER, VARIANT"))
            dest_location = False
            prodlot = False
            l_name = ''
            if locationname:
                locationobj = self.env["stock.location"]
                location = locationobj.search([
                    ("complete_name", "ilike", locationname),
                ])
                if not location:
                    line_error_log.append(_(
                        "Location does not exists: {}.").format(locationname))
                for loc in location:
                    l_name = loc.name_get()[-1][1]
                    if l_name == locationname:
                        dest_location = loc
                        break
                if not dest_location:
                    line_error_log.append(_(
                        "Location not found: {}//{}.").format(locationname, l_name))
            domain = [("default_code", "=", default_code)]
            if variant:
                domain.append(("attribute_value_ids", "=", variant))
            product = Product.search(domain)
            if not product:
                line_error_log.append(
                    _("Product not found."))
            elif len(product) > 1:
                line_error_log.append(
                    _("There is more than one product with code [{}].").format(
                        default_code))
            else:
                moves = picking.move_ids.filtered(
                    lambda m: m.has_tracking != "none" and
                    m.product_id == product)
                if not moves:
                    line_error_log.append(
                        _("The product with code [{}] is not in the picking.").format(
                            default_code))
                for move in moves:
                    prodlot = Lot.search([
                        ("name", "=", lot_name),
                        ("product_id", "=", product.id)])
                    if picking.picking_type_id.use_create_lots:
                        if prodlot:
                            line_error_log.append(
                                _("Lot {} already exists.").format(lot_name))
                        if picking.move_line_ids.filtered(
                                lambda line: line.lot_name == lot_name and
                                line.product_id == product):
                            line_error_log.append(
                                _("Lot {} already selected.").format(lot_name))
                            continue
                    if picking.picking_type_id.use_existing_lots:
                        if move.state not in ("cancel", "done"):
                            move._do_unreserve()
                        if not prodlot:
                            line_error_log.append(
                                _("Lot {} not found.").format(lot_name))
                        else:
                            quant = prodlot._get_quant_from_lot(outgoing)
                            available_qty = Quant._get_available_quantity(
                                product, quant.location_id, lot_id=prodlot)
                            picking_type = picking.picking_type_id.code
                            if not available_qty and picking_type != 'incoming':
                                if not quant.reserved_quantity:
                                    line_error_log.append(
                                        _("Lot {} is not available.").format(
                                            lot_name))
                                else:
                                    line_error_log.append(
                                        _("Lot {} is not available because is "
                                          "reserved.").format(lot_name))
                            else:
                                if not prodlot.ref:
                                    prodlot.ref = lotref
            values = {
                'picking_id': picking.id,
                'product_id': product.id,
                'lot_name': lot_name,
            }
            if prodlot:
                quant = prodlot._get_quant_from_lot(outgoing)
                values.update({
                    'lot_id': prodlot.id,
                    'location_id': quant.location_id.id,
                })
                if ((dest_location and picking.picking_type_code in
                        ('internal', 'outgoing')) or (not quant
                        and picking.picking_type_code == 'incoming')):
                    if dest_location:
                        values.update({'location_id': dest_location.id})
            else:
                if picking.picking_type_code == 'incoming':
                    if dest_location:
                        values['location_id'] = dest_location.id
                    if lotref:
                        values['lot_ref'] = lotref
            if line_error_log:
                values.update({
                    'error': ' '.join(line_error_log),
                    'import_now': False,
                })
            if not line_error_log:
                values.update({'import_now': True})
            Import.create(values)
