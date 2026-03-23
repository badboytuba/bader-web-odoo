# Module Portability Notes

## Current dependency graph

- `bader_website`
  - base website module
- `bader_clerk_auth`
  - depends on `bader_website`
- `bader_product_intelligence`
  - independent

## Recommended installation order

1. `bader_website`
2. `bader_clerk_auth` if external website login is required
3. `bader_product_intelligence`

## What was normalized

- `bader_website` no longer requires the Clerk custom field to exist at render time.
- Clerk configuration is now explicit in Odoo settings instead of shipping a fixed development endpoint.
- Website domain normalization now accepts configurable aliases through `bader_website.internal_host_aliases`.
- `bader_product_intelligence` no longer depends on `bader_website`; website rendering is handled as an optional bridge on the website side.

## Remaining intentional coupling

- `bader_clerk_auth` intentionally depends on `bader_website`.
- `bader_website` may render Product Intelligence fields when that module is also installed, but `bader_product_intelligence` itself stays installable on its own.
