###############################################################################
# For copyright and license notices, see __manifest__.py file in root directory
###############################################################################
import base64
import logging
import os

from odoo import exceptions, tools
from odoo.tests.common import TransactionCase

_log = logging.getLogger(__name__)

try:
    import pandas as pd
except (ImportError, IOError) as err:
    _log.debug(err)


class TestStockPickingLots(TransactionCase):

    def setUp(self):
        super().setUp()
        self.product_serial = self.env['product.product'].create({
            'type': 'product',
            'default_code': 'SERIAL',
            'company_id': False,
            'name': 'Serial product',
            'tracking': 'serial',
            'route_ids': [
                (6, 0, [self.env.ref('stock.route_warehouse0_mto').id])
            ],
        })
        self.location_stock_1 = self.env['stock.location'].create({
            'name': 'Stock1',
            'usage': 'internal',
            'location_id': self.env.ref('stock.stock_location_stock').id,
        })
        self.location_stock_2 = self.env['stock.location'].create({
            'name': 'Stock2',
            'usage': 'internal',
            'location_id': self.env.ref('stock.stock_location_stock').id,
        })


    def get_file(self, fname):
        return os.path.join(os.path.dirname(__file__), fname)

    def get_file_name(self, fname):
        return fname.split('/')[-1:][0]

    def test_incoming_with_backorder_and_return(self):
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        stock_location = self.env.ref('stock.stock_location_stock')
        type_in = self.env.ref('stock.picking_type_in')
        picking = self.env['stock.picking'].create({
            'location_id': supplier_location.id,
            'location_dest_id': stock_location.id,
            'picking_type_id': type_in.id,
            'move_lines': [
                (0, 0, {
                    'product_id': self.product_serial.id,
                    'name': self.product_serial.name,
                    'product_uom': self.product_serial.uom_id.id,
                    'product_uom_qty': 3,
                    'picking_type_id': type_in.id,
                }),
            ],
        })
        picking.action_confirm()
        self.assertEqual(len(picking.move_line_ids), 3)
        fname = self.get_file('samples/serial-in.xlsx')
        wizard = self.env['import.lots'].create({
            'data': base64.b64encode(open(fname, 'rb').read()),
            'name': self.get_file_name(fname),
        })
        wizard.with_context(active_id=picking.id).action_import()
        self.assertEqual(len(picking.import_line_ids), 2)
        picking.update_picking_lots()
        self.assertEqual(len(picking.move_line_ids), 3)
        self.assertEqual(sum(picking.move_line_ids.mapped('qty_done')), 2)
        self.assertEqual(
            sum(picking.move_line_ids.mapped('product_uom_qty')), 3)
        backorders = self.env['stock.picking'].search(
            [('backorder_id', '=', picking.id)])
        self.assertFalse(backorders)
        picking.action_done()
        self.assertEquals(picking.state, 'done')
        lots = picking.move_line_ids.mapped('lot_id')
        self.assertEquals(len(lots), 2)
        self.assertIn('lot-serial-test-1', lots.mapped('name'))
        self.assertIn('lot-serial-test-2', lots.mapped('name'))
        location_ids = picking.move_line_ids.mapped('location_id')
        self.assertEquals(len(location_ids), 1)
        self.assertEquals(location_ids[0], supplier_location)
        location_dest_ids = picking.move_line_ids.mapped('location_dest_id')
        self.assertEquals(len(location_dest_ids), 2)
        self.assertIn(self.location_stock_1, location_dest_ids)
        self.assertIn(self.location_stock_2, location_dest_ids)
        backorders = self.env['stock.picking'].search(
            [('backorder_id', '=', picking.id)])
        self.assertTrue(backorders)
        wizard = self.env['stock.return.picking'].with_context(
            active_ids=picking.ids,
            active_id=picking.id,
        )
        wizard = wizard.create({})
        wizard.product_return_moves[0].quantity = 1.0
        action = wizard.create_returns()
        return_picking = self.env['stock.picking'].browse(action['res_id'])
        fname = self.get_file('samples/serial-in-return.xlsx')
        wizard = self.env['import.lots'].create({
            'data': base64.b64encode(open(fname, 'rb').read()),
            'name': self.get_file_name(fname),
        })
        with self.assertRaises(exceptions.AccessError):
            wizard.with_context(active_id=return_picking.id).action_import()
        self.env.user.groups_id |= self.env.ref(
            'stock_picking_lots.group_process_outgoing_picking')
        wizard.with_context(active_id=return_picking.id).action_import()
        self.assertEqual(len(return_picking.import_line_ids), 1)
        return_picking.update_picking_lots()
        self.assertEqual(len(return_picking.move_line_ids), 1)
        self.assertEqual(
            sum(return_picking.move_line_ids.mapped('product_uom_qty')), 1)
        self.assertTrue(return_picking.move_lines[0])
        return_picking.action_assign()
        return_picking.move_lines.filtered(
            lambda m: m.product_id == self.product_serial).quantity_done = 1
        return_picking.move_lines.filtered(
            lambda m: m.product_id == self.product_serial).to_refund = True
        return_picking.action_done()
        location_id = return_picking.move_line_ids.mapped('location_id')
        self.assertEquals(len(location_id), 1)
        self.assertIn(
            location_id, [self.location_stock_1, self.location_stock_2])
        location_dest_id = return_picking.move_line_ids.mapped(
            'location_dest_id')
        self.assertEquals(len(location_dest_id), 1)
        self.assertEquals(location_dest_id[0], supplier_location)

    def test_outcoming(self):
        lot_1 = self.env['stock.lot'].create({
            'name': 'lot-serial-test-1',
            'product_id': self.product_serial.id,
        })
        lot_2 = self.env['stock.lot'].create({
            'name': 'lot-serial-test-2',
            'product_id': self.product_serial.id,
        })
        inventory = self.env['stock.inventory'].create({
            'name': 'Add products for tests',
            'filter': 'partial',
            'location_id': self.location_stock_1.id,
            'exhausted': True,
        })
        inventory.action_start()
        inventory.line_ids.create({
            'inventory_id': inventory.id,
            'product_id': self.product_serial.id,
            'prod_lot_id': lot_1.id,
            'product_qty': 1,
            'location_id': self.location_stock_1.id,
        })
        inventory._action_done()
        customer_location = self.env.ref('stock.stock_location_customers')
        stock_location = self.env.ref('stock.stock_location_stock')
        type_out = self.env.ref('stock.picking_type_out')
        picking = self.env['stock.picking'].create({
            'location_id': stock_location.id,
            'location_dest_id': customer_location.id,
            'picking_type_id': type_out.id,
            'move_lines': [
                (0, 0, {
                    'product_id': self.product_serial.id,
                    'name': self.product_serial.name,
                    'product_uom': self.product_serial.uom_id.id,
                    'product_uom_qty': 3,
                    'picking_type_id': type_out.id,
                }),
            ],
        })
        picking.action_confirm()
        picking.action_assign()
        self.assertEqual(len(picking.move_line_ids), 1)
        self.assertEqual(picking.move_line_ids.product_uom_qty, 1)
        self.assertEqual(picking.move_line_ids.lot_id, lot_1)
        fname = self.get_file('samples/serial-out.xlsx')
        wizard = self.env['import.lots'].create({
            'data': base64.b64encode(open(fname, 'rb').read()),
            'name': self.get_file_name(fname),
        })
        with self.assertRaises(exceptions.AccessError):
            wizard.with_context(active_id=picking.id).action_import()
        self.env.user.groups_id |= self.env.ref(
            'stock_picking_lots.group_process_outgoing_picking')
        self.assertEqual(len(picking.move_line_ids), 1)
        self.assertEqual(picking.move_line_ids.product_uom_qty, 1)
        wizard.with_context(active_id=picking.id).action_import()
        self.assertEqual(len(picking.import_line_ids), 1)
        picking.update_picking_lots()
        self.assertEqual(len(picking.move_line_ids), 1)
        self.assertEqual(
            sum(picking.move_line_ids.mapped('product_uom_qty')), 1)
        self.assertEqual(
            sum(picking.move_line_ids.mapped('qty_done')), 1)
        backorders = self.env['stock.picking'].search(
            [('backorder_id', '=', picking.id)])
        self.assertFalse(backorders)
        picking.action_done()
        self.assertEquals(picking.state, 'done')
        lots = picking.move_line_ids.mapped('lot_id')
        self.assertEquals(len(lots), 1)
        self.assertIn('lot-serial-test-1', lots.mapped('name'))
        location_ids = picking.move_line_ids.mapped('location_id')
        self.assertEquals(len(location_ids), 1)
        self.assertEquals(location_ids[0], self.location_stock_1)
        location_dest_ids = picking.move_line_ids.mapped('location_dest_id')
        self.assertEquals(len(location_dest_ids), 1)
        self.assertEquals(customer_location, location_dest_ids)
        backorders = self.env['stock.picking'].search(
            [('backorder_id', '=', picking.id)])
        self.assertTrue(backorders)
        self.assertEquals(
            sum(backorders.mapped('move_lines.product_uom_qty')), 2)
