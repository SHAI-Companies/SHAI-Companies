# SHAI Companies — Strategic Hospitality Analytical Intelligence

**Purpose:** Commercial, multi-tenant AI platform for hotel-portfolio operators. Independent of any single operator's data, infrastructure, or branding.

**Owner:** Chris Hatfield · SHAI Companies · chris@shaicompanies.com

**Fork point:** 2026-05-15. Cloned from `Superhost Hub` codebase at the state immediately after session 9 of the operational hub build-out. Anything added to this repo from 2026-05-15 forward is exclusively SHAI Companies IP and not reflected in the Superhost Hub.

---

## Why this exists separately

The Superhost Hub (`C:\Users\Owner\Superhost Hub\`) is the **operational** dashboard for Superhost Hospitality — built for that one company, running their property list, ingesting their ProfitSage data, surfacing their corporate team in personas, and tuned to their canonical scorecard.

**SHAI Companies** is the **commercial intelligence platform** — designed to be sold to any hotel management company or owner group. It must be:

1. **Multi-tenant** — no hardcoded single-operator assumptions
2. **White-labelable** — brand identity is SHAI by default, but the platform supports tenant-specific branding
3. **Data-clean** — zero copies of any specific customer's portfolio data
4. **Architecturally independent** — improvements made here do not automatically flow to the Superhost Hub

This separation exists for three reasons:
- **Commercial:** to sell the platform without giving away IP that would compete with what we sell
- **Operational:** so Superhost Hub maintenance does not slow SHAI Companies feature work
- **Strategic:** to keep a clean line between "what one operator paid for as their internal tool" and "what we commercialize to the market"

---

## What was cloned vs. excluded on fork

### Cloned (carried over as starting state)
- `server.js` — the platform engine
- `public/` — dashboards, brand assets, HTML, CSS, JS
- `superhost-agents/` directory structure with:
  - `personas/` — only generic role archetypes (CEO, COO, CFO, CTO, CMO, CCO, CDO, CIO, Chief of Staff, VPs, GC, AGM, RVP) — all 17 archetype `.md` files
  - `skills/` — skill definitions (Monthly Close, Quarterly Rollup, etc.)
- `docs/` — design system, forecast stack spec, forecast evolution roadmap, ops notes
- `tools-*.py` and `tools-*.ps1` — utility scripts (review per-tool whether each is platform-generic or Superhost-specific)
- `package.json`, `package-lock.json`, `.gitignore`
- `build-howto.js`, `index.html`, brand asset templates

### Excluded (did NOT copy from Superhost Hub)
- `data.json` (95 MB of Superhost portfolio data — never lives here)
- `hub.log` (Superhost runtime log)
- `.env` (Superhost credentials including the Anthropic API key)
- `config.json` was copied but immediately sanitized — see below
- `superhost-agents/memory/` (per-persona memory tied to Superhost operations)
- `.git/` (no shared git history — SHAI Companies starts a fresh repo)
- `node_modules/` (reinstall with `npm install`)

### Sanitized on import
- `config.json` was overwritten with a clean template — original had Superhost ProfitSage credentials, the tag map for Superhost's 17 properties, and a plaintext Anthropic API key. None of that exists in this clone.

---

## How this differs from the Superhost Hub going forward

| Capability | Superhost Hub | SHAI Companies |
|---|---|---|
| Operational dashboard (Daily Flash, PSC, Owner Groups, Reports, etc.) | ✅ Maintained at current state | ✅ Inherited; will diverge as multi-tenant rework progresses |
| Demand AI forecast stack (Phases 1–8: PMS pace + Lighthouse + events + rate shop + risk scorecard + calibration loop + pickup curves) | ⛔ **Hidden from sidebar** as of 2026-05-15. Code remains in place but no longer surfaced. | ✅ Active. **All new forecast intelligence work happens here only.** |
| 24 named voice-trained personas (Tim Foley, Maura Bruen, Jill Uceny, etc.) | ✅ Stays — these are Superhost-specific | ⛔ Never imported |
| 17 role-archetype personas (CEO, COO, etc.) | ✅ Stays | ✅ Inherited; this is the second-layer review layer |
| Multi-tenant architecture | ⛔ Not built (single-operator) | 🚧 Roadmap — first commercialization milestone |
| White-labeling / brand customization | ⛔ Not built | 🚧 Roadmap |
| ProfitSage / Lighthouse / Opera integrations | ✅ Wired to Superhost | 🚧 Refactor to be tenant-configurable |
| Marketing site + brand identity | ❌ Not housed here | ✅ Lives at `C:\Users\Owner\Hatfield\shai-marketing-site.html` (separate repo) |
| Data ownership | Superhost | SHAI Companies (per-tenant model) |

---

## The Superhost narrative (when asked)

If anyone at Superhost asks why the Demand AI panel disappeared, the truthful framing is:

> "The intelligence layer was always experimental. I'm productizing it separately as SHAI Companies — too much capability to bundle into operational software, and frankly more than Superhost needs day-to-day. The dashboard stays exactly where it is. If Superhost wants the advanced forecasting capability as a service down the road, that conversation is open and Superhost gets first-look pricing."

This is true, defensible, and reframes "I'm taking it back" as "I'm offering it on better terms."

---

## Immediate next steps (in priority order)

1. **Run a clean `npm install`** in this directory to pull dependencies fresh.
2. **Verify the server boots** with the empty `data.json` and clean `config.json` — `ensureShape()` should fill defaults. Expect a working dashboard with no properties listed.
3. **Initialize a private GitHub repo** under your personal account (e.g., `github.com/<you>/shai-companies`). Push initial commit. **Do not** push the `.env` file (the `.gitignore` already excludes it).
4. **Decide the demo property scaffold** — what does a fresh SHAI install look like? Seed properties? Empty? Sample tenant?
5. **Multi-tenant refactor — Phase 1.** Pull all single-operator assumptions out of `server.js`:
   - `getPropertyList()` should read from per-tenant config, not be hardcoded
   - Config layout should support `tenants/{tenantId}/config.json` + `tenants/{tenantId}/data.json`
   - Routes should resolve tenant from subdomain or URL prefix
6. **Brand the dashboard for SHAI Companies** (not Superhost). The marketing site identity already exists — port the brand banner, logo, color treatment.
7. **Strip out hardcoded Superhost references** from `server.js`, `public/dashboard.html`, persona files, skill MDs. Search for "Superhost" globally.

---

## What to NEVER do in this repo

- Never copy `data.json` from Superhost Hub
- Never paste real Superhost property names, owner names, financial data, or employee names into any code, comment, or persona
- Never commit `.env` to git
- Never push this repo to a public GitHub account or org owned by Superhost
- Never reference Superhost-specific assumptions (e.g., "17 properties," "Tim Foley," "Hampton Inn Lex") in any production-facing UI, copy, or persona

---

## Long-term direction

SHAI Companies becomes the platform. Superhost Hub becomes one of many possible deployments (or, more likely, gets retired in favor of a Superhost tenant on the SHAI platform once multi-tenancy is built). The brand, the marketing site, the IP, the commercialization upside — all live here.
