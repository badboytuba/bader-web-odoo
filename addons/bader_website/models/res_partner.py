# -*- coding: utf-8 -*-
from odoo import fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    bader_persona = fields.Selection(
        selection=[
            ("clinica", "Clinica Dental"),
            ("laboratorio", "Laboratorio Dental"),
            ("estudiantes", "Estudiantes"),
        ],
        string="Bader Persona",
    )
    bader_onboarding_completed_at = fields.Datetime(
        string="Bader Onboarding Completed At",
    )

    # Clinica fields
    bader_clinic_name = fields.Char(string="Bader Clinic Name")
    bader_clinic_role = fields.Selection(
        selection=[
            ("dueno", "Dueno/a"),
            ("gerente", "Gerente"),
            ("dentista", "Dentista"),
            ("asistente", "Asistente Dental"),
            ("recepcionista", "Recepcionista"),
        ],
        string="Bader Clinic Role",
    )
    bader_clinic_specialties = fields.Text(
        string="Bader Clinic Specialties",
        help="Comma-separated specialty values selected in onboarding.",
    )
    bader_clinic_size = fields.Selection(
        selection=[
            ("pequena", "Pequena (1-2 sillones)"),
            ("mediana", "Mediana (3-5 sillones)"),
            ("grande", "Grande (6+ sillones)"),
        ],
        string="Bader Clinic Size",
    )
    bader_years_experience = fields.Integer(string="Bader Years Experience")

    # Laboratorio fields
    bader_lab_name = fields.Char(string="Bader Lab Name")
    bader_lab_type = fields.Selection(
        selection=[
            ("protesico", "Protesico"),
            ("ortodontico", "Ortodontico"),
            ("cadcam", "CAD/CAM Digital"),
            ("general", "General"),
        ],
        string="Bader Lab Type",
    )
    bader_lab_specialization = fields.Selection(
        selection=[
            ("zirconio", "Zirconio"),
            ("metal-ceramica", "Metal-Ceramica"),
            ("acrilico", "Acrilico"),
            ("alineadores", "Alineadores"),
            ("implantes", "Implantes"),
            ("protesis-removible", "Protesis Removible"),
        ],
        string="Bader Lab Specialization",
    )
    bader_lab_team_size = fields.Selection(
        selection=[
            ("solo", "Solo (1 persona)"),
            ("pequeno", "Pequeno (2-5 personas)"),
            ("mediano", "Mediano (6-15 personas)"),
            ("grande", "Grande (16+ personas)"),
        ],
        string="Bader Lab Team Size",
    )

    # Estudiantes fields
    bader_university = fields.Char(string="Bader University")
    bader_study_year = fields.Selection(
        selection=[
            ("1", "1 Ano"),
            ("2", "2 Ano"),
            ("3", "3 Ano"),
            ("4", "4 Ano"),
            ("5", "5 Ano"),
            ("graduado", "Graduado Reciente"),
        ],
        string="Bader Study Year",
    )
    bader_career = fields.Selection(
        selection=[
            ("odontologia", "Odontologia"),
            ("protesis", "Tecnico en Protesis Dental"),
            ("higienista", "Higienista Dental"),
            ("asistente", "Asistente Dental"),
        ],
        string="Bader Career",
    )
    bader_student_city = fields.Char(string="Bader Student City")
