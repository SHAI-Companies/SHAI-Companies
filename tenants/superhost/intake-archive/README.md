# Superhost Tenant — Persona Intake Archive

**Tenant:** Superhost Hospitality (tenant #001)
**Contents:** 14 filled persona intake forms used to voice-train Superhost-specific corporate-team personas.

## Why these are here, not in `/public/downloads/`

These PDFs contain personnel data (full names, role context, voice training inputs) for actual Superhost leaders. They were originally placed in `public/downloads/` while the platform was being built as Superhost's internal tool — meaning they were reachable at `https://<server>/downloads/SHAI-Persona-Intake-<Name>.pdf` by anyone who knew or guessed the URL.

For SHAI Companies as a commercial platform, that's not acceptable. Personnel-identifiable data must never be served from a public-routed path. These files now live under `tenants/superhost/intake-archive/`, outside of any web-served directory, and are accessible only via direct filesystem read by the server when generating Superhost's tenant personas.

## What's in `/public/downloads/` now

Only `SHAI-Persona-Intake-Form.pdf` — the blank, fillable template. That's safe to serve publicly: it's the form a new customer or persona subject fills out, with no real data in it.

## Future tenants

When SHAI Companies onboards a second customer, their persona intake archive lives under `tenants/<their-tenant-id>/intake-archive/`. Same isolation, same hygiene.
