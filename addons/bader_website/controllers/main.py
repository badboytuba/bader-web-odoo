# -*- coding: utf-8 -*-
import logging
from datetime import datetime
from odoo import http
from odoo.http import request
from odoo.addons.website.controllers.main import Website
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


class BaderWebsite(Website):
    """Override homepage to render Bader custom template.
    Also handles CTA form, page routes, and thank-you pages.
    """

    def _current_customer_partner(self):
        """Commercial partner used as customer scope for portal-like pages."""
        return request.env.user.partner_id.commercial_partner_id

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
        return request.render('bader_website.bader_homepage', {})

    @http.route('/productos', type='http', auth='public', website=True, sitemap=True)
    def productos(self, **kw):
        """Frontend alias for Odoo catalog."""
        query = request.httprequest.query_string.decode('utf-8')
        return request.redirect('/shop%s' % ('?%s' % query if query else ''))

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

    @http.route('/mi-perfil', type='http', auth='user', website=True, sitemap=False)
    def mi_perfil(self, **kw):
        """Customer account dashboard fully backed by Odoo data."""
        partner = self._current_customer_partner()
        sale_order = request.env['sale.order'].sudo()
        order_domain = self._order_domain_for_partner(partner)
        orders = sale_order.search(order_domain, order='date_order desc', limit=5)
        order_count = sale_order.search_count(order_domain)

        wishlist = request.env['product.wishlist'].sudo().search([
            ('partner_id', '=', request.env.user.partner_id.id),
            ('website_id', '=', request.website.id),
            ('active', '=', True),
        ])

        invoice_count = 0
        if 'account.move' in request.env:
            account_move = request.env['account.move'].sudo()
            invoice_count = account_move.search_count(
                self._invoice_domain_for_partner(partner)
            )

        return request.render('bader_website.bader_mi_perfil', {
            'partner': partner,
            'orders': orders,
            'order_count': order_count,
            'invoice_count': invoice_count,
            'wishlist_count': len(wishlist),
            'last_order': orders[:1],
        })

    @http.route('/mis-pedidos', type='http', auth='user', website=True, sitemap=False)
    def mis_pedidos(self, **kw):
        """My orders page based on sale.order."""
        partner = self._current_customer_partner()
        orders = request.env['sale.order'].sudo().search(
            self._order_domain_for_partner(partner),
            order='date_order desc',
            limit=100
        )
        state_labels = dict(request.env['sale.order']._fields['state'].selection)
        return request.render('bader_website.bader_mis_pedidos', {
            'orders': orders,
            'state_labels': state_labels,
        })

    @http.route('/mis-facturas', type='http', auth='user', website=True, sitemap=False)
    def mis_facturas(self, **kw):
        """My invoices page based on account.move when accounting is available."""
        partner = self._current_customer_partner()
        invoices_available = 'account.move' in request.env
        invoices = request.env['account.move']
        payment_state_labels = {}
        if invoices_available:
            account_move = request.env['account.move'].sudo()
            invoices = account_move.search(
                self._invoice_domain_for_partner(partner),
                order='invoice_date desc, id desc',
                limit=100
            )
            payment_state_labels = dict(
                request.env['account.move']._fields['payment_state'].selection
            )
        return request.render('bader_website.bader_mis_facturas', {
            'invoices_available': invoices_available,
            'invoices': invoices,
            'payment_state_labels': payment_state_labels,
        })

    @http.route('/mis-favoritos', type='http', auth='user', website=True, sitemap=False)
    def mis_favoritos(self, **kw):
        """My wishlist page based on product.wishlist."""
        wishes = request.env['product.wishlist'].sudo().search([
            ('partner_id', '=', request.env.user.partner_id.id),
            ('website_id', '=', request.website.id),
            ('active', '=', True),
        ], order='id desc')
        return request.render('bader_website.bader_mis_favoritos', {
            'wishes': wishes,
        })

    @http.route('/configuracion', type='http', auth='user', website=True, sitemap=False)
    def configuracion(self, **kw):
        """Customer profile settings page integrated with res.partner."""
        return request.render('bader_website.bader_configuracion', {
            'partner': request.env.user.partner_id,
            'updated': kw.get('updated') == '1',
            'error': kw.get('error') == '1',
        })

    @http.route('/configuracion/guardar', type='http', auth='user', website=True,
                sitemap=False, methods=['POST'])
    def configuracion_guardar(self, **post):
        """Persist customer profile changes on res.partner."""
        partner = request.env.user.partner_id.sudo()
        vals = {}
        allowed_fields = [
            'name', 'phone', 'mobile', 'vat',
            'street', 'street2', 'city', 'zip',
            'company_name',
        ]
        for field_name in allowed_fields:
            if field_name in post:
                vals[field_name] = (post.get(field_name) or '').strip()
        try:
            partner.write(vals)
            return request.redirect('/configuracion?updated=1')
        except Exception as exc:
            _logger.error("Profile update error for partner %s: %s", partner.id, exc)
            return request.redirect('/configuracion?error=1')

    @http.route('/descargas', type='http', auth='public', website=True, sitemap=True)
    def descargas(self, **kw):
        return request.render('bader_website.bader_descargas', {})

    @http.route('/ayuda', type='http', auth='public', website=True, sitemap=True)
    def ayuda(self, **kw):
        return request.render('bader_website.bader_ayuda', {})

    @http.route('/blog', type='http', auth='public', website=True, sitemap=True)
    def blog(self, **kw):
        return request.render('bader_website.bader_blog', {})

    @http.route('/blog/<string:post_slug>', type='http', auth='public',
                website=True, sitemap=False)
    def blog_post_placeholder(self, post_slug, **kw):
        return request.render('bader_website.bader_blog_post_placeholder', {
            'slug': post_slug
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
        return request.render('bader_website.bader_presupuesto_publico', {
            'token': token
        })

    @http.route('/pago/<string:token>', type='http', auth='public',
                website=True, sitemap=False)
    def pago_publico(self, token, **kw):
        return request.render('bader_website.bader_pago_publico', {
            'token': token
        })

    @http.route('/recuperar-carrito/<string:token>', type='http', auth='public',
                website=True, sitemap=False)
    def recuperar_carrito(self, token, **kw):
        return request.render('bader_website.bader_recuperar_carrito', {
            'token': token
        })

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
