# -*- coding: utf-8 -*-
import logging
import math
import re
from datetime import datetime
from odoo import http
from odoo.tools import html2plaintext
from odoo.http import request
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
        return request.render('bader_website.bader_homepage', {})

    @http.route([
        '/productos',
        '/productos/page/<int:page>',
        '/productos/category/<model("product.public.category"):category>',
        '/productos/category/<model("product.public.category"):category>/page/<int:page>',
    ], type='http', auth='public', website=True, sitemap=True)
    def productos(self, page=0, category=None, search='', ppg=False, **post):
        """Serve product catalog on /productos to match Bader-AR public URLs."""
        return WebsiteSale().shop(
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

    @http.route('/mi-perfil', type='http', auth='user', website=True, sitemap=False)
    def mi_perfil(self, **kw):
        """Customer account dashboard fully backed by Odoo data."""
        partner = self._current_customer_partner()
        user = request.env.user
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

        member_since = user.create_date.strftime('%d/%m/%Y') if user.create_date else ''
        profile_initial = ((partner.name or 'U').strip()[:1] or 'U').upper()

        return request.render('bader_website.bader_mi_perfil', {
            'partner': partner,
            'orders': orders,
            'order_count': order_count,
            'invoice_count': invoice_count,
            'wishlist_count': len(wishlist),
            'last_order': orders[:1],
            'member_since': member_since,
            'profile_initial': profile_initial,
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
        })

    @http.route('/mis-facturas', type='http', auth='user', website=True, sitemap=False)
    def mis_facturas(self, **kw):
        """My invoices page based on account.move when accounting is available."""
        partner = self._current_customer_partner()
        invoices_available = 'account.move' in request.env
        invoices = request.env['account.move']
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
            'payment_state_badges': payment_state_badges,
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

        return request.render('bader_website.bader_blog_post', {
            'blog_enabled': blog_enabled,
            'post': post,
            'post_slug': post_slug,
            'post_cover_url': self._blog_cover_url(post) if post else '',
            'post_excerpt': self._blog_excerpt(post) if post else '',
            'post_date_label': (post.post_date or post.create_date).strftime('%d/%m/%Y') if post and (post.post_date or post.create_date) else '',
            'post_read_minutes': self._blog_reading_time(post) if post else 0,
            'related_cards': related_cards,
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
