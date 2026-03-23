{
    "name": "Bader Clerk Authentication",
    "version": "16.0.1.0.0",
    "category": "Authentication",
    "summary": "Replace Odoo native login with Clerk authentication",
    "description": """
        Integrates Clerk as the primary authentication provider for Odoo.
        - Redirects /web/login to Clerk hosted sign-in
        - Validates Clerk JWT tokens via JWKS
        - Auto-provisions res.users + res.partner from Clerk data
        - Supports webhooks for user sync
    """,
    "author": "Bader",
    "website": "https://bader4business.com",
    "depends": ["base", "web", "website", "bader_website"],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_config_parameter.xml",
        "views/res_config_settings_views.xml",
    ],
    "external_dependencies": {
        "python": ["PyJWT", "cryptography"],
    },
    "assets": {
        "web.assets_frontend": [
            "bader_clerk_auth/static/src/css/clerk_auth.css",
            "bader_clerk_auth/static/src/js/clerk_auth.js",
        ],
    },
    "installable": True,
    "auto_install": False,
    "license": "LGPL-3",
}
