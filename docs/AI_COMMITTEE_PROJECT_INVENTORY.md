# SHAI Hub — Project Inventory & AI Committee Brief

**Prepared by:** Chris Hatfield, Area General Manager
**For:** Superhost AI Committee — Jill Uceny (Systems & Analytics), Rafiq Sabir (VP Accounting & Finance), Maura Bruen (SVP Hotel Performance), Chris Hatfield (Area GM)
**Date:** May 2026

---

## Executive Summary

**What it is.** SHAI Hub is an internal, AI-powered operating platform for the Superhost portfolio. One application. One data store. Every property's financials, STR position, forecast, scorecard, and operating signals — pulled live from ProfitSword, normalized across 17 active hotels, and surfaced to a single executive cockpit. AI is wired into every panel: 17 executive personas, multi-persona council deliberation, weekly portfolio scan, owner-letter drafting, brand-letter triage, capital-project response generation.

**Where it stands.** Production-grade. Running 24/7 on internal infrastructure. Auto-starts on logon, auto-refreshes from ProfitSword every 4 hours starting at 06:30. 7 build sessions over the last 60 days, 40+ commits, ~70,000 lines of code under version control. Used daily by Area GM for portfolio review, weekly for GM coaching, monthly for owner reporting.

**What this brief is.** A complete inventory of what's built, what's in flight, what's pending decisions the committee can make. Organized so each committee member can find their function's work in one place.

---

## What's Built — by Committee Member Function

### Systems & Analytics (Jill)

The technical platform itself. This is the layer the rest of the work sits on top of.

| Capability | Status | Notes |
|---|---|---|
| **ProfitSword integration** | Production | Auto-polls 4× daily; 17 properties × 48 monthly periods cached locally. Resilient to API blips. |
| **Data normalization layer** | Production | PS chart of accounts → USALI categories. Department-level P&L (Rooms, F&B, A&G, S&M, Maint, Util, Fixed). |
| **Atomic persistence** | Production | All writes are temp-file + fsync + rename. Crash-safe. Serialized through a write queue. Audit trail preserved. |
| **Pro-rate engine** | Production | MTD actuals compared against day-prorated budget for current-month apples-to-apples. Stored raw values preserved for traceability. |
| **In-process caching** | Production | `/api/portfolio-trend` with 60s TTL; cold ~3s, warm ~80ms. |
| **Auto-start service** | Production | WMI-spawned Node process, survives logon/reboot. Defensive duplicate-instance detection. |
| **Web UI** | Production | Single-page dashboard, 22 panels, mobile-responsive sidebar, brand-aligned theme. |
| **BI / data export** | Production | CSV export for Daily Flash, Demand AI, Scorecard, P&L. |
| **API surface** | Production | 50+ REST endpoints under `/api/*`. All authenticated. Documented inline. |
| **Hosting model** | Production | Localhost, no cloud dependency. Can be lifted to LAN-accessible or cloud-hosted without changes. |

**Pending committee decision in this domain:**
- **M3 Accounting integration.** Currently only Citrix-delivered Accounting Core is available (no API). Three paths drafted: (a) scheduled CSV exports from Accounting Core into a watched folder, (b) upgrade to M3 Cloud + API tier, (c) keep manual entry. Path A is the lowest-cost compromise. Requires M3 vendor confirmation and a budget decision.
- **STR API access.** Email draft prepared (`docs/INTEGRATION_REQUESTS.md`), pending send. STR is partially redundant since PS now feeds comp-set data, but a direct STR API would close the gap on weekly cadence.

---

### Accounting & Finance (Rafiq)

Tier 1 (P&L) is live. Tier 2 (Balance Sheet) and Tier 3 (General Ledger) are scaffolded but pending M3 access.

| Capability | Status | Notes |
|---|---|---|
| **USALI-aligned P&L** | Production | Department-level revenue, expense, labor, profit. MTD / QTD / YTD / TTM scopes. Portfolio / Owner Group / single property. Excel + PDF export. |
| **Variance analysis** | Production | Actual vs Budget vs LY across every line item. Dollar variance with % variance. |
| **Flow-Through tracker** | Production | GOP variance ÷ Revenue variance. Denominator-guarded against divide-by-zero noise. Display capped at ±200% with raw value in tooltip for outliers. |
| **NOI calculation** | Production | Distinct from GOP. Includes management fees, FF&E reserve, fixed costs below the GOP line. |
| **Forecast Accuracy (GOP)** | Production | Day-1 locked Primary Forecast snapshots per property/period. Auto-captured on first PS refresh of the month. Scored against actuals at month close per scorecard rubric. |
| **Performance Scorecard (PSC)** | Production | 11-metric, 4-category rubric. 25 / 100 / 200 points at min / budget / max. Just aligned to the canonical March 2026 Excel scorecard. Three new scoring tiers: Google Score (4.0/4.5/4.7 → 0/2.5/5), Community Engagement (Fail/Pass/Exceed), Forecast Accuracy (beat-by 4%/5%/5.5% → 5/20/40). |
| **Daily Flash** | Production | Daily P&L pulse from PS. Per-property revenue + occupancy + flow. |
| **Owner letters / monthly statements** | Production | Per-owner group, USALI rollup, with narrative AI-drafted in CFO voice. |
| **Audit trail** | Production | All saves preserve `createdAt` / `updatedAt`. Snapshot files retained for reconstruction. |
| **Tier 2 — Balance Sheet** | Scaffolded | UI built. Data source pending M3 integration. |
| **Tier 3 — GL transaction detail** | Scaffolded | UI placeholder + connector module stub. Pending M3 GL API. |

**Pending committee decision in this domain:**
- **Balance Sheet activation.** Once M3 Path is chosen, Tier 2 BS lights up. Manual entry possible but doesn't scale to 17 properties × monthly. Owner reporting upgrade gates on this.
- **Owner Reporting v2.** Current monthly statements are P&L-only. The committee can prioritize adding rolling 12-mo cashflow, distribution model, debt-service coverage. Demand exists from at least two ownership groups.

---

### Hotel Performance (Maura)

This is the largest body of work — everything that defines portfolio operating quality.

| Capability | Status | Notes |
|---|---|---|
| **Today landing — visual cockpit** | Production | Hero NOI sparkline with 12-month real history, Pulse ribbon (6 mini-KPIs), Property Health heatmap (17 tiles with 5-letter PMS codes), Portfolio Trend chart (Chart.js, metric toggle), Property Scatter (RGI × Score × NOI). |
| **Property drill modal** | Production | Click any heatmap tile → single-property view with 6-KPI ribbon, Forecast Posture, Key Contacts (GM/AGM/DOS/Owner/RDO/RSM with mailto/tel), filtered Watchlist / Actions / Decisions, quick-action buttons. |
| **Forecast tab** | Production | Current-month forecast vs budget (6 KPI cards), 30/60/90-day forward outlook, quarterly forecast view, GM Forecast Credibility (4-metric per property), Flow-Through Tracker. |
| **Performance Scorecard** | Production | Per-property scoring against the 11-metric rubric. Top 5 highlighted with gold badge. PDF export. |
| **Leaderboard** | Production | All properties ranked. Score, RevPAR, Occ, ADR, GOP, Flow, RGI. Sort + filter. |
| **STR Intel** | Production | Comp-set RGI / ADR Index / Occ Index by property, brand-family filter. Weekly STR commentary entry per property. |
| **Demand AI** | Production | 3/6/9/12-month forecast by property. Multi-segment (transient/group). CSV export. |
| **GM Forecast Credibility** | Production | Per-property: actual vs Primary Forecast variance, count of forecast revisions, magnitude of last revision, days-from-month-close at lock. The signal that separates real operators from sandbaggers. |
| **GM Digest** | Production | Auto-generated weekly performance summary per property. Owner-ready format. Email or print. |
| **Watchlist / Decisions / Actions** | Production | Persona-emitted commitment tracking. Every AI response can append a fenced `track` block that schemas into one of three categories with owner + due date + property scope. |
| **Comp Set comparison** | Production | Property vs comp-set delta for each STR index. Used to triage rate strategy vs product issues. |
| **GM Bench / Succession** | Production | Per-property: GM tenure, performance, potential, risk level, designated successor (AGM), readiness state. Auto-synced from corporate contacts roster. |

**Pending committee decision in this domain:**
- **PSC Last Year Total Revenue scoring.** Sheet allocates a row but 0 points for Home2 Lex. Open question: do we want this scored, and at what tier weights?
- **PSC Retention bands.** Currently `≤40% / ≤50% / ≤65%` turnover for max / bud / min. Maura to confirm these match her playbook.
- **Forecast Accuracy at month 1.** Properties that don't have a Day-1 snapshot for January 2026 because the system wasn't live then. Two-month gap. Either backfill with manual values or score 0 on those months.

---

### Area GM / Operations (Chris — my function)

This is where I bring all of the above into weekly operating rhythm.

| Capability | Status | Notes |
|---|---|---|
| **Daily portfolio scan** | Daily use | Today landing → 17-property heatmap → drill into anything red → assign action. 5 minutes. |
| **Weekly GM coaching prep** | Weekly use | GM Forecast Credibility + Top/Bottom 5 + Scorecard ranking. Feeds the per-GM 1:1. |
| **Monthly owner letter draft** | Monthly use | CFO-persona AI draft + my edit pass + Maura review + send. Was 4 hours per owner; now ~30 minutes. |
| **Brand QA audit prep** | Per-audit | Persona-driven 30-day prep checklist (brand standards, property tour, deficiency response). |
| **Capital project response (PIPs)** | Per-PIP | VP Capital persona drafts pushback positions on unreasonable PIP scope. Saves multi-day legal/cap-projects ping-pong. |
| **Crisis playbooks** | On-demand | General Counsel + COO + VP People personas convene for incident response (guest injury, ER complaint, brand letter). |

---

## AI Infrastructure — How It Actually Works

For Jill especially — this is the AI engine that powers everything above.

### Personas (17 executive agents)

Each persona is a long-form system prompt encoding voice, judgment, decision speed, escalation rules, and analytical sequence. Currently file-backed at `superhost-agents/personas/<role>.md`. Roles covered:

**C-Suite (10):** CEO, COO, CFO, CDO, CIO, CTO, CMO, Chief Compliance Officer, Chief of Staff, General Counsel
**Corporate VPs (6):** VP Revenue Management, VP Sales & Marketing, VP People, VP F&B, VP Capital Projects, General Counsel
**Regional (2):** Regional VP, Area General Manager

### Persona Intake Forms (custom personas — the 14 corporate leaders → 15 with me added)

Every corporate leader can become a *custom* AI agent representing their actual voice and judgment. The intake form captures 10 sections / ~60 fields covering identity, authority, how-they-read-data, ownership-facing approach, voice & style, decision-making, priorities, voice samples, constraints, and personal touches. Once a leader's intake is 100% complete, their card on `/team.html` flips to "★ Agent" — click it and you're chatting with that specific person's AI persona. PDF intake form downloadable per leader for email distribution.

**Currently:** I'm filling out my own intake (Area GM) in this session. None of the other 14 have started.

### Skills (14 high-leverage persona moves)

Each persona has 1–2 *skills* — multi-step plays the persona is best at. Activated by `[SKILL: <id>]` prefix in any chat. Examples: `chief-of-staff-monday-digest`, `general-counsel-brand-letter-triage`, `cfo-monthly-owner-letter`, `vp-capital-pip-response`, `area-gm-property-pulse`, `psc-review`, `portfolio-quarterly-rollup`.

### Multi-persona modes

- **Council** (`/api/council`): Convene 2–8 personas around a single strategic question. Each speaks in their voice. Chief of Staff synthesizes the leadership recommendation — alignment, tensions, the call, specific moves. The deliberation no single-persona conversation can produce.
- **Scan** (`/api/scan`): 4 scanners (COO, CFO, VP RM, VP People) run in parallel — each surfaces 2–3 multi-property patterns from their lens. Chief of Staff synthesizes a leadership brief. Pattern detection no single property review can show.
- **Sibling skill handoff**: Any skill can suggest the next skill to run. UI surfaces a one-click chain — e.g. PIP triage → capital response → owner letter.

### Model

Anthropic Claude via API (current default: Claude Opus 4.7). Server-side only — no client-side keys, no leaked credentials. Rate limited. 90s timeout on every call. Validated response shape (never silently returns empty). Snapshot-aware system prompt (current portfolio data injected on every call, so the AI sees live numbers).

### Cost & rate management

- Council fans out 2–8 calls serially with 4s pauses (not parallel) — gentle on Anthropic rate limits, gentle on the org-level Sonnet budget.
- Lite-mode portfolio snapshot for high-fanout calls (drops historical sections, caps cockpit blocks at top 5; ~5K tokens vs ~13K).
- All AI usage runs through one API key — visible cost line.

---

## Brand & Communications

| Capability | Status | Notes |
|---|---|---|
| **SHAI brand system** | Production | Pink + blue gradient identity, glass cockpit aesthetic, design tokens documented in `docs/SHAI_DESIGN_SYSTEM.md`. |
| **Splash sequence** | Production | 12-second brand reveal → dashboard preview → team preview → main app. Esc/Enter to skip. |
| **60-second leadership reel** | Production | 12-scene animated teaser at `/teaser.html` with ElevenLabs voiceover (Sawyer voice). Audio-driven scene transitions. For owner / lender / investor pitches. |
| **Owner portal** | Production | Read-only `/owner` page with PIN-protected per-owner-group access. Each owner sees only their properties' performance. |
| **Public marketing site** | Out of scope | Separate from this hub. |

---

## Architecture (one-paragraph version for the committee)

Node.js (Express) on Windows, runs as a Task Scheduler entry that survives logon. Serves a single-page dashboard.html with 22 navigable panels. All data lives in `data.json` (~90 MB, atomic writes, append-only commitment log) and `config.json` (server clock derives active period dynamically — never persisted). ProfitSword polled every 4 hours; data normalized into department-level P&L. Claude API calls server-side only. Owner portal token-authenticated per owner group. Connectors module scaffolded for STR + M3 + Hotel Effectiveness (pending API access). Audit trail on every write. Tested for crash recovery, concurrent writers, and API blips. Git-versioned, ~70K LOC, 40+ commits in the last 60 days.

---

## In Flight (current session)

1. **My own persona intake form.** Just started. ~60 fields across 10 sections. When complete, my AI agent goes live for Council / Scan / chat.
2. **PSC scoring alignment to March 2026 sheet.** Just shipped. Three metrics rewired to match (Google Score 3-tier, Community Engagement 3-tier with exceed flag, Forecast Accuracy beat-by-X% logic). Total at budget = 100, matching the company scorecard.
3. **Period dropdown sync fix.** Just shipped. Header dropdown, admin period dropdown, and compare slots all now read from a single sync function. Removed a server-clock override that was causing visible drift.
4. **Today landing — Forecast Drift fix.** Just shipped. `safeName` ReferenceError in Owner Groups was cascading and killing Forecast + Owner panels. Fixed.

---

## On Deck — Decisions the Committee Can Make

| # | Decision | Recommended path | Blocker |
|---|---|---|---|
| 1 | M3 Accounting integration | Path A: scheduled CSV exports | Vendor / budget |
| 2 | STR direct API | Send the request | Maura to send |
| 3 | Hotel Effectiveness labor API | Send the request | Email draft ready |
| 4 | PSC Last Year Total Revenue scoring | Define point weights | Maura |
| 5 | PSC Retention bands confirmation | Confirm `≤40 / ≤50 / ≤65` matches playbook | Maura |
| 6 | Distribute persona intake PDFs | Email the 14 corporate leaders | Chris to coordinate |
| 7 | Owner Reporting v2 (cashflow + DSCR + distribution) | Scope after Tier 2 BS lands | Gates on M3 |
| 8 | Flow-Through "Flex-Flow Score" rename + standard formula sister metric | Decision deferred from session 6 | Maura / Tim |
| 9 | Job Postings weekly sync (Google Drive) | Three paths drafted, awaiting decision | Chris |
| 10 | LAN / cloud accessibility | Currently localhost-only on Chris's machine. Should others access directly? | Committee |

---

## What I'd Bring to the First Committee Meeting

**The story.** From a blank repo to a 17-property AI operating platform in 60 days. Built by one operator, AI-assisted at every step. This isn't a vendor product. It's our own infrastructure, owned, versioned, controllable.

**The proof.** Live demo of:
1. Today landing — visual cockpit, drill into any property in two clicks.
2. PSC for any property — same 100/200 structure as the master Excel scorecard, just live and click-through-able.
3. Owner letter draft — single click, CFO-persona generates the narrative for any owner group's monthly statement.
4. Council deliberation — pose a real strategic question, watch 4 personas weigh in, Chief of Staff synthesizes.

**The ask.**
- Go/no-go on M3 Path A (the only thing blocking Balance Sheet).
- Maura's commitment to fill her persona intake first (anchors voice for owner letters).
- Committee charter: cadence, scope, decision rights. I propose monthly meeting with rolling agenda from this decision queue.

**The roadmap.**
- **Next 30 days:** Balance Sheet live (assumes M3 Path A). All 14 corporate leaders intake forms complete. PSC scoring fully ratified by Maura.
- **Next 90 days:** Owner Reporting v2 (cashflow + DSCR). Quarterly portfolio rollup automated. AI-drafted board materials.
- **Next 6 months:** Predictive operating signals (RGI trend → rate action recommendation; GSS trend → property visit trigger; turnover trend → HR intervention).
- **Year 1:** SHAI Hub becomes the system of record for ownership communication, with audit trail and owner read-only access.

---

## Appendix — File / Code Locations (for Jill)

| Layer | Path |
|---|---|
| Server entry | `server.js` |
| Routes | All `/api/*` routes in `server.js` (sectioned with comment banners) |
| Main UI | `public/dashboard.html` (single-page, ~9000 lines) |
| Team page | `public/team.html` |
| Persona intake UI | `public/persona-intake.html` |
| Owner portal | `public/owner.html` |
| Persona system prompts | `superhost-agents/personas/<role>.md` |
| Persona intake schema | `superhost-agents/personas/intake-schema.json` |
| Skills | `superhost-agents/skills/<skill-id>/SKILL.md` |
| Custom personas (intake-built) | `data.personas[<slug>]` in `data.json` |
| Brand assets | `public/brand/` |
| Importers | `tools-*.py` |
| Architecture doc | `superhost-agents/HUB_ARCHITECTURE.md` |
| Operations doc | `docs/HUB_OPERATIONS.md` |
| Design system | `docs/SHAI_DESIGN_SYSTEM.md` |
| Session handoffs | `docs/SESSION_HANDOFF.md` |
| Integration requests | `docs/INTEGRATION_REQUESTS.md` |

---

*This document is a living inventory. Update as new capabilities ship and committee decisions land.*
