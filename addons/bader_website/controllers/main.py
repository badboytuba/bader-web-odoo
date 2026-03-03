# -*- coding: utf-8 -*-
import logging
import math
import re
import unicodedata
from datetime import datetime
from urllib.parse import quote
from odoo import http
from odoo.tools import html2plaintext
from odoo.http import request
from odoo.exceptions import UserError
from odoo.addons.auth_signup.controllers.main import AuthSignupHome
from odoo.addons.website.controllers.main import Website
from odoo.addons.website_sale.controllers.main import WebsiteSale
from odoo.addons.http_routing.models.ir_http import slug

_logger = logging.getLogger(__name__)

# ─── Base URL helper ──────────────────────────────────────────
PRODUCTION_DOMAIN = 'https://www.bader4business.com'


def _base_url():
    """Return the production base URL (no trailing slash)."""
    return PRODUCTION_DOMAIN


def _is_spam(kw):
    """Check honeypot field — bots fill hidden 'website_url' field, humans don't."""
    return bool(kw.get('website_url', '').strip())


class BaderWebsiteSale(WebsiteSale):
    """WebsiteSale behavior tuned for /productos public catalog UX."""

    def _get_search_domain(self, search, category, attrib_values, search_in_description=True):
        # Keep search relevance strict on catalog pages: match by product identity fields.
        return super(BaderWebsiteSale, self)._get_search_domain(
            search,
            category,
            attrib_values,
            search_in_description=False,
        )

    def _get_search_options(
        self,
        category=None,
        attrib_values=None,
        pricelist=None,
        min_price=0.0,
        max_price=0.0,
        conversion_rate=1,
        **post
    ):
        options = super(BaderWebsiteSale, self)._get_search_options(
            category=category,
            attrib_values=attrib_values,
            pricelist=pricelist,
            min_price=min_price,
            max_price=max_price,
            conversion_rate=conversion_rate,
            **post
        )
        # Disable fuzzy + description matching to avoid unrelated results.
        options['allowFuzzy'] = False
        options['displayDescription'] = False
        return options


class BaderWebsite(Website):
    """Override homepage to render Bader custom template.
    Also handles CTA form, page routes, and thank-you pages.
    """

    def _current_customer_partner(self):
        """Commercial partner used as customer scope for portal-like pages."""
        return request.env.user.partner_id.commercial_partner_id

    def _render_account_login_required(self, page_title):
        """Render app-like login-required state for account pages."""
        redirect_path = request.httprequest.full_path or request.httprequest.path or '/mi-perfil'
        if redirect_path.endswith('?'):
            redirect_path = redirect_path[:-1]
        login_url = '/web/login?redirect=%s' % quote(redirect_path, safe='/?=&')
        return request.render('bader_website.bader_account_login_required', {
            'page_title': page_title,
            'login_url': login_url,
        })

    def _normalize_home_persona(self, raw_value):
        """Normalize a free-text persona value to clinica/laboratorio/estudiantes."""
        token = (raw_value or '').strip().lower()
        if not token:
            return ''

        aliases = {
            'clinica': 'clinica',
            'clinica-dental': 'clinica',
            'clinic': 'clinica',
            'odontologo': 'clinica',
            'odontologa': 'clinica',
            'laboratorio': 'laboratorio',
            'lab': 'laboratorio',
            'laboratorio-dental': 'laboratorio',
            'estudiantes': 'estudiantes',
            'estudiante': 'estudiantes',
            'student': 'estudiantes',
            'students': 'estudiantes',
        }
        if token in aliases:
            return aliases[token]

        if 'laborat' in token:
            return 'laboratorio'
        if 'estudian' in token:
            return 'estudiantes'
        if 'clinic' in token or 'odont' in token:
            return 'clinica'
        return ''

    def _persona_from_partner(self, partner):
        """Infer homepage persona from partner fields/tags without custom model changes."""
        if not partner:
            return ''

        candidates = []
        candidate_fields = [
            'bader_persona',
            'x_niche',
            'x_studio_niche',
            'x_profile_niche',
            'x_perfil',
            'x_studio_perfil',
            'x_profesion',
            'x_studio_profesion',
            'x_profession',
            'function',
            'title',
            'comment',
        ]
        for field_name in candidate_fields:
            if field_name not in partner._fields:
                continue
            value = partner[field_name]
            if hasattr(value, 'name'):
                value = value.name
            if value:
                candidates.append(value)

        if 'category_id' in partner._fields:
            for tag in partner.category_id:
                candidates.append(tag.name)

        if 'company_name' in partner._fields:
            candidates.append(partner.company_name or '')
        candidates.append(partner.name or '')

        for value in candidates:
            persona = self._normalize_home_persona(value)
            if persona:
                return persona
        return ''

    def _resolve_home_persona(self, kw):
        """Resolve current homepage persona from query, session, or logged user profile."""
        query_persona = self._normalize_home_persona(
            kw.get('persona') or kw.get('perfil') or kw.get('niche')
        )
        if query_persona:
            request.session['bader_home_persona'] = query_persona
            request.session.modified = True
            return query_persona, 'query'

        session_persona = self._normalize_home_persona(
            request.session.get('bader_home_persona')
        )
        if session_persona:
            return session_persona, 'session'

        if not request.website.is_public_user():
            partner_persona = self._persona_from_partner(self._current_customer_partner())
            if partner_persona:
                request.session['bader_home_persona'] = partner_persona
                request.session.modified = True
                return partner_persona, 'profile'

        return 'clinica', 'default'

    def _first_partner_field(self, partner, field_candidates):
        """Return first existing partner field name from candidates."""
        for field_name in field_candidates or []:
            if field_name in partner._fields:
                return field_name
        return ''

    def _read_partner_field_as_text(self, partner, field_name):
        """Read partner field and convert value to plain text for UI usage."""
        if not field_name or field_name not in partner._fields:
            return ''
        value = partner[field_name]
        if not value:
            return ''
        if hasattr(value, 'name'):
            return (value.name or '').strip()
        if isinstance(value, (list, tuple)):
            return ', '.join(str(v).strip() for v in value if v)
        if isinstance(value, bool):
            return 'Si' if value else 'No'
        return str(value).strip()

    def _professional_profile_specs(self):
        """Candidate field map for optional professional profile values."""
        return {
            'persona': [
                'bader_persona',
                'x_niche',
                'x_studio_niche',
                'x_profile_niche',
                'x_perfil',
                'x_studio_perfil',
            ],
            'clinic_name': [
                'bader_clinic_name',
                'x_clinic_name',
                'x_studio_clinic_name',
                'x_nombre_clinica',
                'x_studio_nombre_clinica',
            ],
            'clinic_role': [
                'bader_clinic_role',
                'x_clinic_role',
                'x_studio_clinic_role',
                'x_rol_clinica',
                'x_studio_rol_clinica',
                'function',
            ],
            'clinic_specialties': [
                'bader_clinic_specialties',
                'x_clinic_specialties',
                'x_studio_clinic_specialties',
                'x_especialidades_clinica',
                'x_studio_especialidades_clinica',
            ],
            'clinic_size': [
                'bader_clinic_size',
            ],
            'years_experience': [
                'bader_years_experience',
            ],
            'lab_name': [
                'bader_lab_name',
                'x_lab_name',
                'x_studio_lab_name',
                'x_nombre_laboratorio',
                'x_studio_nombre_laboratorio',
            ],
            'lab_type': [
                'bader_lab_type',
                'x_lab_type',
                'x_studio_lab_type',
                'x_tipo_laboratorio',
                'x_studio_tipo_laboratorio',
            ],
            'lab_specialization': [
                'bader_lab_specialization',
                'x_lab_specialization',
                'x_studio_lab_specialization',
                'x_especializacion_laboratorio',
                'x_studio_especializacion_laboratorio',
            ],
            'lab_team_size': [
                'bader_lab_team_size',
            ],
            'university': [
                'bader_university',
                'x_university',
                'x_studio_university',
                'x_universidad',
                'x_studio_universidad',
            ],
            'study_year': [
                'bader_study_year',
                'x_study_year',
                'x_studio_study_year',
                'x_ano_estudio',
                'x_studio_ano_estudio',
                'x_anio_estudio',
            ],
            'career': [
                'bader_career',
                'x_career',
                'x_studio_career',
                'x_carrera',
                'x_studio_carrera',
            ],
            'student_city': [
                'bader_student_city',
                'x_student_city',
                'x_studio_student_city',
                'x_ciudad_estudiante',
                'x_studio_ciudad_estudiante',
            ],
        }

    def _professional_profile_data(self, partner, fallback_persona=''):
        """Build normalized professional profile payload for account pages."""
        specs = self._professional_profile_specs()
        field_map = {}
        values = {}
        for key, candidates in specs.items():
            field_name = self._first_partner_field(partner, candidates)
            field_map[key] = field_name
            values[key] = self._read_partner_field_as_text(partner, field_name)

        resolved_persona = self._normalize_home_persona(
            values.get('persona') or fallback_persona or request.session.get('bader_home_persona')
        ) or 'clinica'
        values['persona'] = resolved_persona
        persona_label = self._persona_dashboard_config(resolved_persona).get('label')

        if not values.get('clinic_name'):
            values['clinic_name'] = (partner.company_name or '').strip()
        if not values.get('lab_name'):
            values['lab_name'] = (partner.company_name or '').strip()
        if not values.get('clinic_role'):
            values['clinic_role'] = (partner.function or '').strip()

        row_specs = {
            'clinica': [
                {'key': 'clinic_name', 'label': 'Nombre de la clinica', 'icon': 'fa-building-o'},
                {'key': 'clinic_role', 'label': 'Rol en la clinica', 'icon': 'fa-user-md'},
                {'key': 'clinic_specialties', 'label': 'Especialidades', 'icon': 'fa-stethoscope'},
            ],
            'laboratorio': [
                {'key': 'lab_name', 'label': 'Nombre del laboratorio', 'icon': 'fa-flask'},
                {'key': 'lab_type', 'label': 'Tipo de laboratorio', 'icon': 'fa-cogs'},
                {'key': 'lab_specialization', 'label': 'Especializacion', 'icon': 'fa-magic'},
            ],
            'estudiantes': [
                {'key': 'university', 'label': 'Universidad', 'icon': 'fa-university'},
                {'key': 'study_year', 'label': 'Ano de estudio', 'icon': 'fa-calendar'},
                {'key': 'career', 'label': 'Carrera', 'icon': 'fa-book'},
                {'key': 'student_city', 'label': 'Ciudad', 'icon': 'fa-map-marker'},
            ],
        }

        rows = []
        for spec in row_specs.get(resolved_persona, []):
            value = (values.get(spec['key']) or '').strip()
            if value:
                rows.append({
                    'key': spec['key'],
                    'label': spec['label'],
                    'icon': spec['icon'],
                    'value': value,
                })

        has_data = bool(rows)
        if not rows:
            rows = [{
                'key': 'empty',
                'label': 'Perfil profesional',
                'icon': 'fa-info-circle',
                'value': 'Completa tus datos en Configuracion para mejorar recomendaciones.',
                'empty': True,
            }]

        available_keys = {
            key: bool(field_map.get(key))
            for key in specs.keys()
        }

        return {
            'persona': resolved_persona,
            'persona_label': persona_label,
            'field_map': field_map,
            'values': values,
            'rows': rows,
            'has_data': has_data,
            'available_keys': available_keys,
        }

    def _coerce_partner_field_value(self, partner, field_name, raw_value):
        """Convert input text to a writable value based on partner field type."""
        if not field_name or field_name not in partner._fields:
            return False, None

        field = partner._fields[field_name]
        text_value = (raw_value or '').strip()
        if field.type in ('char', 'text', 'html'):
            return True, text_value

        if field.type == 'selection':
            selection = field.selection(partner.env) if callable(field.selection) else field.selection
            selection = selection or []
            if not selection:
                return True, text_value
            if text_value in dict(selection):
                return True, text_value

            normalized_input = self._normalize_search_text(text_value)
            for key, label in selection:
                if normalized_input and normalized_input == self._normalize_search_text(key):
                    return True, key
                if normalized_input and normalized_input == self._normalize_search_text(label):
                    return True, key
            return False, None

        return False, None

    def _professional_profile_write_vals(self, partner, post):
        """Build writable partner values from professional profile form inputs."""
        profile_data = self._professional_profile_data(partner)
        field_map = profile_data.get('field_map', {})
        input_map = {
            'profile_clinic_name': 'clinic_name',
            'profile_clinic_role': 'clinic_role',
            'profile_clinic_specialties': 'clinic_specialties',
            'profile_lab_name': 'lab_name',
            'profile_lab_type': 'lab_type',
            'profile_lab_specialization': 'lab_specialization',
            'profile_university': 'university',
            'profile_study_year': 'study_year',
            'profile_career': 'career',
            'profile_student_city': 'student_city',
        }

        vals = {}
        for post_key, profile_key in input_map.items():
            field_name = field_map.get(profile_key)
            if not field_name:
                continue
            write_ok, value = self._coerce_partner_field_value(
                partner, field_name, post.get(post_key)
            )
            if write_ok:
                vals[field_name] = value

        selected_persona = self._normalize_home_persona(post.get('persona_preference'))
        if selected_persona:
            request.session['bader_home_persona'] = selected_persona
            request.session.modified = True
            persona_field = field_map.get('persona')
            write_ok, value = self._coerce_partner_field_value(
                partner, persona_field, selected_persona
            )
            if write_ok:
                vals[persona_field] = value

        return vals

    def _onboarding_profile_payload(self, partner):
        """Serialize partner professional profile for onboarding frontend."""
        specialties_raw = (partner.bader_clinic_specialties or '').strip()
        specialties = []
        if specialties_raw:
            specialties = [
                item.strip() for item in specialties_raw.split(',')
                if item and item.strip()
            ]

        return {
            'persona': self._normalize_home_persona(partner.bader_persona) or '',
            'onboarding_completed_at': (
                partner.bader_onboarding_completed_at.isoformat()
                if partner.bader_onboarding_completed_at else ''
            ),
            'clinic_name': (partner.bader_clinic_name or '').strip(),
            'clinic_role': (partner.bader_clinic_role or '').strip(),
            'clinic_specialties': specialties,
            'clinic_size': (partner.bader_clinic_size or '').strip(),
            'years_experience': int(partner.bader_years_experience or 0),
            'lab_name': (partner.bader_lab_name or '').strip(),
            'lab_type': (partner.bader_lab_type or '').strip(),
            'lab_specialization': (partner.bader_lab_specialization or '').strip(),
            'lab_team_size': (partner.bader_lab_team_size or '').strip(),
            'university': (partner.bader_university or '').strip(),
            'study_year': (partner.bader_study_year or '').strip(),
            'career': (partner.bader_career or '').strip(),
            'student_city': (partner.bader_student_city or '').strip(),
        }

    def _normalize_search_text(self, raw_text):
        """Lowercase + strip accents to support tolerant keyword matching."""
        text = (raw_text or '').strip().lower()
        if not text:
            return ''
        normalized = unicodedata.normalize('NFKD', text)
        return ''.join(ch for ch in normalized if not unicodedata.combining(ch))

    def _persona_dashboard_config(self, persona):
        """UI/content config for account dashboard by persona."""
        persona_map = {
            'clinica': {
                'label': 'Clinica Dental',
                'badge_icon': 'fa-medkit',
                'subtitle': (
                    'Panel personalizado para clinicas: productos clave, ofertas '
                    'relevantes y recomendaciones para tu practica.'
                ),
                'primary_href': '/productos?niche=clinica-dental',
                'primary_label': 'Ver catalogo clinico',
                'resource_title': 'Tips para clinica',
                'resource_intro': 'Recomendaciones para optimizar la atencion y el equipamiento.',
                'resource_entries': [
                    {'icon': 'fa-stethoscope', 'title': 'Bioseguridad al dia', 'description': 'Revisa protocolos de esterilizacion y mantenimiento del autoclave.'},
                    {'icon': 'fa-clock-o', 'title': 'Gestion de turnos', 'description': 'Configura buffers de 10-15 minutos para evitar retrasos en cascada.'},
                    {'icon': 'fa-line-chart', 'title': 'Inventario minimo', 'description': 'Mantener stock de 2-3 meses evita quiebres en productos de alta rotacion.'},
                ],
                'tips_title': 'Acciones sugeridas',
                'tips_intro': 'Atajos de trabajo para tu operacion diaria.',
                'tips_entries': [
                    {'icon': 'fa-heart-o', 'title': 'Guardar favoritos', 'description': 'Marca productos clave para reponerlos rapido desde tu cuenta.'},
                    {'icon': 'fa-truck', 'title': 'Planificar compras', 'description': 'Consolida pedidos para mejorar tiempos y costos de envio.'},
                    {'icon': 'fa-comments-o', 'title': 'Asesoria tecnica', 'description': 'Consulta compatibilidades de equipos antes de cerrar una inversion.'},
                ],
                'product_keywords': ['sillon', 'autoclave', 'rayos', 'compresor', 'rotatorio', 'clinica'],
                'whatsapp_message': 'Hola, soy cliente de Clinica Dental y necesito asesoria de productos.',
            },
            'laboratorio': {
                'label': 'Laboratorio Dental',
                'badge_icon': 'fa-flask',
                'subtitle': (
                    'Panel para laboratorios: recursos tecnicos, ofertas por especialidad '
                    'y productos para flujo de produccion.'
                ),
                'primary_href': '/productos?niche=laboratorio-dental',
                'primary_label': 'Ver catalogo laboratorio',
                'resource_title': 'Recursos tecnicos',
                'resource_intro': 'Material util para procesos y calidad en laboratorio.',
                'resource_entries': [
                    {'icon': 'fa-cogs', 'title': 'Calibracion CAD/CAM', 'description': 'Verifica offset y estado de fresas para mejorar ajuste final.'},
                    {'icon': 'fa-files-o', 'title': 'Protocolos por material', 'description': 'Documenta parametros de zirconia, metal-ceramica y resinas.'},
                    {'icon': 'fa-wrench', 'title': 'Mantenimiento preventivo', 'description': 'Agenda revisiones para evitar paradas de produccion.'},
                ],
                'tips_title': 'Buenas practicas',
                'tips_intro': 'Rutinas recomendadas para mayor precision.',
                'tips_entries': [
                    {'icon': 'fa-check-square-o', 'title': 'Checklist diario', 'description': 'Controla equipos y consumibles al inicio de cada turno.'},
                    {'icon': 'fa-archive', 'title': 'Stock estrategico', 'description': 'Mantener insumos criticos para 2 semanas reduce riesgo operativo.'},
                    {'icon': 'fa-camera', 'title': 'Registro de casos', 'description': 'Documenta resultados para seguimiento y mejora continua.'},
                ],
                'product_keywords': ['laboratorio', 'mesa', 'repasado', 'arenadora', 'articulador', 'termoformadora', 'zirconia', 'cad'],
                'whatsapp_message': 'Hola, soy cliente de Laboratorio Dental y necesito soporte tecnico/comercial.',
            },
            'estudiantes': {
                'label': 'Estudiantes',
                'badge_icon': 'fa-graduation-cap',
                'subtitle': (
                    'Panel para estudiantes: kits sugeridos, recursos de aprendizaje '
                    'y ofertas para etapa academica.'
                ),
                'primary_href': '/productos?niche=estudiantes',
                'primary_label': 'Ver catalogo estudiantes',
                'resource_title': 'Recursos de estudio',
                'resource_intro': 'Material de apoyo para avanzar en tu formacion.',
                'resource_entries': [
                    {'icon': 'fa-book', 'title': 'Instrumental basico', 'description': 'Guia practica para reconocer y usar instrumental esencial.'},
                    {'icon': 'fa-video-camera', 'title': 'Tutoriales', 'description': 'Videos paso a paso con tecnicas frecuentes de practica.'},
                    {'icon': 'fa-download', 'title': 'Fichas descargables', 'description': 'Apuntes y checklists para laboratorio y clinica.'},
                ],
                'tips_title': 'Consejos para cursada',
                'tips_intro': 'Sugerencias para comprar mejor y practicar con foco.',
                'tips_entries': [
                    {'icon': 'fa-shield', 'title': 'Cuidar instrumental', 'description': 'Limpieza y esterilizacion correctas prolongan vida util.'},
                    {'icon': 'fa-puzzle-piece', 'title': 'Armar kit gradual', 'description': 'Prioriza compras segun materias y practicas del ano.'},
                    {'icon': 'fa-users', 'title': 'Comunidad', 'description': 'Compartir experiencias acelera aprendizaje y decisiones de compra.'},
                ],
                'product_keywords': ['kit', 'simulador', 'tipodonto', 'fantoma', 'estudiante', 'diente', 'accesorio'],
                'whatsapp_message': 'Hola, soy estudiante y necesito ayuda para elegir mi kit.',
            },
        }
        return persona_map.get(persona, persona_map['clinica'])

    def _build_product_search_blob(self, product):
        """Build normalized text blob for quick keyword match."""
        parts = [product.name or '', product.default_code or '']
        if 'description_sale' in product._fields and product.description_sale:
            parts.append(html2plaintext(product.description_sale))
        if 'website_description' in product._fields and product.website_description:
            parts.append(html2plaintext(product.website_description))
        if 'public_categ_ids' in product._fields:
            parts.extend(product.public_categ_ids.mapped('name'))
        return self._normalize_search_text(' '.join(filter(None, parts)))

    def _build_persona_dashboard_products(self, persona):
        """Return persona-focused offer/recommended products for account dashboard."""
        config = self._persona_dashboard_config(persona)
        keywords = [self._normalize_search_text(k) for k in config.get('product_keywords', []) if k]

        pricelist = request.website.get_current_pricelist()
        products_model = request.env['product.template'].sudo().with_context(
            website_id=request.website.id,
            pricelist=pricelist.id,
            partner=request.env.user.partner_id.id,
            lang=request.context.get('lang')
        )
        candidates = products_model.search(
            [('website_published', '=', True), ('sale_ok', '=', True)],
            order='website_sequence asc, id desc',
            limit=90
        )
        ordered_products = list(candidates)
        if keywords:
            matched = []
            unmatched = []
            for prod in ordered_products:
                blob = self._build_product_search_blob(prod)
                if blob and any(key in blob for key in keywords):
                    matched.append(prod)
                else:
                    unmatched.append(prod)
            if matched:
                ordered_products = matched + unmatched

        offer_ids = []
        for prod in ordered_products:
            compare_price = float(prod.compare_list_price or 0.0) if 'compare_list_price' in prod._fields else 0.0
            list_price = float(prod.list_price or 0.0)
            if compare_price > list_price:
                offer_ids.append(prod.id)
            if len(offer_ids) >= 4:
                break
        if not offer_ids:
            offer_ids = [prod.id for prod in ordered_products[:4]]

        offer_set = set(offer_ids)
        recommended_ids = [prod.id for prod in ordered_products if prod.id not in offer_set][:6]

        return {
            'offers': products_model.browse(offer_ids),
            'recommended': products_model.browse(recommended_ids),
            'pricelist': pricelist,
            'currency': pricelist.currency_id,
        }

    def _order_domain_for_partner(self, partner):
        """Orders linked to the customer and child contacts."""
        return [
            ('partner_id', 'child_of', partner.id),
            ('state', 'not in', ['draft', 'cancel']),
        ]

    def _invoice_domain_for_partner(self, partner):
        """Customer invoices linked to the customer and child contacts."""
        return [
            ('partner_id', 'child_of', partner.id),
            ('move_type', 'in', ['out_invoice', 'out_refund']),
            ('state', '=', 'posted'),
        ]

    def _find_sale_order_by_token(self, token):
        """Resolve public sale order token to a sale.order record."""
        if not token:
            return request.env['sale.order']
        return request.env['sale.order'].sudo().search(
            [('access_token', '=', token)],
            limit=1
        )

    def _descargas_catalogs(self):
        """Catalog list aligned with Bader-AR download page."""
        return [
            {
                'id': 1,
                'title': 'Catalogo General',
                'description': 'Catalogo completo con todos los productos Bader para profesionales dentales.',
                'image': 'https://bader.com.ar/web/image/7420-92f24f98/Catalogo-general-263x300-_1_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/catalogo-general-bader-es.pdf',
                'category': 'general',
                'available': True,
                'featured': True,
                'pages': '120+',
                'year': '2024',
            },
            {
                'id': 2,
                'title': 'Fantasia Dental',
                'description': 'Coleccion exclusiva de productos para tratamientos esteticos y restauraciones.',
                'image': 'https://bader.com.ar/web/image/7431-8afd337c/Fantasia-dental-263x300-_2_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/catalogo-fantasia-dental-2023-es.pdf',
                'category': 'clinica',
                'available': True,
                'featured': False,
                'pages': '48',
                'year': '2023',
            },
            {
                'id': 3,
                'title': 'Sillones Dentales',
                'description': 'Equipos dentales de ultima generacion para clinicas modernas.',
                'image': 'https://bader.com.ar/web/image/7437-2a297382/Mockup-sillones-dentales-1024x825-_2_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/catalogo-equipos-dentales-bader-europe-group.pdf',
                'category': 'equipos',
                'available': True,
                'featured': True,
                'pages': '64',
                'year': '2024',
            },
            {
                'id': 4,
                'title': 'Fantomas y Tipodontos',
                'description': 'Modelos de practica y simulacion para formacion odontologica.',
                'image': 'https://bader.com.ar/web/image/7433-4aeb8a3e/Iconos-fantoma-e-tipodontos-263x300.png',
                'download_url': '/bader_website/static/src/pdf/descargas/catalogo-tipodontos-y-fantomas-2023-es.pdf',
                'category': 'formacion',
                'available': True,
                'featured': False,
                'pages': '32',
                'year': '2023',
            },
            {
                'id': 5,
                'title': 'Linea de Endodoncia',
                'description': 'Instrumental especializado para tratamientos de conducto.',
                'image': 'https://bader.com.ar/web/image/7434-23bdbe94/folleto-endodoncia-263x300-_1_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/folleto-endodoncia-2019-es.pdf',
                'category': 'instrumental',
                'available': False,
                'featured': False,
                'pages': '24',
                'year': '2019',
            },
            {
                'id': 6,
                'title': 'Fresas y Abrasivos',
                'description': 'Amplia gama de fresas dentales y materiales abrasivos de alta calidad.',
                'image': 'https://bader.com.ar/web/image/7432-571e95bf/fresas-bader-263x300-_1_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/folleto-fresas-bader-1.pdf',
                'category': 'instrumental',
                'available': False,
                'featured': False,
                'pages': '36',
                'year': '2023',
            },
            {
                'id': 7,
                'title': 'Mobiliario para Clinica',
                'description': 'Muebles y equipamiento para disenar tu clinica dental perfecta.',
                'image': 'https://bader.com.ar/web/image/7435-1ac7adde/Iconos-descargas-mobiliario-clinica-263x300-_1_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/catalago-muebles-clinica-dental.pdf',
                'category': 'mobiliario',
                'available': True,
                'featured': False,
                'pages': '28',
                'year': '2024',
            },
            {
                'id': 8,
                'title': 'Instrumental Dental',
                'description': 'Catalogo completo de instrumental odontologico profesional.',
                'image': 'https://bader.com.ar/web/image/7436-201c1214/Instrumental-bader-263x300-_2_.png',
                'download_url': '/bader_website/static/src/pdf/descargas/catalogo-instrumental-es.pdf',
                'category': 'instrumental',
                'available': True,
                'featured': True,
                'pages': '84',
                'year': '2024',
            },
        ]

    def _blog_models_available(self):
        """Check if website_blog models are installed in this database."""
        return 'blog.post' in request.env and 'blog.blog' in request.env

    def _build_intelligent_shop_tree(self):
        """Return niche > type > subcategory tree based on Odoo public categories."""
        category_model = request.env['product.public.category'].sudo().with_context(lang='es_ES')
        product_model = request.env['product.template'].sudo()

        roots = category_model.search([
            ('parent_id', '=', False),
        ], order='sequence, id')

        niche_specs = [
            {
                'key': 'clinica',
                'display_name': 'Clinica Dental',
                'icon': 'fa-hospital-o',
                'color': '#70D44B',
                'keywords': ['clinica', 'clínica'],
            },
            {
                'key': 'laboratorio',
                'display_name': 'Laboratorio Dental',
                'icon': 'fa-flask',
                'color': '#8B5CF6',
                'keywords': ['laboratorio'],
            },
            {
                'key': 'estudiantes',
                'display_name': 'Estudiantes',
                'icon': 'fa-graduation-cap',
                'color': '#F59E0B',
                'keywords': ['estudiantes', 'estudiante'],
            },
        ]

        def _normalize(text):
            return (text or '').strip().lower()

        def _product_count(cat_id):
            return product_model.search_count([
                ('website_published', '=', True),
                ('public_categ_ids', 'child_of', cat_id),
            ])

        def _pick_root(spec):
            for cat in roots:
                cat_name = _normalize(cat.name)
                if any(keyword in cat_name for keyword in spec['keywords']):
                    return cat
            return category_model.browse()

        def _build_node(cat):
            descendants = category_model.search([('id', 'child_of', cat.id)], order='id')
            children = category_model.search([
                ('parent_id', '=', cat.id),
            ], order='sequence, id')
            node = {
                'category_id': cat.id,
                'display_name': cat.name,
                'url': '/productos/category/%s' % slug(cat),
                'product_count': _product_count(cat.id),
                'descendant_ids': descendants.ids,
                'subcategories': [],
            }
            for child in children:
                child_desc = category_model.search([('id', 'child_of', child.id)], order='id')
                subchildren = category_model.search([
                    ('parent_id', '=', child.id),
                ], order='sequence, id')
                child_node = {
                    'category_id': child.id,
                    'display_name': child.name,
                    'url': '/productos/category/%s' % slug(child),
                    'product_count': _product_count(child.id),
                    'descendant_ids': child_desc.ids,
                    'subcategories': [],
                }
                for sub in subchildren:
                    child_node['subcategories'].append({
                        'category_id': sub.id,
                        'display_name': sub.name,
                        'url': '/productos/category/%s' % slug(sub),
                        'product_count': _product_count(sub.id),
                    })
                node['subcategories'].append(child_node)
            return node

        niches = []
        for spec in niche_specs:
            root = _pick_root(spec)
            if not root:
                continue
            root_node = _build_node(root)
            niches.append({
                'id': spec['key'],
                'display_name': spec['display_name'],
                'icon': spec['icon'],
                'color': spec['color'],
                'category_id': root_node['category_id'],
                'url': root_node['url'],
                'product_count': root_node['product_count'],
                'descendant_ids': root_node['descendant_ids'],
                'types': root_node['subcategories'],
            })

        return {'niches': niches}

    def _blog_cover_url(self, post):
        """Best-effort cover image URL from Odoo blog post."""
        cover_props = (post.cover_properties or '').strip()
        if cover_props:
            match = re.search(r"url\((['\"]?)([^'\")]+)\1\)", cover_props)
            if match and match.group(2):
                return match.group(2)

        if 'image_1920' in post._fields:
            return '/web/image/blog.post/%s/image_1920' % post.id

        return '/bader_website/static/src/img/bader_logotipo.png'

    def _blog_excerpt(self, post, max_chars=180):
        """Plain-text excerpt from subtitle/content."""
        raw = post.subtitle or html2plaintext(post.content or '')
        text = re.sub(r'\s+', ' ', (raw or '')).strip()
        if len(text) <= max_chars:
            return text
        return text[:max_chars].rstrip() + '...'

    def _blog_reading_time(self, post):
        """Approximate reading time in minutes."""
        text = html2plaintext(post.content or '')
        words = len(re.findall(r'\w+', text or '', flags=re.UNICODE))
        return max(1, int(math.ceil(words / 180.0)))

    def _prepare_blog_cards(self, posts):
        """Normalize blog.post records for frontend templates."""
        cards = []
        for post in posts:
            date_value = post.post_date or post.create_date
            cards.append({
                'id': post.id,
                'title': post.name or 'Sin titulo',
                'excerpt': self._blog_excerpt(post),
                'category': post.blog_id.name if post.blog_id else 'Blog',
                'date': date_value,
                'date_label': date_value.strftime('%d/%m/%Y') if date_value else '',
                'read_minutes': self._blog_reading_time(post),
                'view_count': getattr(post, 'visits', 0) or 0,
                'cover_url': self._blog_cover_url(post),
                'url': '/blog/%s' % slug(post),
            })
        return cards

    def _blog_product_keywords(self, post, max_terms=10):
        """Extract lightweight keywords from blog post content."""
        if not post:
            return []

        source = ' '.join(filter(None, [
            post.name or '',
            post.subtitle or '',
            html2plaintext(post.content or '')[:1500],
        ]))

        tokens = re.findall(
            r"[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]{4,}",
            source or '',
            flags=re.UNICODE,
        )
        stopwords = {
            'para', 'este', 'esta', 'estas', 'estos', 'sobre', 'desde', 'como',
            'donde', 'cuando', 'entre', 'todos', 'todas', 'nuestro', 'nuestra',
            'nuestras', 'nuestros', 'blog', 'bader', 'dental', 'dentales',
            'producto', 'productos', 'equipo', 'equipos', 'guia', 'guias',
            'articulo', 'articulos', 'profesional', 'profesionales', 'clinica',
            'clinicas', 'laboratorio', 'laboratorios', 'estudiante', 'estudiantes',
        }

        keywords = []
        for token in tokens:
            key = token.lower().strip()
            if not key or key in stopwords or key.isdigit():
                continue
            if key not in keywords:
                keywords.append(key)
            if len(keywords) >= max_terms:
                break
        return keywords

    def _prepare_related_blog_products(self, post, limit=4):
        """Pick related published products from blog content keywords."""
        if not post:
            return []

        product_tmpl_model = request.env['product.template'].sudo().with_context(
            website_id=request.website.id
        )
        base_domain = [
            ('website_published', '=', True),
            ('sale_ok', '=', True),
        ]
        keywords = self._blog_product_keywords(post, max_terms=12)

        candidate_ids = []
        for term in keywords:
            matched = product_tmpl_model.search(
                base_domain + ['|', '|',
                               ('name', 'ilike', term),
                               ('default_code', 'ilike', term),
                               ('description_sale', 'ilike', term)],
                limit=max(limit * 2, 6),
            )
            for tmpl in matched:
                if tmpl.id not in candidate_ids:
                    candidate_ids.append(tmpl.id)
            if len(candidate_ids) >= limit * 3:
                break

        if not candidate_ids:
            fallback = product_tmpl_model.search(
                base_domain,
                order='website_sequence asc, id desc',
                limit=limit,
            )
            candidate_ids = fallback.ids

        pricelist = request.website.get_current_pricelist()
        cards = []
        for tmpl in product_tmpl_model.browse(candidate_ids[:limit]):
            variant = tmpl.product_variant_id or tmpl.product_variant_ids[:1]
            price = tmpl.list_price
            try:
                if variant:
                    combination = variant._get_combination_info_variant(
                        pricelist=pricelist,
                    )
                    price = combination.get('price', price)
            except Exception:
                price = tmpl.list_price

            in_stock = True
            if 'qty_available' in tmpl._fields and tmpl.type != 'service':
                in_stock = (tmpl.qty_available or 0) > 0

            cards.append({
                'product_tmpl_id': tmpl.id,
                'product_id': variant.id if variant else False,
                'name': tmpl.name,
                'category': tmpl.public_categ_ids[:1].name if tmpl.public_categ_ids else '',
                'price': price,
                'in_stock': in_stock,
                'image_url': '/web/image/product.template/%s/image_512' % tmpl.id,
                'url': '/producto/%s' % tmpl.id,
            })
        return cards

    def _resolve_blog_post(self, post_slug):
        """Resolve a /blog/<slug> path to a published blog.post record."""
        if not post_slug or not self._blog_models_available():
            return False

        post_model = request.env['blog.post'].sudo()
        domain = [('website_published', '=', True)]
        post = False
        post_id = None

        if post_slug.isdigit():
            post_id = int(post_slug)
        else:
            match = re.search(r'-(\d+)$', post_slug)
            if match:
                post_id = int(match.group(1))

        if post_id:
            post = post_model.search(domain + [('id', '=', post_id)], limit=1)

        if not post:
            name_guess = post_slug.replace('-', ' ')
            post = post_model.search(
                domain + [('name', 'ilike', name_guess)],
                order='post_date desc, id desc',
                limit=1,
            )

        return post

    # ─── robots.txt ────────────────────────────────────────────
    @http.route('/robots.txt', type='http', auth='public', sitemap=False, csrf=False)
    def robots_txt(self, **kw):
        """Serve dynamic robots.txt."""
        base = _base_url()
        body = (
            'User-agent: *\n'
            'Allow: /\n'
            'Disallow: /web/\n'
            'Disallow: /web#\n'
            'Disallow: /my/\n'
            'Disallow: /website/\n'
            'Disallow: /bader/cta-form\n'
            'Disallow: /bader/distribuidor-form\n'
            'Disallow: /bader/servicio-form\n'
            'Disallow: /contacto/gracias\n'
            'Disallow: /ser-distribuidor/gracias\n'
            'Disallow: /servicios/gracias\n'
            '\n'
            f'Sitemap: {base}/sitemap.xml\n'
        )
        return request.make_response(
            body, [('Content-Type', 'text/plain; charset=utf-8')]
        )

    # ─── sitemap.xml ───────────────────────────────────────────
    @http.route('/sitemap.xml', type='http', auth='public', sitemap=False, csrf=False)
    def sitemap_xml(self, **kw):
        """Serve dynamic sitemap with static pages, categories, and products."""
        base = _base_url()
        today = datetime.now().strftime('%Y-%m-%d')

        # Static pages with priorities
        static_pages = [
            ('/', '1.0', 'daily'),
            ('/productos', '0.9', 'daily'),
            ('/clinica-dental', '0.8', 'weekly'),
            ('/laboratorio-dental', '0.8', 'weekly'),
            ('/estudiantes-odontologia', '0.8', 'weekly'),
            ('/sobre-nosotros', '0.7', 'monthly'),
            ('/ser-distribuidor', '0.7', 'monthly'),
            ('/servicios', '0.7', 'monthly'),
            ('/descargas', '0.6', 'monthly'),
            ('/ayuda', '0.6', 'monthly'),
            ('/blog', '0.6', 'weekly'),
        ]

        urls = []
        for path, priority, freq in static_pages:
            urls.append(
                f'  <url>\n'
                f'    <loc>{base}{path}</loc>\n'
                f'    <lastmod>{today}</lastmod>\n'
                f'    <changefreq>{freq}</changefreq>\n'
                f'    <priority>{priority}</priority>\n'
                f'  </url>'
            )

        # Dynamic: product public categories
        try:
            categories = request.env['product.public.category'].sudo().search(
                [('website_published', '=', True)], order='id'
            )
            for cat in categories:
                slug_val = '%s-%d' % (
                    cat.name.lower().replace(' ', '-'), cat.id
                )
                urls.append(
                    f'  <url>\n'
                    f'    <loc>{base}/shop/category/{slug_val}</loc>\n'
                    f'    <changefreq>weekly</changefreq>\n'
                    f'    <priority>0.6</priority>\n'
                    f'  </url>'
                )
        except Exception:
            pass  # categories might not have website_published field

        # Dynamic: published products
        try:
            products = request.env['product.template'].sudo().search(
                [('website_published', '=', True)], order='id', limit=5000
            )
            for prod in products:
                slug_val = '%s-%d' % (
                    (prod.name or 'product').lower().replace(' ', '-')[:50],
                    prod.id
                )
                urls.append(
                    f'  <url>\n'
                    f'    <loc>{base}/shop/{slug_val}</loc>\n'
                    f'    <changefreq>weekly</changefreq>\n'
                    f'    <priority>0.5</priority>\n'
                    f'  </url>'
                )
        except Exception:
            pass

        xml_body = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + '\n'.join(urls) + '\n'
            '</urlset>\n'
        )
        return request.make_response(
            xml_body, [('Content-Type', 'application/xml; charset=utf-8')]
        )

    # ─── Homepage ──────────────────────────────────────────────
    @http.route('/', type='http', auth='public', website=True, sitemap=True)
    def index(self, **kw):
        """Override the main homepage to render Bader template."""
        persona, source = self._resolve_home_persona(kw)
        persona_map = {
            'clinica': {
                'label': 'Clinica Dental',
                'cta_label': 'Equipar mi clinica',
                'cta_href': '/clinica-dental',
            },
            'laboratorio': {
                'label': 'Laboratorio Dental',
                'cta_label': 'Ver equipos para lab',
                'cta_href': '/laboratorio-dental',
            },
            'estudiantes': {
                'label': 'Estudiantes',
                'cta_label': 'Plan estudiantes',
                'cta_href': '/estudiantes-odontologia',
            },
        }
        persona_meta = persona_map.get(persona, persona_map['clinica'])
        return request.render('bader_website.bader_homepage', {
            'homepage_persona': persona,
            'homepage_persona_label': persona_meta['label'],
            'homepage_persona_cta_label': persona_meta['cta_label'],
            'homepage_persona_cta_href': persona_meta['cta_href'],
            'homepage_persona_locked': source == 'profile',
            'homepage_persona_autorotate': source == 'default',
            'home_is_logged': not request.website.is_public_user(),
        })

    @http.route([
        '/productos',
        '/productos/page/<int:page>',
        '/productos/category/<model("product.public.category"):category>',
        '/productos/category/<model("product.public.category"):category>/page/<int:page>',
    ], type='http', auth='public', website=True, sitemap=True)
    def productos(self, page=0, category=None, search='', ppg=False, **post):
        """Serve product catalog on /productos to match Bader-AR public URLs."""
        return BaderWebsiteSale().shop(
            page=page,
            category=category,
            search=search,
            ppg=ppg,
            **post
        )

    @http.route('/producto/<int:product_id>', type='http', auth='public',
                website=True, sitemap=False)
    def producto_por_id(self, product_id, **kw):
        """Frontend alias for product detail page by id."""
        product = request.env['product.template'].sudo().browse(product_id)
        if not product.exists() or not product.website_published:
            return request.not_found()
        return request.redirect('/shop/product/%s' % slug(product))

    @http.route('/checkout', type='http', auth='public', website=True, sitemap=False)
    def checkout_alias(self, **kw):
        """Frontend alias for checkout flow."""
        return request.redirect('/shop/checkout')

    @http.route('/mi-perfil', type='http', auth='public', website=True, sitemap=False)
    def mi_perfil(self, **kw):
        """Customer account dashboard fully backed by Odoo data."""
        if request.website.is_public_user():
            return self._render_account_login_required('Mi perfil')

        partner = self._current_customer_partner()
        user = request.env.user
        persona, _source = self._resolve_home_persona(kw)
        persona_config = self._persona_dashboard_config(persona)
        persona_products = self._build_persona_dashboard_products(persona)
        orders = request.env['sale.order']
        recent_orders = request.env['sale.order']
        recent_invoices = []
        order_count = 0
        wishlist_count = 0
        invoice_count = 0
        invoices_available = 'account.move' in request.env
        order_state_labels = dict(request.env['sale.order']._fields['state'].selection)
        invoice_payment_labels = {}
        account_sales_total = 0.0
        account_open_invoice_total = 0.0
        account_open_invoice_count = 0
        load_error = False
        try:
            sale_order = request.env['sale.order'].sudo()
            order_domain = self._order_domain_for_partner(partner)
            orders = sale_order.search(order_domain, order='date_order desc', limit=5)
            recent_orders = orders[:3]
            order_count = sale_order.search_count(order_domain)
            summary_orders = sale_order.search(order_domain, order='date_order desc', limit=80)
            account_sales_total = sum(summary_orders.mapped('amount_total'))

            wishlist_count = request.env['product.wishlist'].sudo().search_count([
                ('partner_id', '=', request.env.user.partner_id.id),
                ('website_id', '=', request.website.id),
                ('active', '=', True),
            ])

            if invoices_available:
                account_move = request.env['account.move'].sudo()
                invoice_domain = self._invoice_domain_for_partner(partner)
                invoice_count = account_move.search_count(invoice_domain)
                recent_invoices = account_move.search(
                    invoice_domain,
                    order='invoice_date desc, id desc',
                    limit=3
                )
                open_invoice_domain = invoice_domain + [
                    ('payment_state', 'in', ['not_paid', 'partial']),
                ]
                account_open_invoice_count = account_move.search_count(open_invoice_domain)
                open_invoices = account_move.search(
                    open_invoice_domain,
                    order='invoice_date desc, id desc',
                    limit=80
                )
                account_open_invoice_total = sum(open_invoices.mapped('amount_residual'))
                invoice_payment_labels = dict(
                    request.env['account.move']._fields['payment_state'].selection
                )
        except Exception as exc:
            load_error = True
            _logger.error("Mi perfil load error for partner %s: %s", partner.id, exc)

        member_since = user.create_date.strftime('%d/%m/%Y') if user.create_date else ''
        profile_initial = ((partner.name or 'U').strip()[:1] or 'U').upper()
        whatsapp_url = 'https://wa.me/5491124522097?text=%s' % quote(
            persona_config.get('whatsapp_message', 'Hola, necesito ayuda.'),
            safe=''
        )
        professional_profile = self._professional_profile_data(
            partner, fallback_persona=persona
        )

        return request.render('bader_website.bader_mi_perfil', {
            'partner': partner,
            'orders': orders,
            'recent_orders': recent_orders,
            'recent_invoices': recent_invoices,
            'order_count': order_count,
            'invoice_count': invoice_count,
            'wishlist_count': wishlist_count,
            'last_order': orders[:1],
            'member_since': member_since,
            'profile_initial': profile_initial,
            'load_error': load_error,
            'account_sales_total': account_sales_total,
            'account_open_invoice_total': account_open_invoice_total,
            'account_open_invoice_count': account_open_invoice_count,
            'account_invoices_available': invoices_available,
            'account_order_state_labels': order_state_labels,
            'account_invoice_payment_labels': invoice_payment_labels,
            'dashboard_persona': persona,
            'dashboard_persona_label': persona_config.get('label'),
            'dashboard_persona_badge_icon': persona_config.get('badge_icon'),
            'dashboard_persona_subtitle': persona_config.get('subtitle'),
            'dashboard_primary_href': persona_config.get('primary_href'),
            'dashboard_primary_label': persona_config.get('primary_label'),
            'dashboard_whatsapp_url': whatsapp_url,
            'dashboard_chat_href': '/?persona=%s#baderChatWidget' % persona,
            'dashboard_resource_title': persona_config.get('resource_title'),
            'dashboard_resource_intro': persona_config.get('resource_intro'),
            'dashboard_resource_entries': persona_config.get('resource_entries', []),
            'dashboard_tips_title': persona_config.get('tips_title'),
            'dashboard_tips_intro': persona_config.get('tips_intro'),
            'dashboard_tips_entries': persona_config.get('tips_entries', []),
            'dashboard_offer_products': persona_products.get('offers'),
            'dashboard_recommended_products': persona_products.get('recommended'),
            'dashboard_currency': persona_products.get('currency'),
            'dashboard_professional_rows': professional_profile.get('rows', []),
            'dashboard_professional_has_data': professional_profile.get('has_data'),
            'dashboard_professional_persona_label': professional_profile.get('persona_label'),
        })

    @http.route('/mis-pedidos', type='http', auth='public', website=True, sitemap=False)
    def mis_pedidos(self, **kw):
        """My orders page based on sale.order."""
        if request.website.is_public_user():
            return self._render_account_login_required('Mis pedidos')

        partner = self._current_customer_partner()
        orders = request.env['sale.order']
        load_error = False
        try:
            orders = request.env['sale.order'].sudo().search(
                self._order_domain_for_partner(partner),
                order='date_order desc',
                limit=100
            )
        except Exception as exc:
            load_error = True
            _logger.error("Mis pedidos load error for partner %s: %s", partner.id, exc)
        state_labels = dict(request.env['sale.order']._fields['state'].selection)
        state_badges = {
            'draft': 'is-yellow',
            'sent': 'is-blue',
            'sale': 'is-green',
            'done': 'is-green',
            'cancel': 'is-red',
        }
        payment_state_labels = {}
        payment_state_badges = {
            'not_paid': 'is-yellow',
            'in_payment': 'is-blue',
            'paid': 'is-green',
            'partial': 'is-orange',
            'reversed': 'is-gray',
            'invoicing_legacy': 'is-gray',
        }
        if 'account.move' in request.env:
            payment_state_labels = dict(
                request.env['account.move']._fields['payment_state'].selection
            )
        return request.render('bader_website.bader_mis_pedidos', {
            'orders': orders,
            'state_labels': state_labels,
            'state_badges': state_badges,
            'payment_state_labels': payment_state_labels,
            'payment_state_badges': payment_state_badges,
            'load_error': load_error,
        })

    @http.route('/mis-facturas', type='http', auth='public', website=True, sitemap=False)
    def mis_facturas(self, **kw):
        """My invoices page based on account.move when accounting is available."""
        if request.website.is_public_user():
            return self._render_account_login_required('Mis facturas')

        partner = self._current_customer_partner()
        invoices_available = 'account.move' in request.env
        invoices = request.env['account.move']
        load_error = False
        payment_state_labels = {}
        payment_state_badges = {
            'not_paid': 'is-yellow',
            'in_payment': 'is-blue',
            'paid': 'is-green',
            'partial': 'is-orange',
            'reversed': 'is-gray',
            'invoicing_legacy': 'is-gray',
        }
        if invoices_available:
            try:
                account_move = request.env['account.move'].sudo()
                invoices = account_move.search(
                    self._invoice_domain_for_partner(partner),
                    order='invoice_date desc, id desc',
                    limit=100
                )
                payment_state_labels = dict(
                    request.env['account.move']._fields['payment_state'].selection
                )
            except Exception as exc:
                load_error = True
                _logger.error("Mis facturas load error for partner %s: %s", partner.id, exc)
        return request.render('bader_website.bader_mis_facturas', {
            'invoices_available': invoices_available,
            'invoices': invoices,
            'payment_state_labels': payment_state_labels,
            'payment_state_badges': payment_state_badges,
            'load_error': load_error,
        })

    @http.route('/mis-favoritos', type='http', auth='public', website=True, sitemap=False)
    def mis_favoritos(self, **kw):
        """My wishlist page based on product.wishlist."""
        if request.website.is_public_user():
            return self._render_account_login_required('Mis favoritos')

        wishes = request.env['product.wishlist']
        load_error = False
        try:
            wishes = request.env['product.wishlist'].sudo().search([
                ('partner_id', '=', request.env.user.partner_id.id),
                ('website_id', '=', request.website.id),
                ('active', '=', True),
            ], order='id desc')
        except Exception as exc:
            load_error = True
            _logger.error("Mis favoritos load error for user %s: %s", request.env.user.id, exc)

        return request.render('bader_website.bader_mis_favoritos', {
            'wishes': wishes,
            'load_error': load_error,
            'added': kw.get('added') == '1',
            'removed': kw.get('removed') == '1',
            'action_error': kw.get('error') == '1',
        })

    @http.route('/mis-favoritos/remove', type='http', auth='user', website=True,
                sitemap=False, methods=['POST'])
    def mis_favoritos_remove(self, wish_id=None, **post):
        """Remove one wishlist item from account favorites view."""
        if not wish_id or not str(wish_id).isdigit():
            return request.redirect('/mis-favoritos?error=1')
        wish = request.env['product.wishlist'].sudo().browse(int(wish_id))
        if not wish.exists():
            return request.redirect('/mis-favoritos?error=1')
        if wish.partner_id.id != request.env.user.partner_id.id or wish.website_id.id != request.website.id:
            return request.redirect('/mis-favoritos?error=1')
        try:
            wish.unlink()
            return request.redirect('/mis-favoritos?removed=1')
        except Exception as exc:
            _logger.error("Favorite remove error (wish=%s user=%s): %s", wish_id, request.env.user.id, exc)
            return request.redirect('/mis-favoritos?error=1')

    @http.route('/mis-favoritos/add-to-cart', type='http', auth='user', website=True,
                sitemap=False, methods=['POST'])
    def mis_favoritos_add_to_cart(self, wish_id=None, product_id=None, **post):
        """Add wishlist product to current website cart."""
        if not wish_id or not str(wish_id).isdigit():
            return request.redirect('/mis-favoritos?error=1')
        wish = request.env['product.wishlist'].sudo().browse(int(wish_id))
        if not wish.exists():
            return request.redirect('/mis-favoritos?error=1')
        if wish.partner_id.id != request.env.user.partner_id.id or wish.website_id.id != request.website.id:
            return request.redirect('/mis-favoritos?error=1')

        resolved_product_id = wish.product_id.id
        if product_id and str(product_id).isdigit():
            resolved_product_id = int(product_id)
        if not resolved_product_id:
            return request.redirect('/mis-favoritos?error=1')

        try:
            order = request.website.sale_get_order(force_create=True)
            order._cart_update(product_id=resolved_product_id, add_qty=1)
            return request.redirect('/mis-favoritos?added=1')
        except Exception as exc:
            _logger.error("Favorite add-to-cart error (wish=%s product=%s user=%s): %s",
                          wish_id, resolved_product_id, request.env.user.id, exc)
            return request.redirect('/mis-favoritos?error=1')

    @http.route('/configuracion', type='http', auth='public', website=True, sitemap=False)
    def configuracion(self, **kw):
        """Customer profile settings page integrated with res.partner."""
        if request.website.is_public_user():
            return self._render_account_login_required('Configuracion')

        partner = self._current_customer_partner()
        current_persona, _source = self._resolve_home_persona(kw)
        profile_data = self._professional_profile_data(
            partner, fallback_persona=current_persona
        )

        return request.render('bader_website.bader_configuracion', {
            'partner': partner,
            'updated': kw.get('updated') == '1',
            'error': kw.get('error') == '1',
            'profile_values': profile_data.get('values', {}),
            'profile_field_map': profile_data.get('field_map', {}),
            'profile_available_keys': profile_data.get('available_keys', {}),
            'profile_persona': profile_data.get('persona', 'clinica'),
        })

    @http.route('/configuracion/guardar', type='http', auth='user', website=True,
                sitemap=False, methods=['POST'])
    def configuracion_guardar(self, **post):
        """Persist customer profile changes on res.partner."""
        partner = self._current_customer_partner().sudo()
        vals = {}
        allowed_fields = [
            'name', 'phone', 'mobile', 'vat',
            'street', 'street2', 'city', 'zip',
            'company_name',
        ]
        for field_name in allowed_fields:
            if field_name in post:
                vals[field_name] = (post.get(field_name) or '').strip()

        vals.update(self._professional_profile_write_vals(partner, post))

        try:
            partner.write(vals)
            return request.redirect('/configuracion?updated=1')
        except Exception as exc:
            _logger.error("Profile update error for partner %s: %s", partner.id, exc)
            return request.redirect('/configuracion?error=1')

    @http.route('/descargas', type='http', auth='public', website=True, sitemap=True)
    def descargas(self, **kw):
        catalogs = self._descargas_catalogs()
        search_query = (kw.get('q') or '').strip()
        selected_category = (kw.get('category') or 'all').strip().lower()
        search_lower = search_query.lower()

        filtered_catalogs = []
        for catalog in catalogs:
            matches_category = selected_category == 'all' or catalog['category'] == selected_category
            matches_search = (
                not search_lower
                or search_lower in catalog['title'].lower()
                or search_lower in catalog['description'].lower()
            )
            if matches_category and matches_search:
                filtered_catalogs.append(catalog)

        featured_catalogs = [c for c in catalogs if c['featured']]
        category_labels = {
            'general': 'General',
            'clinica': 'Clinica',
            'equipos': 'Equipos',
            'instrumental': 'Instrumental',
            'formacion': 'Formacion',
            'mobiliario': 'Mobiliario',
        }
        categories = [{'id': 'all', 'label': 'Todos', 'count': len(catalogs)}]
        for category_id in ['general', 'clinica', 'equipos', 'instrumental', 'formacion', 'mobiliario']:
            count = len([c for c in catalogs if c['category'] == category_id])
            categories.append({
                'id': category_id,
                'label': category_labels[category_id],
                'count': count,
            })

        return request.render('bader_website.bader_descargas', {
            'catalogs': catalogs,
            'featured_catalogs': featured_catalogs,
            'filtered_catalogs': filtered_catalogs,
            'categories': categories,
            'selected_category': selected_category,
            'search_query': search_query,
        })

    @http.route('/ayuda', type='http', auth='public', website=True, sitemap=True)
    def ayuda(self, **kw):
        return request.render('bader_website.bader_ayuda', {})

    def _safe_auth_redirect(self, raw_redirect):
        """Allow only local redirect paths to avoid open redirects."""
        redirect_path = (raw_redirect or '/').strip()
        if not redirect_path.startswith('/'):
            return '/'
        if redirect_path.startswith('//'):
            return '/'
        blocked_prefixes = ('/web/login', '/web/signup', '/bader/auth')
        for prefix in blocked_prefixes:
            if redirect_path.startswith(prefix):
                return '/'
        return redirect_path

    def _prepare_onboarding_write_vals(self, partner, payload):
        """Validate + normalize onboarding payload into partner write values."""
        payload = payload or {}

        def _clean_text(value, max_len=255):
            text = (value or '').strip()
            if not text:
                return ''
            return text[:max_len]

        def _selection_keys(field_name):
            field = partner._fields.get(field_name)
            if not field:
                return set()
            selection = field.selection(partner.env) if callable(field.selection) else field.selection
            return set(k for k, _label in (selection or []))

        def _clean_selection(field_name, raw_value):
            value = _clean_text(raw_value, max_len=64).lower()
            allowed = _selection_keys(field_name)
            if not value or not allowed:
                return ''
            return value if value in allowed else ''

        def _clean_specialties(raw_value):
            values = raw_value if isinstance(raw_value, list) else (raw_value or '').split(',')
            clean = []
            for item in values:
                text = _clean_text(item, max_len=80).lower()
                if text and text not in clean:
                    clean.append(text)
            return clean

        persona = self._normalize_home_persona(
            payload.get('persona') or payload.get('niche')
        )
        if persona not in ('clinica', 'laboratorio', 'estudiantes'):
            return {'ok': False, 'error': 'invalid_persona'}

        clinic_role = _clean_selection('bader_clinic_role', payload.get('clinic_role'))
        clinic_specialties = _clean_specialties(payload.get('clinic_specialties'))
        clinic_size = _clean_selection('bader_clinic_size', payload.get('clinic_size'))
        lab_type = _clean_selection('bader_lab_type', payload.get('lab_type'))
        lab_specialization = _clean_selection('bader_lab_specialization', payload.get('lab_specialization'))
        lab_team_size = _clean_selection('bader_lab_team_size', payload.get('lab_team_size'))
        study_year = _clean_selection('bader_study_year', payload.get('study_year'))
        career = _clean_selection('bader_career', payload.get('career'))

        try:
            years_experience = int(payload.get('years_experience') or 0)
        except Exception:
            years_experience = 0
        years_experience = max(0, min(years_experience, 80))

        missing_fields = []
        if persona == 'clinica':
            if not clinic_role:
                missing_fields.append('clinic_role')
            if not clinic_specialties:
                missing_fields.append('clinic_specialties')
        elif persona == 'laboratorio':
            if not lab_type:
                missing_fields.append('lab_type')
            if not lab_specialization:
                missing_fields.append('lab_specialization')
        elif persona == 'estudiantes':
            if not career:
                missing_fields.append('career')
            if not study_year:
                missing_fields.append('study_year')

        if missing_fields:
            return {
                'ok': False,
                'error': 'missing_required_fields',
                'fields': missing_fields,
            }

        write_vals = {
            'bader_persona': persona,
            'bader_clinic_name': _clean_text(payload.get('clinic_name')),
            'bader_clinic_role': clinic_role,
            'bader_clinic_specialties': ', '.join(clinic_specialties),
            'bader_clinic_size': clinic_size,
            'bader_years_experience': years_experience,
            'bader_lab_name': _clean_text(payload.get('lab_name')),
            'bader_lab_type': lab_type,
            'bader_lab_specialization': lab_specialization,
            'bader_lab_team_size': lab_team_size,
            'bader_university': _clean_text(payload.get('university')),
            'bader_study_year': study_year,
            'bader_career': career,
            'bader_student_city': _clean_text(payload.get('student_city'), max_len=120),
        }
        return {'ok': True, 'persona': persona, 'write_vals': write_vals}

    @http.route('/bader/auth/login', type='json', auth='public', website=True, csrf=False)
    def auth_modal_login(self, **params):
        """AJAX login endpoint used by the Clerk-like website modal."""
        payload = params or {}
        redirect_path = self._safe_auth_redirect(payload.get('redirect'))
        if not request.website.is_public_user():
            return {'ok': True, 'already_logged': True, 'redirect': redirect_path}

        login = (payload.get('login') or payload.get('email') or '').strip().lower()
        password = payload.get('password') or ''
        if not login or not password:
            return {
                'ok': False,
                'error': 'missing_credentials',
                'message': 'Ingresa email y contrasena.',
            }

        db_name = request.session.db or request.env.cr.dbname
        try:
            uid = request.session.authenticate(db_name, login, password)
        except Exception:
            uid = False

        if not uid:
            return {
                'ok': False,
                'error': 'invalid_credentials',
                'message': 'Credenciales invalidas. Verifica email y contrasena.',
            }

        return {'ok': True, 'redirect': redirect_path}

    @http.route('/bader/auth/signup', type='json', auth='public', website=True, csrf=False)
    def auth_modal_signup(self, **params):
        """Create website account + segmented profile in one secure flow."""
        payload = params or {}
        redirect_path = self._safe_auth_redirect(payload.get('redirect'))
        if not request.website.is_public_user():
            return {'ok': True, 'already_logged': True, 'redirect': redirect_path}

        full_name = (payload.get('name') or '').strip()[:120]
        email = (payload.get('email') or payload.get('login') or '').strip().lower()[:320]
        password = payload.get('password') or ''
        confirm_password = payload.get('confirm_password') or payload.get('confirm') or ''
        if not full_name:
            return {'ok': False, 'error': 'missing_name', 'message': 'Ingresa tu nombre completo.'}
        if not email:
            return {'ok': False, 'error': 'missing_email', 'message': 'Ingresa un email valido.'}
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            return {'ok': False, 'error': 'invalid_email', 'message': 'Ingresa un email valido.'}
        if len(password) < 8:
            return {'ok': False, 'error': 'weak_password', 'message': 'La contrasena debe tener al menos 8 caracteres.'}
        if password != confirm_password:
            return {'ok': False, 'error': 'password_mismatch', 'message': 'Las contrasenas no coinciden.'}

        profile_payload = self._prepare_onboarding_write_vals(
            request.env['res.partner'].sudo(), payload
        )
        if not profile_payload.get('ok'):
            profile_payload.setdefault(
                'message',
                'Completa los datos requeridos para terminar tu registro.',
            )
            return profile_payload

        auth_signup = AuthSignupHome()
        qcontext = auth_signup.get_auth_signup_qcontext()
        qcontext.update({
            'name': full_name,
            'login': email,
            'email': email,
            'password': password,
            'confirm_password': confirm_password,
        })
        try:
            auth_signup.do_signup(qcontext)
            # Keep signup + immediate login atomic enough for website UX.
            request.env.cr.commit()
        except UserError as exc:
            return {
                'ok': False,
                'error': 'signup_failed',
                'message': str(exc),
            }
        except Exception as exc:
            _logger.exception("Bader auth modal signup failed for %s: %s", email, exc)
            return {
                'ok': False,
                'error': 'signup_failed',
                'message': 'No se pudo crear la cuenta en este momento.',
            }

        db_name = request.session.db or request.env.cr.dbname
        try:
            uid = request.session.authenticate(db_name, email, password)
        except Exception:
            uid = False
        if not uid:
            return {
                'ok': False,
                'error': 'post_signup_login_failed',
                'message': 'La cuenta fue creada, pero no se pudo iniciar sesion automaticamente.',
            }

        partner = self._current_customer_partner().sudo()
        write_vals = dict(profile_payload.get('write_vals') or {})
        write_vals['bader_onboarding_completed_at'] = datetime.utcnow()
        partner.write(write_vals)
        request.session['bader_home_persona'] = profile_payload.get('persona')
        request.session.modified = True

        return {
            'ok': True,
            'redirect': redirect_path,
            'profile': self._onboarding_profile_payload(partner),
        }

    @http.route('/bader/onboarding/state', type='json', auth='user', website=True, csrf=False)
    def onboarding_state(self, **kw):
        """Return onboarding state for the current logged website user."""
        if request.website.is_public_user():
            return {'ok': False, 'error': 'auth_required'}

        user = request.env.user
        is_internal_user = bool(user.has_group('base.group_user'))
        partner = self._current_customer_partner().sudo()
        profile = self._onboarding_profile_payload(partner)
        is_completed = bool(partner.bader_onboarding_completed_at)

        return {
            'ok': True,
            'show_onboarding': bool(not is_completed and not is_internal_user),
            'is_internal_user': is_internal_user,
            'profile': profile,
        }

    @http.route('/bader/onboarding/save', type='json', auth='user', website=True, csrf=False)
    def onboarding_save(self, **params):
        """Persist onboarding answers in res.partner and mark completion."""
        if request.website.is_public_user():
            return {'ok': False, 'error': 'auth_required'}

        user = request.env.user
        if user.has_group('base.group_user'):
            return {'ok': False, 'error': 'internal_user_not_allowed'}

        partner = self._current_customer_partner().sudo()
        onboarding_payload = self._prepare_onboarding_write_vals(partner, params or {})
        if not onboarding_payload.get('ok'):
            return onboarding_payload
        write_vals = dict(onboarding_payload.get('write_vals') or {})
        persona = onboarding_payload.get('persona')

        if not partner.bader_onboarding_completed_at:
            write_vals['bader_onboarding_completed_at'] = datetime.utcnow()

        partner.write(write_vals)
        request.session['bader_home_persona'] = persona
        request.session.modified = True

        return {
            'ok': True,
            'profile': self._onboarding_profile_payload(partner),
        }

    @http.route('/bader/home/set_persona', type='json', auth='public', website=True, csrf=False)
    def set_home_persona(self, persona=None, **kw):
        normalized = self._normalize_home_persona(persona or kw.get('persona'))
        if not normalized:
            return {'ok': False, 'error': 'invalid_persona'}
        request.session['bader_home_persona'] = normalized
        request.session.modified = True
        return {'ok': True, 'persona': normalized}

    @http.route('/bader/shop/intelligent_categories', type='json', auth='public', csrf=False)
    def intelligent_shop_categories(self, **kw):
        return self._build_intelligent_shop_tree()

    @http.route('/terminos', type='http', auth='public', website=True, sitemap=True)
    def terminos(self, **kw):
        return request.render('bader_website.bader_terminos', {})

    @http.route('/privacidad', type='http', auth='public', website=True, sitemap=True)
    def privacidad(self, **kw):
        return request.render('bader_website.bader_privacidad', {})

    @http.route('/cookies', type='http', auth='public', website=True, sitemap=True)
    def cookies(self, **kw):
        return request.render('bader_website.bader_cookies', {})

    @http.route('/blog', type='http', auth='public', website=True, sitemap=True)
    def blog(self, **kw):
        search_query = (kw.get('q') or '').strip()
        selected_category = (kw.get('category') or 'all').strip().lower()
        page_raw = kw.get('page') or 1
        per_page = 9

        try:
            page = max(1, int(page_raw))
        except Exception:
            page = 1

        blog_enabled = self._blog_models_available()
        categories = [{'id': 'all', 'label': 'Todos', 'count': 0}]
        post_cards = []
        total_posts = 0
        page_count = 1

        if blog_enabled:
            post_model = request.env['blog.post'].sudo()
            blog_model = request.env['blog.blog'].sudo()

            search_domain = []
            if search_query:
                search_domain = [
                    '|', '|',
                    ('name', 'ilike', search_query),
                    ('subtitle', 'ilike', search_query),
                    ('content', 'ilike', search_query),
                ]

            domain = [('website_published', '=', True)] + search_domain
            selected_blog_id = False

            if selected_category not in ('all', ''):
                try:
                    selected_blog_id = int(selected_category)
                    domain.append(('blog_id', '=', selected_blog_id))
                except Exception:
                    selected_blog_id = False
                    selected_category = 'all'

            total_posts = post_model.search_count(domain)
            page_count = max(1, int(math.ceil(total_posts / float(per_page)))) if total_posts else 1
            page = min(page, page_count)

            posts = post_model.search(
                domain,
                order='post_date desc, id desc',
                limit=per_page,
                offset=(page - 1) * per_page,
            )
            post_cards = self._prepare_blog_cards(posts)

            all_published_domain = [('website_published', '=', True)]
            categories = [{
                'id': 'all',
                'label': 'Todos',
                'count': post_model.search_count(all_published_domain),
            }]

            for blog in blog_model.search([], order='name'):
                categories.append({
                    'id': str(blog.id),
                    'label': blog.name,
                    'count': post_model.search_count(all_published_domain + [('blog_id', '=', blog.id)]),
                })

            if selected_blog_id and not any(c['id'] == str(selected_blog_id) for c in categories):
                selected_category = 'all'

        return request.render('bader_website.bader_blog', {
            'blog_enabled': blog_enabled,
            'post_cards': post_cards,
            'categories': categories,
            'selected_category': selected_category,
            'search_query': search_query,
            'total_posts': total_posts,
            'page': page,
            'page_count': page_count,
            'has_prev': page > 1,
            'has_next': page < page_count,
            'prev_page': max(1, page - 1),
            'next_page': min(page_count, page + 1),
        })

    @http.route('/blog/<string:post_slug>', type='http', auth='public',
                website=True, sitemap=False)
    def blog_post(self, post_slug, **kw):
        blog_enabled = self._blog_models_available()
        post = self._resolve_blog_post(post_slug)

        if post and 'visits' in post._fields:
            try:
                post.sudo().write({'visits': (post.visits or 0) + 1})
            except Exception:
                pass

        related_cards = []
        related_product_cards = []
        product_currency = request.website.get_current_pricelist().currency_id
        if post:
            related_posts = request.env['blog.post'].sudo().search(
                [
                    ('website_published', '=', True),
                    ('blog_id', '=', post.blog_id.id),
                    ('id', '!=', post.id),
                ],
                order='post_date desc, id desc',
                limit=3,
            )
            related_cards = self._prepare_blog_cards(related_posts)
            related_product_cards = self._prepare_related_blog_products(post, limit=4)

        return request.render('bader_website.bader_blog_post', {
            'blog_enabled': blog_enabled,
            'post': post,
            'post_slug': post_slug,
            'post_cover_url': self._blog_cover_url(post) if post else '',
            'post_excerpt': self._blog_excerpt(post) if post else '',
            'post_date_label': (post.post_date or post.create_date).strftime('%d/%m/%Y') if post and (post.post_date or post.create_date) else '',
            'post_read_minutes': self._blog_reading_time(post) if post else 0,
            'related_cards': related_cards,
            'related_product_cards': related_product_cards,
            'product_currency': product_currency,
        })

    @http.route('/payment/success', type='http', auth='public', website=True, sitemap=False)
    def payment_success(self, **kw):
        return request.render('bader_website.bader_payment_success', {})

    @http.route('/payment/failure', type='http', auth='public', website=True, sitemap=False)
    def payment_failure(self, **kw):
        return request.render('bader_website.bader_payment_failure', {})

    @http.route('/payment/pending', type='http', auth='public', website=True, sitemap=False)
    def payment_pending(self, **kw):
        return request.render('bader_website.bader_payment_pending', {})

    @http.route('/presupuesto/<string:token>', type='http', auth='public',
                website=True, sitemap=False)
    def presupuesto_publico(self, token, **kw):
        order = self._find_sale_order_by_token(token)
        return request.render('bader_website.bader_presupuesto_publico', {
            'token': token,
            'order': order,
            'portal_url': '/my/orders/%s?access_token=%s' % (order.id, token) if order else False,
        })

    @http.route('/pago/<string:token>', type='http', auth='public',
                website=True, sitemap=False)
    def pago_publico(self, token, **kw):
        order = self._find_sale_order_by_token(token)
        return request.render('bader_website.bader_pago_publico', {
            'token': token,
            'order': order,
            'portal_url': '/my/orders/%s?access_token=%s' % (order.id, token) if order else False,
        })

    @http.route('/recuperar-carrito/<string:token>', type='http', auth='public',
                website=True, sitemap=False)
    def recuperar_carrito(self, token, **kw):
        order = self._find_sale_order_by_token(token)
        if not order:
            return request.render('bader_website.bader_recuperar_carrito', {
                'token': token,
                'order': False,
                'recovery_ok': False,
                'portal_url': False,
            })

        if request.website.is_public_user():
            return request.redirect('/web/login?redirect=/recuperar-carrito/%s' % token)

        user_partner = request.env.user.partner_id.commercial_partner_id
        order_partner = order.partner_id.commercial_partner_id
        if user_partner != order_partner:
            return request.render('bader_website.bader_recuperar_carrito', {
                'token': token,
                'order': order,
                'recovery_ok': False,
                'portal_url': '/my/orders/%s?access_token=%s' % (order.id, token),
            })

        if order.state not in ('draft', 'sent'):
            return request.render('bader_website.bader_recuperar_carrito', {
                'token': token,
                'order': order,
                'recovery_ok': False,
                'portal_url': '/my/orders/%s?access_token=%s' % (order.id, token),
            })

        # Attach this quotation/cart to the current website session.
        request.session['sale_order_id'] = order.id
        request.session['website_sale_current_pl'] = order.pricelist_id.id
        request.session['sale_last_order_id'] = order.id
        request.session.modified = True
        return request.redirect('/shop/cart')

    # ─── Sobre Nosotros ────────────────────────────────────────
    @http.route(['/sobre-nosotros', '/quienes-somos', '/nosotros'], type='http', auth='public',
                website=True, sitemap=True)
    def sobre_nosotros(self, **kw):
        """About Us page."""
        return request.render('bader_website.bader_sobre_nosotros', {})

    # ─── Ser Distribuidor ──────────────────────────────────────
    @http.route('/ser-distribuidor', type='http', auth='public',
                website=True, sitemap=True)
    def ser_distribuidor(self, **kw):
        """Become a distributor landing page."""
        return request.render('bader_website.bader_ser_distribuidor', {})

    # ─── Servicios ─────────────────────────────────────────────
    @http.route('/servicios', type='http', auth='public',
                website=True, sitemap=True)
    def servicios(self, **kw):
        """Services page."""
        return request.render('bader_website.bader_servicios', {})

    @http.route('/servicio-tecnico', type='http', auth='public',
                website=True, sitemap=False)
    def servicio_tecnico_alias(self, **kw):
        """Legacy/public alias used in Bader-AR footer."""
        return request.redirect('/servicios', code=301)

    @http.route('/clinica-dental', type='http', auth='public',
                website=True, sitemap=True)
    def clinica_dental(self, **kw):
        """Dental clinic niche landing page."""
        return request.render('bader_website.bader_clinica_dental', {})

    # ─── Laboratorio Dental ────────────────────────────────────
    @http.route('/laboratorio-dental', type='http', auth='public',
                website=True, sitemap=True)
    def laboratorio_dental(self, **kw):
        """Dental laboratory niche landing page."""
        return request.render('bader_website.bader_laboratorio_dental', {})

    # ─── Estudiantes Odontología ───────────────────────────────
    @http.route('/estudiantes-odontologia', type='http', auth='public',
                website=True, sitemap=True)
    def estudiantes_odontologia(self, **kw):
        """Students niche landing page."""
        return request.render('bader_website.bader_estudiantes_odontologia', {})

    # ─── Thank You Pages ──────────────────────────────────────
    @http.route('/contacto', type='http', auth='public',
                website=True, sitemap=False)
    def contacto_alias(self, **kw):
        """Public alias used in Bader-AR footer/menu."""
        return request.redirect('/#contacto', code=301)

    @http.route('/contacto/gracias', type='http', auth='public',
                website=True, sitemap=False)
    def cta_thankyou(self, **kw):
        """Thank you page after CTA form submission."""
        return request.render('bader_website.bader_thankyou', {})

    @http.route('/ser-distribuidor/gracias', type='http', auth='public',
                website=True, sitemap=False)
    def distribuidor_thankyou(self, **kw):
        """Thank you page after distributor form submission."""
        return request.render('bader_website.bader_distribuidor_gracias', {})

    @http.route('/servicios/gracias', type='http', auth='public',
                website=True, sitemap=False)
    def servicio_thankyou(self, **kw):
        """Thank you page after service request submission."""
        return request.render('bader_website.bader_servicio_gracias', {})

    # ─── CTA Form (Homepage 10% discount) ─────────────────────
    @http.route('/bader/cta-form', type='http', auth='public',
                website=True, methods=['POST'], csrf=True)
    def cta_form_submit(self, **kw):
        """Handle the CTA discount form submission -> create CRM lead."""
        if _is_spam(kw):
            _logger.warning("CTA form: honeypot triggered, rejecting spam")
            return request.redirect('/contacto/gracias')
        try:
            values = {
                'name': '[Web CTA] %s' % kw.get('name', 'Sin nombre'),
                'contact_name': kw.get('name', ''),
                'email_from': kw.get('email', ''),
                'phone': kw.get('phone', ''),
                'description': (
                    'Consultorio: %s\n'
                    'Profesion: %s\n'
                    'Origen: Formulario CTA Homepage - 10%% Descuento'
                ) % (kw.get('clinic', 'N/A'), kw.get('profession', 'N/A')),
                'type': 'lead',
            }
            utm_source = request.env.ref(
                'utm.utm_source_website', raise_if_not_found=False
            )
            if utm_source:
                values['source_id'] = utm_source.id

            lead = request.env['crm.lead'].sudo().create(values)
            _logger.info(
                "CTA form: created lead #%s for %s",
                lead.id, kw.get('email')
            )
            return request.redirect('/contacto/gracias')
        except Exception as e:
            _logger.error("CTA form error: %s", str(e))
            return request.redirect('/')

    # ─── Distributor Form ──────────────────────────────────────
    @http.route('/bader/distribuidor-form', type='http', auth='public',
                website=True, methods=['POST'], csrf=True)
    def distribuidor_form_submit(self, **kw):
        """Handle distributor form submission -> create CRM lead."""
        if _is_spam(kw):
            _logger.warning("Distributor form: honeypot triggered, rejecting spam")
            return request.redirect('/ser-distribuidor/gracias')
        try:
            values = {
                'name': '[Web Distribuidor] %s' % kw.get('name', 'Sin nombre'),
                'contact_name': kw.get('name', ''),
                'email_from': kw.get('email', ''),
                'phone': kw.get('phone', ''),
                'partner_name': kw.get('company', ''),
                'description': (
                    'Empresa: %s\n'
                    'Provincia: %s\n'
                    'Ciudad: %s\n'
                    'Tipo de negocio: %s\n'
                    'Mensaje: %s\n'
                    'Origen: Formulario Ser Distribuidor'
                ) % (
                    kw.get('company', 'N/A'),
                    kw.get('province', 'N/A'),
                    kw.get('city', 'N/A'),
                    kw.get('business_type', 'N/A'),
                    kw.get('message', 'N/A'),
                ),
                'type': 'lead',
            }
            utm_source = request.env.ref(
                'utm.utm_source_website', raise_if_not_found=False
            )
            if utm_source:
                values['source_id'] = utm_source.id

            lead = request.env['crm.lead'].sudo().create(values)
            _logger.info(
                "Distributor form: created lead #%s for %s",
                lead.id, kw.get('email')
            )
            return request.redirect('/ser-distribuidor/gracias')
        except Exception as e:
            _logger.error("Distributor form error: %s", str(e))
            return request.redirect('/ser-distribuidor')

    # ─── Service Request Form ──────────────────────────────────
    @http.route('/bader/servicio-form', type='http', auth='public',
                website=True, methods=['POST'], csrf=True)
    def servicio_form_submit(self, **kw):
        """Handle service request form submission -> create CRM lead."""
        if _is_spam(kw):
            _logger.warning("Service form: honeypot triggered, rejecting spam")
            return request.redirect('/servicios/gracias')
        try:
            service_labels = {
                'instalacion': 'Instalación',
                'soporte_tecnico': 'Soporte Técnico',
                'mantenimiento': 'Mantenimiento',
                'capacitacion': 'Capacitación',
                'garantia': 'Garantía',
                'otro': 'Otro',
            }
            service_type = kw.get('service_type', 'N/A')
            service_label = service_labels.get(service_type, service_type)

            values = {
                'name': '[Web Servicio - %s] %s' % (
                    service_label,
                    kw.get('name', 'Sin nombre')
                ),
                'contact_name': kw.get('name', ''),
                'email_from': kw.get('email', ''),
                'phone': kw.get('phone', ''),
                'description': (
                    'Tipo de servicio: %s\n'
                    'Equipo/Producto: %s\n'
                    'Descripción: %s\n'
                    'Origen: Formulario Servicios'
                ) % (
                    service_label,
                    kw.get('product', 'N/A'),
                    kw.get('description', 'N/A'),
                ),
                'type': 'lead',
            }
            utm_source = request.env.ref(
                'utm.utm_source_website', raise_if_not_found=False
            )
            if utm_source:
                values['source_id'] = utm_source.id

            lead = request.env['crm.lead'].sudo().create(values)
            _logger.info(
                "Service form: created lead #%s for %s",
                lead.id, kw.get('email')
            )
            return request.redirect('/servicios/gracias')
        except Exception as e:
            _logger.error("Service form error: %s", str(e))
            return request.redirect('/servicios')
