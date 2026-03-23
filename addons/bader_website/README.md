# Bader Website

Installable Odoo 16 Community website module for the Bader storefront and account flows.

## Target Stack

- Odoo `16.0` Community
- PostgreSQL compatible with Odoo 16
- Python environment used by the target Odoo instance

## Scope

- Custom website pages, header, footer, shop and product detail UX
- Custom website/account routes and frontend assets
- Optional runtime integration with `bader_clerk_auth`

## Odoo Dependencies

- `auth_signup`
- `website`
- `website_sale`
- `website_sale_wishlist`
- `website_sale_comparison`
- `website_crm`

## Installation

1. Copy `bader_website` into an Odoo addons path.
2. Update the app list.
3. Install `Bader Website`.
4. Upgrade with `odoo-bin -d <db> -u bader_website` after code changes.

CLI example:

```bash
odoo-bin -d <database> -i bader_website
```

## Configuration

- Optional system parameter: `bader_website.internal_host_aliases`
  - Comma, space, or newline separated hostnames.
  - Used to normalize legacy absolute links to the current website host.
  - Example:
    - `shop.bader.com.ar`
    - `staging.bader.example`

## Compatibility Notes

- This module no longer requires `bader_clerk_auth` to render the website.
- If `bader_clerk_auth` is installed, the header/logout flows use Clerk automatically.
- The intended dependency direction is `bader_clerk_auth -> bader_website`.
- If `bader_product_intelligence` is installed, the product page can render its website content without creating a hard dependency from the intelligence module back to the website.
- Without Clerk, the website falls back to native Odoo login/logout.

## Validation Notes

- The module contains website views, controllers and frontend assets.
- A real `odoo-bin -i/-u bader_website` run in the target environment is still recommended before production use.
