# -*- coding: utf-8 -*-
{
    'name': 'Bader Website',
    'version': '16.0.5.0.0',
    'summary': 'Premium website for Bader dental equipment',
    'description': """
        Complete website for Bader Iberoamericana.
        Light theme with BaderSans typography and green accents.
        - Custom header/footer styling (CSS-only, editor-compatible)
        - Homepage: hero, stats, testimonials, CTA form
        - Sobre Nosotros: company info, timeline, product lines
        - Ser Distribuidor: benefits, form → CRM lead
        - Servicios: 6 service cards, request form → CRM lead
        - Clínica Dental: product categories, features
        - Shop page: product cards, badges
        - All forms create CRM leads
        - Fully responsive (PC, tablet, mobile)
    """,
    'author': 'Bader Iberoamericana',
    'website': 'https://bader.com.ar',
    'category': 'Website',
    'depends': [
        'auth_signup',
        'website',
        'website_sale',
        'website_sale_wishlist',
        'website_sale_comparison',
        'website_crm',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/assets.xml',
        'views/header.xml',
        'views/header_overrides.xml',
        'views/footer.xml',
        'views/homepage.xml',
        'views/templates.xml',
        'views/frontend_pages.xml',
        'views/account_pages.xml',
        'views/shop.xml',
        'views/product_detail.xml',
        # New pages
        'views/sobre_nosotros.xml',
        'views/ser_distribuidor.xml',
        'views/servicios.xml',
        'views/clinica_dental.xml',
        'views/laboratorio_dental.xml',
        'views/estudiantes_odontologia.xml',
        # Menu and website pages
        'data/auth_signup.xml',
        'data/website_menu.xml',
        # Website page records (for Odoo backend integration)
        'data/website_pages.xml',
    ],
    'assets': {
        # Override Odoo's primary SCSS variables (loads BEFORE everything)
        'web._assets_primary_variables': [
            ('prepend', 'bader_website/static/src/scss/_primary_variables.scss'),
        ],
        'web.assets_frontend': [
            # 1. Design Tokens (must load first)
            'bader_website/static/src/scss/_variables.scss',
            'bader_website/static/src/scss/_mixins.scss',
            # 2. Base styles
            'bader_website/static/src/scss/_typography.scss',
            'bader_website/static/src/scss/_buttons.scss',
            # 3. Layout
            'bader_website/static/src/scss/_header.scss',
            'bader_website/static/src/scss/_footer.scss',
            # 4. Homepage Sections
            'bader_website/static/src/scss/_hero.scss',
            'bader_website/static/src/scss/_stats.scss',
            'bader_website/static/src/scss/_testimonials.scss',
            'bader_website/static/src/scss/_cta.scss',
            # 5. New Pages
            'bader_website/static/src/scss/_sobre_nosotros.scss',
            'bader_website/static/src/scss/_servicios.scss',
            'bader_website/static/src/scss/_ser_distribuidor.scss',
            'bader_website/static/src/scss/_clinica_dental.scss',
            'bader_website/static/src/scss/_laboratorio_dental.scss',
            'bader_website/static/src/scss/_estudiantes.scss',
            # 6. Shop Pages
            'bader_website/static/src/scss/_shop.scss',
            'bader_website/static/src/scss/_product_detail.scss',
            'bader_website/static/src/scss/_checkout.scss',
            # 7. Global overrides (last)
            'bader_website/static/src/scss/main.scss',
            # 8. JavaScript
            'bader_website/static/src/js/main.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
