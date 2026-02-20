from odoo import api, fields, models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    client_order_ref = fields.Char(
        string="Sale Reference",
        compute="_compute_client_order_ref",
        readonly="True",
    )
    number_of_packages = fields.Integer(
        default=1,
    )

    @api.depends("sale_id")
    def _compute_client_order_ref(self):
        for picking in self:
            picking.client_order_ref = picking.sudo().sale_id.client_order_ref

    def action_picking_send(self):
        self.ensure_one()
        action = super().action_picking_send()
        template = self.env.ref(
            "delivery_state.delivery_notification", False,
        )
        ctx = dict(
            default_model="stock.picking",
            default_res_id=self.id,
            default_use_template=bool(template),
            default_template_id=template and template.id or False,
            default_composition_mode="comment",
            user_id=self.env.user.id,
        )
        action["context"] = ctx
        return action

    @api.depends("package_ids")
    def _compute_number_of_packages(self):
        result = super()._compute_number_of_packages()
        for picking in self:
            if not picking.number_of_packages:
                picking.number_of_packages = 1
        return result
