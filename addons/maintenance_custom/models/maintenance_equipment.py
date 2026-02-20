from odoo import _, api, fields, models


class MaintenanceEquipment(models.Model):
    _inherit = "maintenance.equipment"

    lot_id = fields.Many2one(
        comodel_name="stock.lot",
        domain="[('product_id', '=', product_id)]",
    )
    contact_id = fields.Many2one(
        comodel_name="res.partner",
    )

    @api.onchange("lot_id")
    def _onchange_lot_id(self):
        if self.lot_id:
            self.serial_no = self.lot_id.name

    @api.model
    def _get_category(self, category_id):
        return self.env["maintenance.equipment.category"].browse(category_id)

    def _set_activities(self, categories):
        for category in categories:
            user = category.plan_id.maintenance_team_id.user_id
            if not user:
                continue
            for equipment in self:
                equipment.with_context(
                    mail_activity_quick_update=True
                ).activity_schedule(
                    'maintenance_custom.mail_act_equipment_with_plan',
                    fields.Date.today(),
                    _("The equipment %s is just created.",
                      equipment.display_name),
                    user_id=user.id or self.env.uid)

    @api.model_create_multi
    def create(self, val_list):
        categories = self.env["maintenance.equipment.category"]
        for values in val_list:
            if values.get('category_id', False):
                category = self._get_category(values['category_id'])
                if category.exists() and category.plan_id:
                    values['maintenance_plan_ids'] = [(4, category.plan_id.id)]
                    categories |= category
        if categories:
            self._set_activities(categories)
        return super().create(val_list)

    def write(self, values):
        categories = self.env["maintenance.equipment.category"]
        if values.get('category_id', False):
            category = self._get_category(values['category_id'])
            if category.exists() and category.plan_id:
                values['maintenance_plan_ids'] = [(4, category.plan_id.id)]
                categories |= category
        if categories:
            self._set_activities(categories)
        return super().write(values)
