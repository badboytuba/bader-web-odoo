# Bader Clerk Authentication

Installable Odoo 16 Community authentication module that replaces website login with Clerk while preserving native Odoo backend login.

## Target Stack

- Odoo `16.0` Community
- PostgreSQL compatible with Odoo 16
- Python environment used by the target Odoo instance

## Scope

- Redirect website login to Clerk
- Validate Clerk JWT tokens with JWKS
- Provision or link external Odoo users
- Process Clerk webhooks

## Odoo Dependencies

- `base`
- `web`
- `website`
- `bader_website`

## Python Dependencies

- `PyJWT`
- `cryptography`
- `requests`

Install them in the Odoo Python environment before installing the module.

## Installation

1. Copy both `bader_website` and `bader_clerk_auth` into an Odoo addons path.
2. Install Python dependencies in the same environment used by Odoo.
3. Update the app list.
4. Install `Bader Website`.
5. Install `Bader Clerk Authentication`.

CLI example:

```bash
odoo-bin -d <database> -i bader_website,bader_clerk_auth
```

## Configuration

Use `Settings > General Settings` and open the `Clerk Authentication` block.

Required values:

- `Clerk Publishable Key`
- `Clerk Secret Key`
- `Clerk JWKS URL`

Optional values:

- `Clerk Frontend API`
  - If present, the module can derive the JWKS URL automatically as `<frontend_api>/.well-known/jwks.json`.
- `Clerk Webhook Signing Secret`
- `Clerk Default User Group XML ID`

## Compatibility Notes

- Default parameter records ship empty. No environment-specific Clerk endpoint or secret is committed anymore.
- This module is intended to run on top of `bader_website`.
- Backend routes keep using native Odoo login.
- Website routes use Clerk only when Clerk is configured.

## Validation Notes

- The module installs with placeholder parameters; real Clerk values are configured after installation.
- A real `odoo-bin -i/-u bader_clerk_auth` run in the target environment is still recommended before production use.
