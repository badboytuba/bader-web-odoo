from odoo import api, fields, models


class CrmClaim(models.Model):
    _inherit = "crm.claim"

    costs = fields.Text()
    tests_done = fields.Text()
    comments = fields.Text()
    alternative_contact_id = fields.Many2one(
        comodel_name="res.partner",
    )
    lead_ids = fields.One2many(
        comodel_name="crm.lead",
        inverse_name="claim_id",
        string="Leads",
    )
    lead_count = fields.Integer(
        compute="_compute_lead_count",
    )
    test_operation_id = fields.Many2one(
        comodel_name="crm.test.operation",
        string="Operation Test",
    )
    test_speed_id = fields.Many2one(
        comodel_name="crm.test.speed",
        string="Speed Test",
    )
    speed_result_id = fields.Many2one(
        comodel_name="crm.speed.result",
        string="Speed Result",
    )
    test_torque_id = fields.Many2one(
        comodel_name="crm.test.torque",
        string="Torque Test",
    )
    torque_result_id = fields.Many2one(
        comodel_name="crm.torque.result",
        string="Torque Result",
    )
    test_force_id = fields.Many2one(
        comodel_name="crm.test.force",
        string="Force Test",
    )
    force_result_id = fields.Many2one(
        comodel_name="crm.force.result",
        string="Force Result",
    )
    test_sound_id = fields.Many2one(
        comodel_name="crm.test.sound",
        string="Sound Test",
    )
    sound_result_id = fields.Many2one(
        comodel_name="crm.sound.result",
        string="Sound Result",
    )
    priority = fields.Selection(
        selection_add=[('4', 'Very High')],
    )

    def _compute_lead_count(self):
        for claim in self:
            claim.lead_count = len(claim.lead_ids.ids)

    def _prepare_lead_values(self):
        self.ensure_one()
        return {
            "name": self.code,
            "partner_id": self.partner_id.id,
            "user_id": self.user_id.id,
            "claim_id": self.id,
        }

    def action_create_lead(self):
        Lead = self.env["crm.lead"]
        for claim in self:
            values = claim._prepare_lead_values()
            if values:
                Lead.create(values)
