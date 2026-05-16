# Session Handoff — Pick up here next session

Last updated 2026-05-13 (end of **session 9** — the forecast-stack session).
**Read this first when starting a new conversation.**

Session 9 was a major build. The eight forecast-stack phases shipped end-
to-end: data ingestion (PMS pace + Lighthouse Rev Pak + Opera reports +
events via Claude web_search + Layer-4 rate shop) → AI forecast quality
evolution (segment-grain output → daily confidence + anomaly + Risk
Scorecard → pickup-curve foundation → adaptive calibration feedback loop).
Two canonical strategic docs were captured: `docs/SHAI_FORECAST_STACK.md`
(6-layer data architecture) and `docs/FORECAST_EVOLUTION.md` (Chris's
11-point critique of the forecast + 4-priority roadmap, now all addressed
foundationally). The AI Committee met **2026-05-18** — that's now behind us;
pivot to operating-mode use of the stack.

Session 8 recap preserved below as archive.

---

## What session 9 shipped (2026-05-13)

Eleven commits, an end-to-end forecast intelligence platform. All work
done on `master`. Each phase maps to a specific layer of the spec docs.

### Phase 1 — PMS pace ingestion (commit `d2e61f2`)

- Canonical `data.pmsPace[propId][asOfDate]` schema with per-stayDate
  rows × segment (transient/group/contract/wholesale/other) carrying
  `otbRooms`, `otbRev`, `adr`, `pickup1d`, `pickup7d`, `lyOtbRooms`,
  `lyOtbRev`, `leadTimeDays`, `channelMix`.
- Three endpoints: `POST /api/pms-pace/import`, `GET /api/pms-pace/:propId`
  (index + detail), `DELETE /api/pms-pace/:propId/:asOfDate`.
- Drag-drop zone on the Demand AI panel — accepts CSV/TSV/TXT/XLSX, auto-
  detects delimiter from the first line, lazy-loads SheetJS only on first
  XLSX drop. File bytes never persist server-side.
- Parser registry pattern: each brand registers a `signature(headersLower)`
  + `parse(rows, headers)` pair. **Hilton Opera** parser landed first —
  validated against Holiday Inn Lex resfutureoccupancy.txt. RESV_TYPE map
  + RESV_TYPE_SKIP set so "Block Rooms Not Picked Up" and the "All
  Reservations Combined" totals row are deliberately excluded from import.

### Phase 2 — Lighthouse Rev Pak + day-by-segment drill-down (commit `1fe4470`)

- Lighthouse "Rev Pak" xlsx parser: detects "90 Day Segments" sheet,
  extracts Transient/Group/Contract CY + LY per day, posts to import as
  source=`lighthouse`. asOfDate auto-extracted from filename
  `*_YYYY-MM-DD.xlsx`. ~270 canonical rows per drop (90 days × 3 segments).
- New click-to-drill-down: each Period cell in the 3-Month Forward Forecast
  table is now a link. Click → modal with daily × segment table (rooms,
  ADR, rev per segment + total + LY block when present). Snapshot source
  + asOfDate shown in modal header.
- Daily-forecast endpoint pulls latest pace snapshot per property (Lighthouse
  preferred over Opera on a same-day tie), pivots to daily × segment, injects
  as `paceContext` in the Claude userPayload.
- System prompt PACE DATA block: anchor to actual OTB by segment, use LY as
  sanity benchmark, fall back to history when paceContext is null.

### Phase 3 — Segment-grain AI forecast (commit `e18aba8`)

- Output schema expanded: each day in `days[]` now requires `transient`,
  `group`, `contract` objects (rms/adr/rev each). `monthlyTotal` aggregates
  per segment.
- System prompt: SEGMENT FORECASTING block with anchoring rules + arithmetic
  consistency requirements (segments sum to day total, days sum to monthly).
- Actuals overlay + back-cast logic updated to scale segment .rev fields
  together; rooms left alone (no segment-level rooms actuals available).
- Client `renderDailyForecast` rebuilt with 14-column segment grid matching
  the pace drill-down. Same units, side-by-side comparability.

### Phase 4 — Events / compression layer (commit `f3bccc5`)

- `callClaudeWithWebSearch` helper wraps the Anthropic `web_search_20250305`
  server tool — single round-trip, Claude handles the search loop server-side.
- `lookupEventsForProperty(prop, period)` builds a location-aware prompt
  (property city + state + target month), parses strict JSON array output
  (concert/sports/convention/festival/graduation/corporate/religious/other),
  validates each entry. Verified end-to-end for Holiday Inn Lex June 2026 —
  pulled Railbird Festival, Monster Jam, Carly Pearce, etc.
- 48-hour cache at `data.events[propId][period]`. Forecast endpoint fetches
  events for the target period and injects as `events` in userPayload.
- System prompt EVENTS CONTEXT block with per-tier demand effect ranges
  (high +15-30 pts, medium +5-15, low +2-5) and event-type behavior rules
  (sports peaks Fri-Sun, conventions Sun arrival / Thu departure, etc.).
- Visible UI: events pill row above the heatmap, color-coded by impact.

### Phase 5 — Layer 4 (rate shop + Lighthouse curated events) (commit `9cdcad8`)

- Lighthouse parser extended to also read **365 Day Outlook** sheet from the
  same Rev Pak xlsx. Per-date extraction: own BAR, comp set avg BAR, 5
  individual competitor BARs, hurdle, Lighthouse-curated events, Lighthouse
  forecast rooms, 7-day pickup velocity (rooms + ADR).
- `outlook` payload travels alongside `rows` in the import request. Server
  validates, stores on the same snapshot under `outlook[stayDate]`.
- Daily forecast: each `paceContext.daily[X]` now carries the Layer-4 fields
  when source=lighthouse. New `paceContext.pricingIntel` summary block tells
  Claude how many dates carry the intel + lists the 5 comp set members by
  name.
- System prompt PRICING INTELLIGENCE block: ownBar vs compSetAvg ±5%
  bands, hurdle as hard rate floor, lhForecastRms cross-check threshold,
  reference competitors by name in rationale.

### Bumped Sonnet default + 429 retry wrapper (commit `a82e0c1`)

- `CLAUDE_MODEL` default bumped `claude-sonnet-4-20250514` →
  `claude-sonnet-4-6`. The 4.6 release has higher per-minute input-token
  cap on the same Anthropic tier.
- `callClaude` and `callClaudeWithWebSearch` now retry on 429 with
  `Retry-After`-aware backoff (up to 2 retries). 5xx errors get one quick
  retry. Recovers gracefully from transient rate-limit collisions.

### Bulletproofed JSON parse + richer error surface (commit `aae1804`)

- Daily-forecast `JSON.parse` now strips ANY markdown fence variant, then
  locates first `{` and last `}` to slice the JSON object out of any
  surrounding prose. Tolerates the verbosity newer models occasionally
  emit despite "no prose" instructions.
- maxTokens bumped 6000 → 8000 (then to 12000 in Phase 6) — segment-grain
  output runs long.
- Response on parse failure now includes `parseError`, `rawPreview`,
  `cleanedPreview`, `hint`. Client renderer surfaces these inline with
  an expandable raw-output details block + Retry button.

### Phase 6 — Trust & transparency: daily confidence + anomaly + Risk Scorecard (commit `e97a295`)

- Output schema expanded again: each day requires `confidence` ("high"|
  "medium"|"low") and may emit `anomaly { severity, paceVsLyPct?, note }`.
  New top-level `riskScorecard` block with 6 required dimensions:
  `paceRisk`, `adrRisk`, `washRisk`, `compressionOpportunity`,
  `groupDependency`, `otaExposure` — each {tier, note}, generic notes
  rejected (must reference data).
- Major system prompt additions: CONDITIONAL REASONING (5 diagnostic
  branching patterns), DAILY CONFIDENCE rules, ANOMALY DETECTION rules,
  RISK SCORECARD tier thresholds, STRENGTHENED ADR LOGIC (±3%/±8% bands
  vs ownBar/compSetAvg), EVENT QUANTIFICATION (numeric lift ranges by
  impact tier).
- maxTokens bumped to 12000 to fit the richer output.
- Client renderer: Risk Scorecard 6-tile row above the heatmap (tier-
  colored), per-day confidence dot in heatmap cell corners, ⚠ anomaly
  indicators inline. Daily detail table got a Conf column.
- Smoke-test against Holiday Inn Lex June 2026 produced specific
  diagnostic notes ("Monster Jam Sat OTB 23 rms is WELL BELOW high-impact
  event expectation") — the conditional reasoning the critique demanded.

### Phase 7 — Longitudinal pickup curves foundation (commit `306715f`)

- `buildPickupCurve(data, propId, stayDate)` helper walks back through all
  stored snapshots, finds rows matching the stayDate, computes leadDays
  per snapshot. Returns sorted earliest-to-most-recent.
- `GET /api/pickup-curve/:propId/:stayDate` standalone endpoint.
- Daily forecast: each `paceContext.daily[X]` now carries `pickupHistory`
  (compact `{ld, r}` array, last 8 entries, ≥3 points threshold). Stays
  null today since only one snapshot exists per stay date.
- System prompt PICKUP CURVE REASONING block: compute velocity per
  rolling 7-day window, compare CY velocity to LY at equivalent lead time,
  flag decelerating-inside-21-days as real pace gap, lean into stronger
  forecast when velocity exceeds LY's curve.
- **Foundation only — the analytical payoff matures as Rev Paks accumulate.**
  After ~3 weeks of weekly drops, pickup curves activate per date. After
  ~12 weeks, statistically robust.

### Phase 8 — Adaptive feedback loop (commit `d518962`)

- New `data.forecasts[propId][stayDate]` storage: every AI daily-forecast
  generation appends future-day predictions with `generatedAt`, `leadDays`,
  occ/adr/revpar/revenue + per-segment fields. Capped at 12 entries per
  stay date, auto-pruned after stay date is >60 days in the past.
- `buildCalibrationContext(data, propId, asOfDate, windowDays=30)` walks
  `data.forecasts` for past stay dates inside the window, picks the
  most-recent forecast made ≥1 day before each stay, joins against
  `data.dailyPtd` for single-day actual revenue, computes:
  * avgRevDeltaPct (overall bias)
  * bias label (`forecast-optimistic` / `forecast-conservative` /
    `well-calibrated` / `unknown`)
  * dowPattern (% delta by day-of-week)
  * leadBandPattern (% delta by lead-time band: 0-3 / 4-7 / 8-14 / 15-21 / 22+)
- `GET /api/forecast-calibration/:propId?windowDays=N` standalone endpoint.
- Daily-forecast prompt injects `calibrationContext` (null when no scoreable
  pairs). FORECAST CALIBRATION system prompt block tells Claude to apply
  calibration as a TRIM, weight by pairsScored, adjust by DOW when material,
  reference in rationale when shaping the forecast.
- Visible UI: Model Calibration panel between events strip and heatmap
  showing bias label + avg %, top-4 DOW patterns by abs magnitude, lead-band
  breakdown. Hidden friendly note when no pairs scored yet (today's state).
- **Foundation only — the loop closes measurably after ~2-3 weeks of
  regular forecast usage as past predictions persist + dates pass + PTD
  snapshots align.**

### Brand Compare POR rework (Tim Foley feedback) — committed in `2f30290`

- Table flipped: rows = cost lines, columns = same-brand properties +
  Brand Avg. Values are $ per occupied room (period cost ÷ rooms sold).
- Cost lines per Tim's spec: Breakfast · Room Attendants · Guest Supplies ·
  Cleaning Supplies · IT Expense · S&M · A&G · R&M · Utilities + two
  context roll-ups (Total Rooms Labor, Total Rooms Expense).
- Cost-opportunity panel ranks (property × cost line) overages vs the
  brand-avg POR with $ savings if each laggard hit the cohort average.
- 4 manual cost fields added to `PSC_MANUAL_KEYS` + `DE_FIELDS_FINANCIAL`
  (`rmAttCost`, `guestSupplies`, `cleaningSupplies`, `itExpense`) so manual
  entries survive PS refresh until those sub-tags are wired.
- Markdown export rewritten to match the new shape.

### Role-agent QA layer (committed in `d2e61f2`)

- File-backed role personas (CEO, COO, CFO, all VPs, Regional, AGM)
  surfaced as a **compact chip strip** under the corporate-team card grid
  on team.html (NOT on the dashboard cockpit per Chris's "where the
  executive team lives" direction).
- `SECOND_LAYER_REVIEW_MANDATE` const in server.js — concatenated onto
  every file-backed role persona's prompt at chat time. Directs role
  agents to audit math, stress-test conclusions, surface what's missing,
  pressure-test anchors, name unknowns, watch for confirmation bias.
- New `GET /api/agents/role/:role/prompt` endpoint returns persona body +
  mandate pre-concatenated.
- Click chip → `selectAgent({role, custom: false})` → chat routes through
  `/api/ai/chat/:role` which fires the mandate.
- Named corporate-leader personas (`custom:<slug>`) explicitly do NOT
  get this mandate — they're the FIRST layer.

### Email signature work (untracked, in Hatfield workspace)

- `C:\Users\Owner\Hatfield\chris-hatfield-signature.html` — Chris's email
  signature, self-contained HTML with base64-embedded logo. Uses the new
  SHAI Companies logo (transient from `ChatGPT Image May 12, 2026, 07_33_03 PM.png`,
  resized to 320×194 JPEG, ~6.9KB base64).
- Signature fields: Chris Hatfield · Owner · SHAI Companies · (859) 421-4802 ·
  chris@shaicompanies.com. Brand colors per the SHAI design system.
- Brand assets saved to `public/brand/shai-logo-companies-email.{png,jpg,b64.txt}`
  but **not committed** — Chris's personal artifact, not Hub feature work.

---

## ⚠ What's worth picking up next session

### 1. Maturation of Phase 7 + Phase 8 foundations (passive — needs weekly Rev Pak drops)

The pickup-curve + calibration loops are FOUNDATIONAL. They activate as
data accumulates. Chris's operational ask: drop the Lighthouse Rev Pak
**weekly** (or have someone on the team do it). Each drop:
- Adds one data point to every stay-date's pickup curve
- Refreshes the rate-shop / event / LY-comparable data

After ~3 weekly drops the pickup curves activate per date. After ~2-3
weeks of regular forecast usage the calibration loop measurably closes.
If Chris stops dropping mid-stream, both layers stagnate.

### 2. The leaked Anthropic API key (URGENT — still pending from session 8)

`.env` line 17 has Chris's real key, exposed in a prior session's chat
transcript. Same flag was in session 8's handoff and **still hasn't been
done**. Steps: console.anthropic.com → API Keys → revoke current →
generate new → paste into `.env` → restart hub.

### 3. Anthropic tier upgrade (Chris's billing decision)

10K input-TPM cap on the current tier was the constraint behind the
session 9 model bump (Sonnet 4 → 4.6) + 429 retry wrapper. Memory at
`project_anthropic_tier_limits.md`. If Chris regularly runs heavy
forecasts + events lookups + role-agent chats simultaneously, the cap
will keep biting. Console.anthropic.com → Settings → Limits to bump
tier. Tier upgrade is the only STRUCTURAL fix; everything else is
mitigation.

### 4. Layer 5 — Hotel Effectiveness operational layer (still pending)

The forecast-stack spec's Layer 5 is operational data: labor
productivity, minutes per occupied room, OOO trends, GSS scores.
Integration request was drafted in session 6 at `docs/INTEGRATION_REQUESTS.md`
and **never sent**. Sending it unlocks GOP/flow-through forecasting on
top of the demand layer that's now built. Chris's call when to fire.

### 5. Booking-window distributions + wash patterns (Priority 1 sub-items)

Chris's critique called out OTA 0-5d / Corp 7-14d / Group 30-120d /
Loyalty 3-10d as a missing layer. The data isn't in current uploads —
needs PMS rate-code production reports + cancellation/no-show reports.
Once those are uploaded (new schema + new drag-drop file detection),
Phase 6's daily forecast prompt could reason about which segment is
likely to fill which window.

### 6. The ESS Occ PS tag (still pending from session 8)

Brand Compare's ESS Occ column reads `—` until Chris hits
`/api/ps/debug/041` and surfaces the actual PS tag for Extended-Stay
occupancy. Until then, ESS Occ requires manual entry via Data Entry.

### 7. AI Analytics tier decision (still pending from session 8)

Tier 1 (daily Smart Signals widget on Today landing) was recommended
in session 8 as a committee-demo win. The Monday May 18 committee
meeting has now passed — was Tier 1 built? Decision still parked.

### 8. Pickup-curve drill-down UI (Phase 7B, deferred)

The pickup curve endpoint exists. The drill-down modal could show a
small sparkline per stay date once curves accumulate. Built it later
when there's data worth visualizing.

### 9. The strategic IP / commercialization question (still parked from session 8)

Chris wants to retain rights to SHAI and commercialize in 2027. Five
recommended paths in session 8 handoff. No update on whether the
lawyer consult or the Samir/Ash conversation happened.

---

## Forecast Stack — current architecture map

Six data layers per `docs/SHAI_FORECAST_STACK.md`:

| Layer | What | Status |
|---|---|---|
| 1 — PMS demand | OTB by segment, pickup, lead time | ✅ Opera + Lighthouse |
| 2 — STR / market | MPI/ARI/RGI, CY+LY comparables | ✅ via PS + Lighthouse |
| 3 — Events / compression | Auto-pulled per location | ✅ Phase 4 web_search |
| 4 — Revenue mgmt / pricing | Own BAR, comp set, hurdle, LH forecast | ✅ Phase 5 Lighthouse 365 Day Outlook |
| 5 — Operational | Labor productivity, MPOR, OOO, GSS | ⚠️ Not built — Hotel Effectiveness integration |
| 6 — External economic | TSA, fuel, consumer confidence | ⚠️ Optional, not built |

Forecast Evolution roadmap per `docs/FORECAST_EVOLUTION.md`:

| Priority | Description | Phase | Status |
|---|---|---|---|
| 1 | Pace fundamentals: pickup curves, booking windows, wash | 7 | ✅ pickup curves; booking-window + wash need new data |
| 2 | Pricing/market intelligence depth | 5+6 | ✅ rate shop in active reasoning |
| 3 | Trust & transparency (daily confidence + anomaly + risk) | 6 | ✅ |
| 4 | Adaptivity: feedback loop | 8 | ✅ foundation; matures with 2-3 weeks usage |

---

## Current sidebar structure (end of session 9 — unchanged from session 8)

```
Today                       (DEFAULT landing — visual cockpit)
SHAI                        (AI command bar)

Portfolio                   (Daily Flash / Tile View / Ranked List)
Forecast
Scorecard
👤 My Portfolio
⚖ Brand Compare              (POR-cost-line view per Tim Foley)
🏦 Owner Groups
Statements
📊 Reports

Watchlist [badge]
Decisions [badge]
Actions   [badge]
Alerts    [badge]

STR Intel
Demand AI                   (drag-drop pace ingest + segment forecast + drill-down)
Labor Model
Energy
Recon
HR        [badge]

[Header right]
↗ Open in app…
☎ Contacts
📝 Intake
⚙ Admin
✦ Hub
```

---

## Files added or significantly changed this session

**Strategic docs (new):**
- `docs/SHAI_FORECAST_STACK.md` — 6-layer forecast architecture
- `docs/FORECAST_EVOLUTION.md` — Chris's 11-point critique + 4-priority roadmap

**Code:**
- `server.js` — major: ensureShape additions (`pmsPace`, `events`, `forecasts`),
  pace import/index/detail/delete endpoints, events endpoint,
  pickup-curve endpoint, forecast-calibration endpoint, web_search helper,
  events lookup function, calibration builder, pickup curve builder,
  much-expanded daily forecast prompt (CONDITIONAL REASONING, DAILY
  CONFIDENCE, ANOMALY DETECTION, RISK SCORECARD, STRENGTHENED ADR LOGIC,
  EVENT QUANTIFICATION, PICKUP CURVE REASONING, FORECAST CALIBRATION,
  PRICING INTELLIGENCE), Sonnet 4.6 default + 429 retry wrapper, JSON
  parse robustness.
- `public/dashboard.html` — major: PMS Pace drag-drop zone with multi-parser
  branch (Opera + Lighthouse), pace history list, 3-Month Forward Forecast
  Period column clickable, pace drill-down modal with daily × segment table,
  segment-grain daily forecast renderer (14-column table mirroring drill-
  down), Risk Scorecard 6-tile row, events pill row, Model Calibration
  panel, per-day confidence + anomaly indicators on heatmap cells, richer
  error surface for parse failures.
- `public/team.html` — role-agent compact chip strip below the corporate-
  team card grid.

**Memory updated** at `~/.claude/projects/.../memory/`:
- `project_forecast_stack.md` (new)
- `feedback_drag_drop_uploads.md` (new)
- `project_anthropic_tier_limits.md` (new)
- `project_forecast_evolution.md` (new)
- `project_second_layer_review.md` (new in session, predates)
- `MEMORY.md` updated with new pointers

**Brand assets (untracked, Chris's personal sig):**
- `public/brand/shai-logo-companies-email.{png,jpg,b64.txt}` —
  resized SHAI Companies logo at 320×194 for email signature use
- `C:\Users\Owner\Hatfield\chris-hatfield-signature.html` — signature file

---

## How to start the next session

1. **Read this file.** You're doing it.
2. **Read `docs/SHAI_FORECAST_STACK.md`** for the data architecture.
3. **Read `docs/FORECAST_EVOLUTION.md`** for the forecast quality roadmap +
   Chris's critique.
4. **Read memory files** at `~/.claude/projects/.../memory/MEMORY.md`. The
   `project_anthropic_tier_limits.md` entry is load-bearing for anything
   that involves stacking more context into the AI prompts.
5. **`git log --oneline -15`** to see what landed since the last handoff.
6. **Visit `http://localhost:3000/dashboard.html`** → Demand AI → pick
   Holiday Inn Lex → Generate for any month. Verify Risk Scorecard tiles
   render, events strip shows, calibration panel shows the friendly "no
   pairs yet" stub (until a few forecasts persist + dates pass).
7. **Hit `/api/forecast-calibration/18`** to see whether any calibration
   pairs have accumulated yet.
8. **Hit `/api/pickup-curve/18/2026-06-05`** to see the pickup curve.
   Today this returns 1 point; over weeks it grows.

---

## Critical operational gotchas (do not regress)

1. **Never persist `activePeriod` to config.json.** Caused May-2026
   stale-data regression in earlier sessions. Don't undo.
2. **`dns.setDefaultResultOrder('ipv4first')` + `IPV4_AGENT` at top of
   server.js.** If removed, ETIMEDOUT errors return on Anthropic + PS calls.
3. **Monthly Close + Quarterly Rollup skills use Haiku 4.5.** Per-skill
   model override in REPORTS_CATALOG. Don't move them to Sonnet —
   they push 11K+ input tokens, will trip rate limits.
4. **`_skillRawByItemId` stash MUST happen in `renderMsg` for skill
   responses.** Branded export reads from there.
5. **`LEADER_SCOPES_BY_LAST` is the source of truth for My Portfolio
   scopes.** Don't tag scopes via property contact fields if a leader has
   an explicit override here.
6. **PS denominator render-fix** at `/api/properties` — corrected occ% /
   revpar / roomsAvail for current month. Don't undo.
7. **NEW: Default model is `claude-sonnet-4-6`** (CLAUDE_MODEL); fast
   model is `claude-haiku-4-5-20251001` (CLAUDE_MODEL_FAST). Both subject
   to the 10K input-TPM cap on Chris's current Anthropic tier. Don't
   downgrade Sonnet back to 4.x — older models had lower TPM allowances.
8. **NEW: Daily forecast maxTokens is 12000.** Segment-grain output with
   per-day confidence + anomaly + risk scorecard runs long. Lower than
   12000 risks truncation mid-JSON.
9. **NEW: 429 retry wrapper on `callClaude` + `callClaudeWithWebSearch`.**
   Reads `Retry-After`, waits, retries up to 2x. Don't strip — transient
   rate limits will fail user-facing requests without it.
10. **NEW: File uploads land via drag-and-drop in the Demand AI panel.**
    No buried Admin file pickers. File bytes never persist server-side —
    parse in browser, post normalized JSON. See
    `memory/feedback_drag_drop_uploads.md`.
11. **NEW: Role personas (CEO, COO, CFO, VPs, Regional, AGM) operate as
    second-layer review.** SECOND_LAYER_REVIEW_MANDATE in server.js gets
    concatenated onto their prompt. Don't soften — see
    `memory/project_second_layer_review.md`.

**Restart command:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; Start-ScheduledTask -TaskName SHAI-Hub-AutoStart
```

---

## [Archive] What session 8 shipped (2026-05-11 → 2026-05-12)

A LOT. Roughly 20+ distinct features/fixes plus three sizable deliverables
for the committee meeting. The hub has been restarted multiple times to
pick up server.js changes. Currently serving all session-8 code.

### Bug fixes that unblocked everything else

- **`safeName` ReferenceError in `buildOwnership` was killing buildAll().**
  Stray identifier left behind during the XSS audit (commit `124277b`).
  Caused Owner Groups AND Forecast tabs to render blank because the throw
  propagated up through buildAll(). One-line fix; both panels alive again.
- **Stray `}` in `team.html` script** — orphan from the cards-first redesign
  was killing the entire script block via SyntaxError. Roster stuck on
  "Loading…" until removed. Caught by `node --check` after `awk`-extraction.
- **`ETIMEDOUT` → `ECONNRESET` → rate limit on Anthropic.** Three-layer
  diagnosis. IPv6 black hole resolved via `dns.setDefaultResultOrder('ipv4first')`
  PLUS explicit `https.Agent({family:4})` on the Anthropic call. Saved
  memory at `~/.claude/.../memory/project_ipv4_dns.md`. After the network
  was fixed, the underlying issue revealed itself: 10K input-tokens-per-minute
  Sonnet rate limit on Chris's Anthropic tier. Fixed by routing the heavy
  Monthly Close + Quarterly Rollup skills through Haiku 4.5 via a per-skill
  model override in REPORTS_CATALOG.

### Personas + intake form

- **Ash + Samir removed** from intake form (`/api/personas/list` filter)
  AND from Ask-the-Team card grid (client-side filter in `loadTeamRoster`).
  They remain in manifest.json for team.html KPI cards and AI registry.
- **Chris Hatfield added** as the 15th corporate leader. manifest.json
  entry + contact title updated from "Area GM" to "Area General Manager".
  Headshot saved manually by Chris to `public/brand/team/chris-hatfield.jpg`
  (32KB, 512×341, JPEG q85 — matches the other 14 photos).
- **Ask-the-Team redesigned cards-first.** Sidebar persona list killed.
  Card grid is now the only picker. Filter bar above (Search / Status /
  Department / count badge). Department badges removed from individual
  cards per Chris's request. Click ★ Agent card → in-page chat as that
  agent. Click Intake/Draft card → opens `/persona-intake.html?slug=…`.
  Compact-mode strip when an agent is selected, with "← Show all" exit.

### Performance Scorecard (PSC) alignment to canonical Excel

- Reverse-engineered the March 2026 Excel scorecard for Home2 Lex (Chris's
  upload). Locked the 11-metric / 25-100-200 rubric. Hub now matches the
  sheet cell-for-cell. Three metrics rewired:
  - **Google Score** — binary `≥4.4=5` → 3-tier `≥4.0=0 / ≥4.5=2.5 / ≥4.7=5`
  - **Community Engagement** — binary → 3-tier with `communityEngagementExceed` flag
  - **Forecast Accuracy** — inverted-distance → sheet's "beat by X%" (1.040/1.050/1.055 = 5/20/40)
- Memory: `reference_psc_scoring_rubric.md` captures the canonical rubric.

### Period dropdown sync fix

- Header dropdown was showing wrong month against `S.period` due to:
  (a) hardcoded HTML placeholder options (Apr/Mar/Feb/Jan), (b) `loadAdminConfig`
  overriding `admin-period` with the server's `currentPeriod()` instead of
  the browser's S.period, (c) `.sort()` was inside a try block that could
  fail silently. All three fixed. Single `syncPeriodDropdowns()` helper is
  now the source of truth.

### Reports section (Reports & Skills panel)

- New sidebar entry `📊 Reports` between Statements and Watchlist.
- **18 reports/skills** cataloged in `REPORTS_CATALOG`, grouped by audience
  (Ownership / Executive / Operational). Audience + Cadence filter selects.
- Each card has icon, name, description, audience+cadence tags, and a
  brand-gradient `✦ Generate` button that routes through `runReport(id)` →
  switches AI mode → kicks the skill into chat.
- **Two rollup variants:** Monthly Close Narrative + Quarterly Portfolio
  Rollup. Both invoke `portfolio-quarterly-rollup` skill with different
  scope/status framing. Both pinned to `model:'claude-haiku-4-5-20251001'`
  to fit under Sonnet's rate-limit cap.

### Portfolio Quarterly Rollup SKILL.md — full canonical alignment

The SKILL.md at `superhost-agents/skills/portfolio-quarterly-rollup/SKILL.md`
was fully rewritten to match the canonical Q1 2026 Portfolio Results docx
Chris provided. Major changes:

- **Header banner** — 2-row navy table (was: 4-line center stack)
- **Headline block** — 5 stacked sentences (was: 7-element single paragraph)
- **KPI table** — column headers locked, "IBFC (NOI)" label corrected,
  full-integer dollar formatting in tables, abbreviated in narrative
- **Overhead** — Title-case direction, full line names, explicit sign
  convention comment for expense lines
- **STR + Guest Experience Scores** — TWO 4-cell snapshot sections with
  graceful "STR pending" / "GSS pending" degradation matching the Q1 doc
- **Diagnostic** — TWO modes: Mode A (Share Movement × NOI quadrant) when
  STR is available, Mode B (NOI vs Budget by Property) when STR pending
- **NEW Section: NOI Miss Properties — Variance Detail ($K)** — 11-column
  per-miss-property breakdown with "N patterns" narrative
- **Bottom Line** — single-cell light-gray callout with BOTTOM LINE label
  + bold navy headline + 2-3 sentence body
- **Appendix** — replaced with verbatim Q1 2026 output (every table,
  every number) as the literal structural template

### Branded skill output exports (PDF + Word)

`_skillExportHTML` and the export buttons (↓ PDF / ↓ Word) now produce
canonical-Q1-style output instead of generic styling. New components:

- `_skillRawByItemId` Map stashes raw markdown per skill output
- `_brandedMarkdownToHTML(md)` parses markdown → canonical-branded HTML:
  navy 2-row banner from first H1 + meta line, gold-underlined H2s,
  navy-header KPI tables with bold "Total Overhead" detection, color-tinted
  4-cell snapshot tables (green for Above Fair Share, gold for Below),
  variance auto-coloring (+→teal / −→gold), Bottom Line as single-cell
  light-gray callout
- Both PDF (window.print) and Word (`.doc` blob) inherit the same HTML.
  Fallback to DOM-scrape for any pre-stash messages

### Reports panel data-source shift

- SKILL.md Section 1 rewritten to direct AI to read from the live
  `buildPortfolioSnapshot()` injected on every `/api/ai/chat` call —
  NOT to expect uploaded files. Graceful-degrade language for fields
  the snapshot doesn't yet surface (departmental overhead, Net Income).

### My Portfolio panel — leader-scoped property view

- New sidebar entry `👤 My Portfolio` between Scorecard and Owner Groups.
- "Viewing as:" dropdown populated from `/api/contacts/corporate` (26
  leaders), grouped by department. Defaults to Chris Hatfield.
- **`LEADER_SCOPES_BY_LAST`** constant — explicit territory assignments
  per Chris's spec, keyed by lastname:
  - Chris Hatfield → 7 hotels (Lex/Owensboro/Evansville cluster) — narrow only
  - Justyn Lamas → 3 hotels (TX cluster) — narrow only
  - Mark Gammill → all 17 / South region (11) — dual mode
  - Jennifer Kruk → all 17 / North region (5) — dual mode
  - Nate Taylor → all 17 / 8-hotel sales territory — dual mode
  - Teresa Bitner → all 17 / 9-hotel sales territory — dual mode
  - Everyone else → full portfolio (C-suite/VPs/directors)
- Dual-mode toggle ("Full Portfolio · 17" / "[Territory] · N") on RDO+RSM
- Card design v2 (rebuilt for readability after first pass was cramped):
  score-colored left stripe + circular score badge + **hero NOI** (28pt
  mono with color-tinted variance pill) + 3 secondary KPIs (Revenue/Occ/RevPAR)
  + GM contact line with email/call icons + activity pills + ✦ Open

### Brand Compare panel — same-brand side-by-side

- New sidebar entry `⚖ Brand Compare` between My Portfolio and Owner Groups.
- Brand selector dropdown grouped by brand-family, defaults to Home2 (8 prop).
- **Single wide comparison table** with sticky property column. 13 metric
  columns: Occ · ESS Occ · ADR · RevPAR · Revenue · GOP $ · GOP % · NOI $ ·
  Rooms Profit · F&B/Breakfast · A&G · S&M · R&M · Utilities. Top/bottom
  performer per column highlighted (green/red left stripes). Cost-line
  variance sign-flipped so "best" = lowest spend vs budget intuitively.
- **Diagnosis cards** below — Top Performer (winning department lines)
  and Bottom Performer (driving-the-miss department lines), auto-computed
  from the data (no AI call).
- **Downloadable PDF + Word reports** in canonical Superhost voice format.
  `_buildBrandCompareMarkdown` generates structured markdown following the
  Q1 rollup template (banner → 5-sentence headline → Performance table →
  Profitability table → Cost Detail table → Top/Bottom Performer →
  Bottom Line callout). Routes through `_skillRawByItemId` + existing
  PDF/Word exporters. Deterministic, instant, no AI cost.

### Extended Stay Occupancy — both manual entry AND PS pull

- `manual.essOcc` and `manual.essOccBud` added to Data Entry form fields
  (DE_FIELDS_FINANCIAL, after occ/occBud).
- Server-side PS parser (`/MonthlyExtended`) now tries to resolve ESS Occ
  via candidate `itemTag` matching — primary candidates `ESSOCC`/`EXTSTAY`/
  `EXTOCC`/`EXTRMOCC`/`LOSEXT`/`OCCEXT`/`LOS5OCC`/`OCCESS` (percent),
  fallback `EXTRMS`/`EXTRMSOLD`/`RMLOS5`/`RMLOS7`/`LOSGT5`/`EXTSTAYRM`
  (room-count, divided by aAvail). **Actual PS tag unconfirmed** — Chris
  needs to hit `/api/ps/debug/041` (Home2 Normal) to identify the real
  tag in his environment, then we promote it to the front of the list.
- `essOcc` + `essOccBud` added to `PSC_MANUAL_KEYS` so manual entries are
  preserved when PS doesn't resolve a tag (avoids null overwriting user input).

### AI Committee deliverables (for Monday May 18, 2026)

1. **Inventory doc** at `docs/AI_COMMITTEE_PROJECT_INVENTORY.md` — comprehensive
   project inventory organized by committee-member function (Jill / Rafiq /
   Maura / Chris). 4-domain capability table, decision queue, talking points.
2. **Run sheet** at `C:\Users\Owner\Downloads\SHAI_AI_Committee_2026-05-18_RUN_SHEET.md`
   — minute-by-minute run-of-show with click sequence, fallback playbook,
   after-meeting workflow.
3. **Loom 3-min demo script** at `C:\Users\Owner\Downloads\SHAI_Loom_Demo_Script.md`
   — exact spoken lines + click directions, designed for one-take recording.
   To be recorded Friday afternoon and sent to committee + Samir/Ash before
   the weekend.
4. **PowerPoint deck** at `C:\Users\Owner\Downloads\SHAI_AI_Committee_2026-05-18.pptx`
   — 7 slides built via pptxgenjs, brand-styled (navy/pink/blue/gold,
   Calibri throughout, faked 5-segment pink→blue gradient bar across every
   slide top). Vision statement: *"SHAI gives every Superhost operator
   instant access to the full leadership team's judgment — across all 17
   hotels, every decision."* Two decisions to walk out with: M3 path A
   recommendation + 14-day persona intake commitment.

---

## ⚠ What's worth picking up next session

### 1. AI Analytics tier choice (Chris to decide)

Discussed three tiers, no decision yet:
- **Tier 1** — Daily "Smart Signals" widget on Today landing. Cron at
  6:30 AM, runs 1-2 Anthropic calls, surfaces top 3-5 portfolio
  anomalies with quantified drivers. ~3-4 hrs build, ~$3-5/mo Haiku.
- **Tier 2** — "AI Diagnosis" tab inside property modal. On-click, 3-paragraph
  operator-voice diagnostic, cached 24h. ~5-6 hrs.
- **Tier 3** — Sunday-night cross-portfolio pattern scan. Monday-morning
  brief with 5-7 patterns. ~2-3 hrs.

**Recommend Tier 1 first** — demoes Monday with high impact ("the hub
noticed before I did"). Awaiting Chris's go.

### 2. ESS Occ PS tag confirmation

Server-side parsing scaffolded with candidate tags but the actual tag in
Chris's PS environment is unknown. He needs to:
- Hit `http://localhost:3000/api/ps/debug/041` in a browser (Home2 Normal
  siteTag — extended-stay property guaranteed to have the field)
- Search the returned JSON items for any `description` containing
  "extended", "LOS", "length", "stay"
- Promote that `itemTag` to the front of `ESS_OCC_TAGS_PCT` (server.js
  line ~790)

Until then, Brand Compare shows `—` for ESS Occ unless manually entered.

### 3. Pre-Monday committee prep (Chris's hands)

- **Friday morning:** generate April 2026 Monthly Close (Reports → ✦ Generate),
  export PDF, print 6 copies. This is the most powerful artifact for the room.
- **Friday afternoon:** record the Loom 3-min walkthrough using the script
  at `Downloads/SHAI_Loom_Demo_Script.md`. Send link to committee + Samir/Ash.
- **Friday EOD:** print the deck (PDF), inventory doc, run sheet — 6 copies each.
- **Sunday evening:** practice the demo 3× on the actual presentation machine.
- **Maura's intake** — get her to ~50% before Monday so her card shows visible
  progress when Chris clicks into Ask the Team during the demo.

### 4. ROTATE the leaked Anthropic API key (URGENT)

Real key exposed in this session's transcript. Chris was warned twice.
Steps: console.anthropic.com → API Keys → revoke current → generate new
→ paste into `.env` line 17 → delete lines 9 and 16 (placeholder dups) →
restart hub. Until done, treat current key as compromised.

### 5. Strategic IP / commercialization question (parked, not blocked)

Chris wants to retain rights to SHAI and commercialize in 2027 (license-back
to Superhost + sell to non-competing markets). No employment agreement on
file — only an offer letter, no IP-assignment clause. Recommended path:
- Read offer letter tonight (verify no IP clause)
- 1-hour IP/employment lawyer consult (~$500) before Monday's committee
- Conversation with Samir/Ash BEFORE the committee meeting, framed as
  partnership question
- Five paths in order of recommendation: (1) license-back, (2) spin-out
  with Superhost equity, (3) outright sale + CIO title, (4) quit and
  build full-time, (5) ambush (NOT recommended)

This is NOT a technical task. Just flagging so future sessions don't
re-explain. Memory has the AI Committee context at `project_ai_committee.md`.

### 6. Tier 2 docx-js for true canonical Q1 output (V2)

Current branded export is HTML-to-Word-as-`.doc`. Renders well in modern
Word but isn't pixel-perfect. Tier 2 would generate actual `.docx` via
docx-js on the server with explicit table cell shading, etc. ~2-3 hrs.
Worth doing for rollup output specifically since it goes to owners.
Other skills (Monday Digest, Watchlist) can stay on HTML path.

---

## Current sidebar structure (end of session 8)

```
Today                       (DEFAULT landing — visual cockpit)
SHAI                        (AI command bar)

Portfolio                   (Daily Flash / Tile View / Ranked List)
Forecast
Scorecard
👤 My Portfolio              (NEW — leader-scoped property view)
⚖ Brand Compare              (NEW — same-brand side-by-side)
🏦 Owner Groups
Statements
📊 Reports                   (NEW — monthly skills + reports)

Watchlist [badge]
Decisions [badge]
Actions   [badge]
Alerts    [badge]

STR Intel
Demand AI
Labor Model
Energy
Recon
HR        [badge]

[Header right]
↗ Open in app…
☎ Contacts
📝 Intake
⚙ Admin
✦ Hub
```

---

## Files added or significantly changed this session

**Code:**
- `public/dashboard.html` — sidebar nav, panels (My Portfolio, Brand Compare,
  Reports), CSS for new card designs, REPORTS_CATALOG, LEADER_SCOPES_BY_LAST,
  BC_METRICS, `_brandedMarkdownToHTML`, `_skillRawByItemId`, `_renderMPCard`,
  `_renderBCDiagnosis`, `_buildBrandCompareMarkdown`, `syncPeriodDropdowns`,
  `pscScoreAbs`, rewrites of `pscFcAccuracy` and `_skillExportHTML`. Removed
  `safeName` orphan in `buildOwnership`. Sidebar persona list removed from
  team.html. Fixed `}` orphan there too.
- `server.js` — `dns.setDefaultResultOrder('ipv4first')` + `IPV4_AGENT`,
  `model` param accepted on `/api/ai/chat`, ESS Occ PS parsing + result
  mapping, ESS keys in PSC_MANUAL_KEYS, model override in `callClaude`,
  intake exclusion list for Ash/Samir.
- `superhost-agents/skills/portfolio-quarterly-rollup/SKILL.md` — full
  rewrite to match canonical Q1 doc.

**Docs and artifacts:**
- `docs/AI_COMMITTEE_PROJECT_INVENTORY.md` (new)
- `C:\Users\Owner\Downloads\SHAI_AI_Committee_2026-05-18.pptx` (new)
- `C:\Users\Owner\Downloads\SHAI_AI_Committee_2026-05-18_RUN_SHEET.md` (new)
- `C:\Users\Owner\Downloads\SHAI_Loom_Demo_Script.md` (new)
- `public/brand/team/manifest.json` (Chris added as 15th leader)
- `public/brand/team/chris-hatfield.jpg` (32KB headshot, user-placed)

**Memory updated** at `~/.claude/projects/.../memory/`:
- `reference_psc_scoring_rubric.md` (new — canonical 11-metric rubric)
- `project_ai_committee.md` (new — committee context, 4 members, decision queue)
- `project_ipv4_dns.md` (new — IPv4-first DNS config, IPv6 black hole diagnostic)
- `MEMORY.md` updated with three new pointers

---

## How to start the next session

1. **Read this file.** You're doing it.
2. **Read `docs/AI_COMMITTEE_PROJECT_INVENTORY.md`** for the committee context
   and project-wide capability map.
3. **Read memory files** at `~/.claude/projects/.../memory/MEMORY.md` and
   follow the pointers — especially `project_ai_committee.md` and
   `project_ipv4_dns.md`.
4. **Check the committee meeting date.** Today vs May 18, 2026. If pre-meeting,
   focus is on prep (Loom recording, deck print, April Monthly Close generation).
   If post-meeting, focus shifts to the decisions made (M3 path, intake
   commitments).
5. **`git log --oneline -15`** to see what landed since the last handoff.
6. **Visit `http://localhost:3000/dashboard.html`** — verify sidebar shows
   My Portfolio + Brand Compare + Reports as new entries.
7. If Chris asks for AI Analytics build, see "Tier 1 / 2 / 3" in
   "What's worth picking up next session" above.

---

## Critical operational gotchas (do not regress)

1. **Never persist `activePeriod` to config.json.** Caused May-2026 stale-data
   regression in earlier sessions. `loadConfig()` returns `currentPeriod()`
   dynamically. Don't undo.
2. **`dns.setDefaultResultOrder('ipv4first')` + `IPV4_AGENT` at top of server.js.**
   If removed, ETIMEDOUT / socket-hang-up errors return on Anthropic + PS calls.
3. **Monthly Close + Quarterly Rollup skills must use Haiku 4.5.** Sonnet 4
   rate-limits at 10K input TPM on the current tier; these skills push 11K+
   tokens of prompt. Override in REPORTS_CATALOG.
4. **`_skillRawByItemId` stash MUST happen in `renderMsg` for skill responses.**
   Branded export reads from there; without it, exports fall back to chat-DOM
   scrape which doesn't get the canonical brand styling.
5. **`LEADER_SCOPES_BY_LAST` is the source of truth for My Portfolio
   scopes.** Single edit, no schema change. Don't tag scopes via property
   contact fields if a leader has an explicit override here.
6. **PS denominator render-fix** at `/api/properties` — corrected occ% /
   revpar / roomsAvail for current month. Don't undo.

**Restart command:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; Start-ScheduledTask -TaskName SHAI-Hub-AutoStart
```

---

## [Archive] What session 7 shipped (2026-05-10)

Two commits, both clean. Hub restarted twice, currently serving the new
code; `/api/personas/intake-schema` returns 200 (persona endpoints live).

### `d3f65e8` — fix(flow): tighten denominator guard + cap display at ±200% + early-month MTD banner

- **server.js + dashboard.html `calcFlow`** — denominator guard tightened
  from `|revVar| < $1` to `|revVar| < max($500, 0.5% × revBud)`. Audit
  re-run after the change: **22 rows newly null'd** by the guard. Note
  that the session-6 estimate of "80 of 110 killed" was optimistic —
  most flagged rows have revVar > 1% of plan, so they're real Flex/Flow
  math (small revenue variance × meaningful GOP variance = legitimately
  large ratio), not divisor-zero artifacts. **Fix 2's display cap is what
  actually protects readers for those 92 remaining cases.**
- **`flowFmt(f)` helper in dashboard.html** — caps display at ±200% (text
  becomes `>+200%` or `<−200%`) with raw value preserved in tooltip.
  Applied at: `fBadge`, brand-bench table formatter, flow tracker list,
  P&L `flowRow`, alert-generator titles, owner-letter mailto body.
- **`earlyMonthBannerHTML()` + anchors** — day 1-7 amber banner explaining
  the MTD GOP / Flow-Through artifact (variable expenses post daily,
  fixed expenses post end-of-month). Wired into Today (above Pulse
  ribbon), Tile View (above kpi-row), Daily Flash (prepended to existing
  `#df-note` bits). Active period only — closed prior months are no-op.
- **`tools-audit-flowthrough.py`** — committed (was untracked in session 6)
  and its `calc_flow` mirror updated to match production guard.

### `fd3fdd9` — feat(today): /api/portfolio-trend endpoint + real-data hero sparkline

- **`GET /api/portfolio-trend?period=YYYY-MM&months=N`** — single
  aggregated time-series endpoint. Replaces Today's 24 parallel
  `/api/properties` calls (12 current + 12 LY) with one read of
  `data.byPeriod` + an in-memory aggregation pass. Pro-rate behavior
  mirrors `/api/properties` (active month only, budget dollars × proRate,
  roomsAvail × proRate so RevPAR scope matches).
- **60s TTL in-process cache** keyed by `${period}:${months}`.
  **Cold ~2-4s** (the loadData() 90 MB JSON parse, NOT the aggregation
  itself which is ~10ms); **warm ~80ms**. `clearTrendCache()` is invoked
  from `refreshAllProperties` so PS refreshes invalidate immediately —
  no waiting for the TTL to expire.
- **Client `buildPortfolioTrend`** rewired to prefer the new endpoint
  with a graceful fall-back to the legacy 24-call path on 404/error
  (hub mid-deploy / rollback safety).
- **`refreshHeroSparkline()`** reads NOI history from `__trendCache` and
  re-renders the hero sparkline. `buildSparkline` now accepts an optional
  `realSeries[]` arg; synthesized placeholder kept for first-paint only,
  swapped for real data once the trend cache is warm.

---

## ⚠ What's worth picking up next session

Nothing is blocked or awaiting Chris's input from session 7. The items
below are observations / future-work, not blockers.

### 1. Cold-load of the trend endpoint is dominated by JSON parse, not aggregation

`data.json` is now 90+ MB and every `loadData()` call re-reads + re-parses
it (~2-3s on Windows). The 60s cache on `/api/portfolio-trend` hides this
for repeat hits, but the first user of the day pays the full parse cost.

Two reasonable options if Today becomes the most-trafficked landing:
- **Memoize `loadData()` itself** — short TTL (~5s), invalidated on every
  `saveData()`. Closes the same window for ALL endpoints, not just trend.
  Slightly risky if a handler depends on observing other handlers' writes
  mid-request, but the existing `withDataLock` debt (still P1 deferred)
  would be the cleaner fix.
- **Streaming JSON parse** — replace `JSON.parse(fs.readFileSync)` with a
  streamed parser. More work, no semantic risk.

Recommend ignoring unless someone surfaces complaints about Today taking
"forever to load first thing in the morning."

### 2. Real NOI sparkline shows wild swings

After wiring real history (Dec 2025: −$2.1M; Apr 2026: +$4.1M), the
sparkline has more drama than the synthesized version did. These are real
data quirks — year-end fixed-cost adjustments, partial-portfolio months
when properties were being added — not a bug. If the sparkline becomes a
visual irritant, options are: (a) clip outliers ±2σ, (b) smooth with a
3-month rolling avg, (c) switch the sparkline source to portfolio
revenue or RevPAR, which is less spiky.

### 3. Flow-Through "Fix 3" still on the shelf

Renaming the metric to "Flex-Flow Score" and adding the standard
`gopVar / revVar` formula as a sister metric in the UI. Session 6 noted
this needs a Maura/Tim conversation before it lands on owner letters.
Not actioned in session 7. Still parked.

---

## [Archive] Session 6 recap (2026-05-08 → 2026-05-10)

This was the longest single session in the project's life. Twenty-eight
commits across six big themes. The graveyard before it: `e607c33` (the
prior handoff calling out the working-tree drift to triage).

### Theme 1 — Triaged + committed the working-tree drift (5 commits)

Five logically-separated commits from one working-tree mess:

- **`e3b5faf`** — `fix(snapshot): correct PS denominator + MTD pro-rate; council
  lite-mode + serial`. The big one. PS delivers MTD numerator with full-month
  denominator; occ% and revpar$ on the current month were understated by
  proRateFactor. A hotel running 78% MTD occ rendered as 12.7% on May 6
  and got scored 0/200. Fix is render-time: divides by proRateFactor at
  /api/properties + buildPortfolioSnapshot, stashes raw PS values for
  traceability, ensures `calcScore` and `calcFlow` use the corrected manual.
  Also adds `opts.lite` to buildPortfolioSnapshot (drops historical sections
  + caps cockpit blocks at top 5; ~5K tokens vs ~13K) so /api/council can
  fan out across 7 personas without blowing the org-level Sonnet budget.
  Council also went from `Promise.all` parallel to sequential with a 4s
  pause between persona calls.
- **`0d76560`** — `feat(ai): suggestedHandoff metadata + sibling-skill chain UI`.
  Skills can emit a fenced ` ```handoff ` block recommending a sibling
  skill. Server strips it from visible prose, surfaces as `suggestedHandoff`
  in `/api/ai/chat` response. Client renders a one-click chain bar.
- **`ad2c7d5`** — `feat(weekly-str): manual STR commentary entry`. Per-property
  per-week-ending entries. Schema in `ensureShape`, 5 endpoints, ~217-line
  UI block in dashboard.html `buildSTRIntel` (new "Weekly Commentary" mode
  in str-view-mode dropdown).
- **`b457cbf`** — `refactor(personas): drop 7 property-level personas; add 4
  corporate skills`. Dropped GM / AGM / DOSM / DRM / Chief Engineer /
  Controller / Exec Chef. Surviving 17 personas: all C-suite + Corporate VPs
  + Regional VP + Area GM. Added skills: chief-of-staff-monday-digest,
  general-counsel-brand-letter-triage, area-gm-property-pulse, psc-review
  (full kit with scripts/ + reference/).
- **`2b3eb87`** — `fix(brand): correct logo paths across splash, PIN, command bar`.
  Three lingering brand asset references pointing at legacy paths.

### Theme 2 — 60-second leadership teaser (4 commits)

- **`1fa41a7`** — Initial 60-second 6-scene reel at `/teaser.html` + companion
  playbook at `docs/TEASER_PLAYBOOK.md`.
- **`69177f1`** — Expanded to 12 scenes at fixed 8-second cadence; fixed
  logo references; runtime now 1:36.
- **`16cadfe`** — Splash bookends (cold open + closer use `/splash.html?clip`
  iframed full-bleed). Added `?clip` mode to splash that suppresses
  auto-redirect + chrome. "Run by ownership" → "Powered by SHAI" tagline.
  Standalone voiceover script doc at `docs/TEASER_VOICEOVER_SCRIPT.md`.
- **`54087fa`** — Synced teaser to the ElevenLabs Sawyer voiceover
  (`public/teaser-vo.mp3`, 1:53). Replaced fixed 8s cadence with explicit
  `SCENE_STARTS` array driven off `audio.currentTime`. Autoplay-blocked
  fallback + wall-clock fallback if audio fails. Total runtime now 1:53.

### Theme 3 — 3-stage opening sequence on the platform itself (1 commit)

- **`74e07cd`** — `feat(splash): three-stage opening sequence — splash → dashboard
  → team`. Visiting `/` now walks through brand reveal (4s) → dashboard
  preview with KPI tiles (4s) → executive team preview with persona avatars
  (4s) → redirect to /dashboard.html. Total 12s. Esc/Enter still abort/skip.
  `?clip` mode unchanged (teaser bookends still hold on stage 1 only).

### Theme 4 — Hotel contact roster + bench sync (2 commits)

- **`fb5f524`** — `feat(contacts): hotel contact roster import — xlsx + endpoints
  + UI + AI`. Re-runnable importer at `tools-import-contacts.py` reads
  `Hotel Contact List (Live).xlsx`, joins per-property leadership +
  corporate support + ownership, writes to `data.contacts`. Strict-subset
  fuzzy-match for hotel names (catches "Home2 Evansville" → "Home2 Suites
  Evansville"; rejects "Hampton Inn Denison TX" → "Hampton Inn Suites
  Schaumburg"). Server endpoints: `/api/contacts/*`. Browseable page at
  `/contacts.html`. AI snapshot extended with per-property GM + Owner +
  RDO + RSM (lite mode), plus AGM + DOS + Controller + Revenue + AP email
  + corporate roster (full mode). Sample: 19/19 hub properties matched,
  17 sheet rows correctly unmapped (other-portfolio / placeholders),
  19/19 ownership joins, 26 corporate contacts parsed.
- **`fa629ec`** — `feat(bench): sync data.gmBench from data.contacts during
  contacts import`. Bench's `gmName`, `gmEmail`, and `successor.name`/role
  (from AGM) auto-populate from contacts on every importer run. Subjective
  fields (performance, potential, riskLevel, tenure, notes, tags,
  successor.readiness) preserved. Self-succession guard: skips if AGM ==
  GM in the sheet (caught Lexington Hamburg).

### Theme 5 — Corporate team KPI cards + persona intake forms (3 commits)

- **`209f796`** — `feat(team): KPI cards for the 14 corporate leaders on Ask
  the Team`. Pulled photos + names + titles from
  `superhosthospitality.com/leadership` via `tools-fetch-leadership.py`.
  Photos downloaded to `public/brand/team/<slug>.<ext>`. Manifest at
  `public/brand/team/manifest.json`. `/team.html` Ask-the-Team view shows
  a 14-card grid (84px circular photo + name + title + email/call buttons
  resolved through the corporate roster).
- **`947c165`** — `feat(personas): intake form + AI-callable personas for the
  14 corporate leaders`. The big one. Canonical 10-section schema at
  `superhost-agents/personas/intake-schema.json` (~60 fields covering
  Identity / Authority / How-they-read-data / Ownership-facing / Voice /
  Decisions / Priorities / Voice-training-samples / Constraints / Personal).
  Dynamic form at `/persona-intake.html` (auto-save on blur, pre-fills
  name+title from contacts, Preview AI Prompt modal, print stylesheet).
  Five `/api/personas/*` endpoints. `buildPersonaPrompt(persona)` in
  server.js converts intake JSON → coherent narrative system prompt.
  `getPersonaPrompt('custom:<slug>')` resolves to the generated prompt so
  custom personas work in chat / council / scan with zero other changes.
  Sidebar adds a "Corporate Team" group rendered with photos + completion %.
  **Hub restart required to activate the new endpoints — see Open Item #2 above.**
- **`f2f1a69`** — `feat(personas): downloadable PDF intake form for emailing
  to the team`. `tools-generate-intake-pdf.py` (reportlab) generates 15
  PDFs (~16 pages, ~29KB each) into `public/downloads/`: one blank +
  14 pre-filled with each leader's name and title. Hub serves them as
  static; download button on `/persona-intake.html` picks the right
  per-leader PDF.

### Theme 6 — Cmd-bar redesign (4 commits, all CSS/HTML)

Iterative tuning of the SHAI command bar in the AI cockpit:
- **`ac7efac`** — replace static SHAI banner with animated splash iframe
  (`/splash.html?clip`); search bar to translucent dark glass with white text.
- **`0b24669`** — center search bar (was offset for old banner crop);
  lower opacity (0.32 → 0.18); remove "Powered By Superhost Hospitality"
  bottom-right lockup entirely.
- **`fa57576`** — drop search bar from 50% to 72% so it sits below the
  SHAI tagline.
- **`3538dc6`** — make search bar fully transparent (background:transparent)
  with backdrop-blur 14px; aurora flows straight through.

### Theme 7 — Brand color elevation (1 commit, big)

- **`05bc69a`** — `design(brand): elevate pink+blue presence across the cockpit,
  miles ahead`. Added `--brand-gradient`, `--brand-gradient-135`,
  `--brand-glow-pink`, `--brand-glow-blue`, `--brand-glow-mix`,
  `--brand-glow-strong`, `--brand-ring`, `--brand-rule` tokens to
  `shai-theme.css`. Drop-in utility classes:
  `.shai-brand-gradient`, `.shai-brand-gradient-text`, `.shai-brand-eyebrow`,
  `.shai-brand-rule`, `.shai-brand-glow`, `.shai-brand-shimmer`. Cockpit
  override file applies them automatically: header bottom edge gradient
  hairline; primary `.hdr-btn` gradient pill + glow on hover; sidebar
  `.persona.active` gradient left rail; `.kpi-card` hover brand glow;
  inputs/buttons focus pink+blue ring; `.sb-label` + eyebrows gradient
  text; loading bars pink↔blue↔pink shimmer; `::selection` pink highlight.
  `docs/SHAI_DESIGN_SYSTEM.md` updated — pink+blue rule expanded; brand
  layer vs data layer separation explicit.

### Theme 8 — Executive sidebar restructure + Today landing (2 commits)

After running an executive critique on the dashboard:

- **`4f90ff3`** — `feat(dashboard): executive sidebar restructure — Today
  landing + Cockpit promotion`. Sidebar dropped from 22 items in 6 groups
  to 14 items in 4 groups. New "Today" landing as default home (replaces
  SHAI as the home view; SHAI is now one click below). New "Cockpit"
  group promotes Watchlist + Decisions + Actions from team.html into the
  dashboard sidebar. Header gets ⚙ Admin gear + ↗ Open in app… dropdown
  (was sidebar System + External Apps). Dropped from sidebar: AI Skills
  (in SHAI cmd-bar), GM Digest (in SHAI Skills), Data Entry (under Admin),
  Job Postings (folded under HR), Dashboard + Leaderboard (consolidated
  under Portfolio next commit). Sidebar badges on Watchlist/Decisions/
  Actions/Alerts. Read-only Watchlist/Decisions/Actions panels with deep
  link to team.html for full edit.
- **`8ea6ce6`** — `feat(dashboard): consolidate Dashboard + Daily Flash +
  Leaderboard into Portfolio`. Single "Portfolio" sidebar entry with a
  tab strip at the top of all three panels (Daily Flash / Tile View /
  Ranked List). Brand-gradient eyebrow + underline on active tab.

### Theme 9 — Today visual redesign (4 commits)

- **`b05e08f`** — `design(today): visual-first redesign — Pulse ribbon + Hero
  NOI + Health heatmap + Pulse stream`. Original visual-first pass with
  6 sections: hero band + Pulse ribbon (6 mini KPIs) + Hero NOI with
  sparkline + Property Health heatmap + Three Things to Know + drill cards
  + Portfolio Pulse activity stream.
- **`ab9cb3d`** — `fix(today): heatmap tiles show 5-letter brand PMS codes
  (CHIPW, CHINA, LEXHG)`. Threaded contacts.property[id].code into the
  heatmap renderer via /api/contacts/all-properties fetch. Tile typography
  tightened with letter-spacing + responsive font sizes.
- **`38cbc3c`** — `feat(today): heatmap click opens property drill modal —
  single-property focus`. Modal shows ONLY that property: 5-letter code +
  big score + 6-tile KPI ribbon + Forecast Posture + Key Contacts (GM/AGM/
  DOS/Owner/RDO/RSM with mailto/tel links resolved through corporate
  roster) + Watchlist filtered to this property + Open Actions/Decisions
  filtered + quick-action buttons (Ask SHAI, Generate owner letter, Open
  in Scorecard, Open in Forecast). Esc/X/outside-click to close.
- **`6855d2a`** — `design(today): cull text dumps, add interactive Chart.js
  charts`. Per Chris's feedback "more visuals would set the tone". Removed
  Three Things, On Watch, Due This Week, Pulse Stream. Kept Forecast Drift
  (moved beside scatter). Added: **Portfolio Trend** (full-width line chart,
  metric toggle NOI/Revenue/RevPAR/GOP%, three series Actual/Budget/LY,
  hover tooltip; cached after first load); **Property Scatter** (bubble
  chart at RGI × Score, sized by NOI, colored by brand family, click drills
  into property modal). Chart.js 4.4.1 from jsdelivr CDN (~80KB gzipped).

---

## Current sidebar structure (post-restructure)

```
Today                       (DEFAULT landing — visual cockpit)
SHAI                        (AI command bar, was the default)

Portfolio                   (consolidated — was Dashboard + Daily Flash + Leaderboard)
Forecast
Scorecard                   (was "PSC")
Owner Groups
Statements

Watchlist [badge]           (PROMOTED from team.html)
Decisions [badge]           (PROMOTED)
Actions   [badge]           (PROMOTED)
Alerts    [badge]

STR Intel
Demand AI
Labor Model
Energy
Recon
HR        [badge]           (collapsed Job Postings under HR)

[Header right side]
↗ Open in app… (dropdown — 22 external apps)
☎ Contacts
📝 Intake
⚙ Admin gear
✦ Hub
```

---

## Open decisions / pending user inputs (carried forward from prior sessions)

- **Flow-through fix** — see Open Item #1 above. Awaiting "go on 1, 2, 4."
- **PSC scoring details** still needing user confirmation:
  - Last Year Total Revenue point values
  - Google Score 3-tier thresholds
  - Community Engagement 3-tier states
  - Retention bands confirmation
- **M3 integration** — user only has Citrix-delivered Accounting Core
  (no API). Three paths recommended (CSV exports / M3 Cloud upgrade /
  manual entry). Awaiting user decision on Path A.
- **STR / Hotel Effectiveness API requests** — emails drafted in
  `docs/INTEGRATION_REQUESTS.md`, awaiting user to send. STR is now
  redundant since PS gives us the data; only HE remains.
- **Job Postings — weekly Google Drive sync** — three paths discussed
  (published Sheet CSV / Drive Desktop sync / manual upload), tabled.

---

## Earlier deferred audit items (carried forward)

These were genuinely deferred from session 4 — they need focused work,
not session-end afterthoughts. Status as of end of session 6: still
deferred.

**P1 — `load → mutate → save` race (~3h)** — build a `withDataLock(async
(data) => mutator)` helper that wraps loadData + mutate + saveData in a
Promise-chain queue. Migrate the ~40 endpoints currently using the bare
`loadData() / saveData()` pattern. Closes the only remaining P1 from the
audit.

**P2 — `data.dailyPtd` 60-day pruning (~30 min)** — in
`refreshAllProperties` after the dailyPtd snapshot write, age out entries
older than 60 days for that property+period. Bounds growth at ~1000
entries per property per year.

**P2 — `loadMultiPeriodData` parallelization (~30 min)** — convert
sequential `for(const per of periods){ await }` to `Promise.all`. 5-10×
speedup on YTD/QTD views. Carefully handle the silent-drop bug intertwined
— log when a period fetch fails so wrong totals are visible to the user.

---

## Critical operational gotchas (don't regress these)

All also documented in `docs/HUB_OPERATIONS.md`. Worth a quick re-read.

1. **Never persist `activePeriod` to config.json.** Caused the May 2026
   stale-data regression. `loadConfig()` now dynamically returns
   `currentPeriod()`. Don't undo this.
2. **Auto-refresh uses `currentPeriod()` directly.** Don't change to read
   from config.
3. **STR data has 2-3 week publication lag** — current month's STR data
   won't appear in PS until mid-following month.
4. **WMI-spawned node for auto-start** — wrapper at `tools-start-hub.ps1`.
   Don't switch to `npm start` or `Start-Process`; both get reaped by
   Windows job objects.
5. **PS denominator render-fix** (Theme 1 above) — corrected occ% / revpar
   / roomsAvail at /api/properties + buildPortfolioSnapshot. Don't undo
   this; raw PS values stashed as `occRaw`/`revparRaw`/`roomsAvailFullMonth`
   for traceability.

**Restart command:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; Start-ScheduledTask -TaskName SHAI-Hub-AutoStart
```

---

## Files added this session (asset locations)

- **Voiceover:** `public/teaser-vo.mp3` (1.85MB, 1:53)
- **Brand team photos:** `public/brand/team/<slug>.<jpg|png>` (15 files, ~370KB)
- **Brand team manifest:** `public/brand/team/manifest.json`
- **Persona intake schema:** `superhost-agents/personas/intake-schema.json`
- **Persona intake PDFs:** `public/downloads/SHAI-Persona-Intake-*.pdf`
  (15 files: 1 blank + 14 pre-filled per leader, ~29KB each)
- **Reusable importers:**
  - `tools-import-contacts.py` (xlsx → data.contacts + data.gmBench)
  - `tools-fetch-leadership.py` (web scrape → photos + manifest)
  - `tools-generate-intake-pdf.py` (schema → PDF forms)
  - `tools-audit-flowthrough.py` (data.json → flow audit report)
  - `tools-inspect-contacts.py` (xlsx schema dumper)

---

## How to start the next session

1. Read this file (you're doing it).
2. Read `docs/HUB_OPERATIONS.md` — restart procedures, gotchas.
3. Read `docs/SHAI_DESIGN_SYSTEM.md` — visual contract, brand rules.
4. `git log --oneline -10` — scan the last 10 commits before assuming
   anything needs to be built.
5. Open `http://localhost:3000/` (lands on splash → 12s opening sequence
   → dashboard → Today landing).
6. Quick visual smoke check on Today:
   - Hero NOI sparkline should show **real** historical points now
     (real NOI history endpoint live as of `fd3fdd9`).
   - Day 1-7 of any month? Early-month banner should render in amber
     above the Pulse ribbon. Otherwise no-op.
   - Trend chart loads with one fetch (~80ms warm, ~2-4s cold).
7. If the user mentions Flow-Through reading weird at any property,
   the audit script `tools-audit-flowthrough.py` is the canonical
   diagnostic — run it before reaching for a code fix.

**Don't redo work.** Session 7 closed all three carry-over items from
session 6. The "what's worth picking up next session" list above is
observations, not blockers. Read this doc + scan recent git log before
assuming something needs to be built.
