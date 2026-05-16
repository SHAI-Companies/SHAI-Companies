# SHAI Hub — Walkthrough

A complete tour of the Superhost Hospitality AI Hub for new users. Read it, follow along on the live hub at `http://localhost:3000/dashboard.html`, and you'll be able to operate it after one pass.

This doc doubles as a script — if you record a Loom walkthrough, read each section aloud while showing the corresponding screen.

---

## What the hub is

A single internal application that consolidates every property's performance data into one operating cockpit. Built on top of:
- **ProfitSword** (financials, actuals, budget, forecast, STR comp set)
- **Manual inputs** (Brand Score, Google, AOS, QA, etc. — anything PS doesn't feed)
- **Imported targets** (RevPAR Index annual budgets from your strategic plan)

It runs locally on your machine, auto-starts on logon, and refreshes from PS every 4 hours starting at 06:30. Every panel below is driven by that data — no fabrication, no smoothing.

The hub has six main tabs in the left rail: **Overview**, **Leaderboard**, **Owner Groups**, **Forecast**, **PSC** (Performance Score Card), and supporting views — Data Entry, Admin, AI, etc. Walk them top to bottom.

---

## 1. Header & Period Selector

> 📷 *Screenshot placeholder: full-width header showing logo, period dropdown, refresh button, sync indicator*

The top bar is global — it controls what every panel below shows.

- **Period selector** (top right) — picks the active month (Apr 2026, Mar 2026, etc.). Every panel re-renders for that period.
- **Refresh button (⟳)** — manual refresh from the local data store. Fast, doesn't hit ProfitSword.
- **"◷ syncing" indicator** — appears when the hub is pulling fresh data from ProfitSword in the background. When you switch periods, the hub does this automatically: shows the cached data instantly, then quietly fetches fresh data and re-renders. You don't have to click anything.
- **Live time** — current local time, useful to verify the auto-refresh schedule.

**How to use it:** just pick a period. The hub does the rest. If you switch fast (Apr → Mar → Feb), the last selected wins — older background syncs are abandoned.

---

## 2. Overview Tab — The Daily Cockpit

> 📷 *Screenshot placeholder: full Overview tab from top to bottom*

This is the first screen you'll see. It's designed to answer one question: **"As of right now, how is the portfolio doing?"**

### 2a. Four KPI Tiles (top row)

> 📷 *Screenshot placeholder: the four-card KPI row*

**Total Revenue · Occupancy · ADR · RevPAR**

Each tile shows:
- The headline value (the actual MTD result)
- Three variance lines stacked underneath:
  - **vs Bud** — how MTD actuals compare to the pro-rated budget for the month
  - **vs Fc** — how MTD actuals compare to the live forecast
  - **vs LY** — how MTD actuals compare to same-time-last-year

Color coding: green = ahead, red = behind, gray = no data.

**Why this matters:** these four metrics are the standard hospitality command-deck. If your eye scans all four and they're green, the portfolio is healthy. If two go red, that's where you start drilling.

### 2b. NOI Performance — Year to Date (left chart)

> 📷 *Screenshot placeholder: the NOI YTD bar chart*

Per-property bar chart showing YTD NOI variance vs YTD NOI budget. Properties sort top-to-bottom by % variance — best performers at the top, worst at the bottom.

- The dashed marker behind each bar shows the YTD budget level
- The colored fill shows YTD actual NOI
- The right-side `+X.X%` tag is the % variance
  - Green ≥ 0%
  - Amber 0% to -10%
  - Red < -10%

**Why this matters:** NOI is what owners care about. This chart instantly tells you which properties are creating value vs which are bleeding.

### 2c. Top & Bottom 5 — Revenue vs Budget (right block)

> 📷 *Screenshot placeholder: the Top 5 / Bottom 5 cards*

Properties ranked by current-period total revenue variance vs budget. Top 5 = beating budget by the most %. Bottom 5 = missing budget by the most %.

Each row shows: property name, actual revenue $, variance % (color-coded), variance $.

**Why this matters:** who's worth a "great job" call this morning, and who needs a coaching call. Two clicks of context.

### 2d. QTD / YTD Performance (mid-page)

> 📷 *Screenshot placeholder: the QTD and YTD cards*

Two side-by-side cards showing:
- **QTD card** — Revenue, GOP, NOI, Occ%, RevPAR, Flow% for the selected quarter (Q1/Q2/Q3/Q4 dropdown)
- **YTD card** — same metrics across YTD

Each line shows actual + variance % vs budget.

**Why this matters:** owner reporting language. When an owner asks "how are we tracking YTD," this is the answer.

### 2e. Pace & Forward Look

> 📷 *Screenshot placeholder: pace cards row*

Cards showing transient pace, group pace, total revenue pace, EBITDA, AR balance, FTE — driven by ProfitSword pace tags when available.

**Why this matters:** forward visibility. Pace tells you whether the next 30-60 days are softening before the actuals arrive.

### 2f. Departmental P&L (collapsible)

> 📷 *Screenshot placeholder: dept section expanded*

Click the section header to expand. Shows aggregated departmental performance across the portfolio: Rooms, F&B, A&G, S&M, Maintenance, Utilities, Fixed Charges, Other Income.

**Why this matters:** when GOP is missing budget, this tells you which department is the problem.

---

## 3. Leaderboard Tab

> 📷 *Screenshot placeholder: leaderboard table*

A sortable, filterable table of all 17 properties with these columns: rank, property, actual revenue, budget, variance $, occ%, ADR, RevPAR, vs Bud %, LY revenue, YoY $, score.

- Sort dropdown lets you rank by any metric
- Filter dropdown lets you slice by RDO, owner group, brand
- Click a property name → opens the property modal with full details

**Why this matters:** the spreadsheet view of the portfolio. If you want to see "who's #1, who's #17" in one place, this is it.

---

## 4. Owner Groups Tab

> 📷 *Screenshot placeholder: owner cards 3x2 grid + filtered properties below*

**Top:** 6 owner group cards in a 3-by-3 grid. Each card shows: owner name, contact, # active properties, portfolio NOI, NOI vs budget %, average RevPAR. Plus a "Prep owner call" button per card.

**Below the cards:** initially shows a "Select an owner group above to see their properties" placeholder.

**The interaction:** click any owner card → that card glows gold, the placeholder is replaced with a filtered table of just that owner's properties (sorted alphabetically). Click the same card again, or hit the "✕ Clear" button, to reset.

**Why this matters:** owner-by-owner conversation prep. When you're heading into a call with Gulfstream, click their card, see only their hotels, focus the conversation.

---

## 5. Forecast Tab

> 📷 *Screenshot placeholder: forecast tab top to bottom*

The forward-looking view — where are we landing this month, and where are we going.

### 5a. Current Month — Forecast vs Budget (3 × 2 grid)

> 📷 *Screenshot placeholder: 6-card forecast grid*

Six cards showing the live forecast for the current month against full-month budget:
- Forecast Total Revenue · Forecast GOP · Forecast NOI
- Forecast Occupancy · Forecast ADR · Forecast RevPAR

Each card shows: forecast value, budget value, % variance vs budget, color-coded.

**Why this matters:** "we'll land here this month" — the answer for owner forecasts and lender covenants.

### 5b. Forward Outlook — Next 30 / 60 / 90 Days

> 📷 *Screenshot placeholder: 3-card forward outlook*

Three cards showing single-month-ahead forecasts:
- Next 30 → next month (e.g., May if you're in April)
- Next 60 → 2 months out (June)
- Next 90 → 3 months out (July)

Each card shows the month name in gold, plus Total Revenue and GOP forecast against that month's budget with % variance.

**The "⟳ Refresh Forward 90" button** next to the heading pulls fresh forecast data from PS for the next 3 months in one click. Run this whenever you want to see the latest forward view.

**Why this matters:** group sales pacing, capital deployment timing, soft-spot identification — anything that requires looking 60-90 days out.

### 5c. Quarterly Forecast (with dropdown)

> 📷 *Screenshot placeholder: quarterly forecast section*

Pick a quarter (Q1 / Q2 / Q3 / Q4) from the dropdown. Shows:
- Q-total Total Revenue + GOP across all 17 properties
- Per-month breakdown (3 cards) inside the quarter

If a month has no data loaded yet, that card shows amber "No data — refresh that period."

**Why this matters:** quarterly board narratives. Owners and boards think in quarters, not months.

### 5d. GM Forecast Credibility

> 📷 *Screenshot placeholder: 4-metric credibility cards*

One card per property, **sorted weakest credibility first** (so coaching attention surfaces at the top). Each card shows the GM's forecasting discipline across four metrics:

| Metric | Question Answered |
|---|---|
| **Day-1 Accuracy** | This month — how close is actual GOP to the locked Day-1 forecast? |
| **Live Drift** | How much has the GM revised the forecast off the Day-1 lock? |
| **3-Month Bias** | Pattern across the last 3 closed months — sandbagging, over-optimistic, consistent, or inconsistent? |
| **Flow Discipline** | When revenue moves, does GOP flex appropriately? (Cost discipline.) |

Each metric gets a color-coded score. The card's left border + the **Overall** label (STRONG / MIXED / WEAK / POOR with a 0-100 number) summarize all four.

**Why this matters:** this is the weapon for GM coaching calls. A GM saying "I'll hit budget" but with a 3-Month Bias of "Sandbagging" and Flow Discipline "Negative" is telling you exactly what kind of conversation to have.

### 5e. Flow-Through Tracker

Per-property list of flow-through %, sorted weakest first. Verbatim verdicts: Strong / Acceptable / Weak / Negative.

**Why this matters:** quick scan of cost discipline across the portfolio when revenue swings.

---

## 6. PSC Tab — Performance Score Card

> 📷 *Screenshot placeholder: full PSC for one property*

The hub's signature deliverable. One scorecard per property, total 200 points possible, scored across four sections following your Google Sheet rubric:

- **Financial** (max 145): Total Revenue · RevPAR Index · GOP $ · GOP Margin % · Flex/Flow · Forecast Accuracy
- **Guest Satisfaction / Quality** (max 30): Brand Score · Google Score · QA / BSA
- **Associate** (max 25): AOS · Retention (Turnover %) · (more to add)
- **Corporate Citizen** (max 5): Community Engagement

### How scoring works

**Stair-step bands**, not interpolation. For each metric:
- Actual ≥ 110% of target → **Maximum** points
- Actual ≥ 100% of target → **Budget** points
- Actual ≥ 95% of target → **Minimum** points
- Below 95% → 0 points

**Inverted metrics** (lower is better — Retention/Turnover, Forecast Accuracy) flip the comparison: smaller value = higher tier.

The far-right **Actual %** column shows the achievement ratio that drove the tier placement, color-coded so you can see at a glance where each row landed.

### Property selection + Top 5 highlight

> 📷 *Screenshot placeholder: property selector dropdown + a top-5 badge*

Top of the PSC has a property dropdown. "All Properties" shows all 17 stacked. Pick a single property to see just that one. Top 5 ranked properties get a gold "★ TOP 5 HOTEL · #N" badge in the header.

### Auto-derived from PS where possible

- **Total Revenue, GOP, Occ, ADR, RevPAR** — actuals + budget pulled from PS every refresh
- **RevPAR Index (MTD + YTD)** — auto-derived from STR data flowing into PS via COMPPRP/COMPSET tags. RGI badge in the row label confirms STR-sourced.
- **Forecast Accuracy** — actual GOP vs **Day-1 Primary Forecast** (auto-snapshot on the 1st of each month, locked for the rest of the month). YTD column auto-sums the snapshots — no manual entry needed.

### Manual inputs (where PS doesn't have it)

> 📷 *Screenshot placeholder: PSC Manual Inputs section in Data Entry tab*

The Data Entry tab has a dedicated "PSC Manual Inputs" section per property for the fields without API integration: Brand Score, Google Score, AOS Score, Turnover %, QA / BSA (pass/fail), Corporate Citizen (pass/fail). Plus a manual override field for Primary Forecast GOP if you want to lock in a custom Day-1 value.

### Export

PDF print and Excel export buttons at the top of the PSC tab. Both are 1-click — produces a clean, owner-ready scorecard.

**Why this matters:** this is what you send to ownership groups, lenders, and the board. The PSC reduces 200 data points into one number per property and one badge per tier.

---

## 7. Data Entry Tab

> 📷 *Screenshot placeholder: data entry cards*

One card per active property, two sections per card:

**Financials (PS-fed where available)** — Total Revenue, RevPAR, Occupancy, ADR, GOP, NOI, Labor, Rooms Sold/Available. These get auto-populated by PS refresh; manual entry is for properties without PS integration or for overrides.

**PSC Manual Inputs — no API yet** — the eight fields that don't flow from any system: Primary Forecast GOP $, RevPAR Index (current + YTD), Brand Score, Google Score, AOS, Turnover %, QA/BSA, Corporate Citizen. Enter at the start of the month (or whenever data lands) and the PSC picks it up.

Each card has its own Save button, plus a global "💾 Save All" at the top.

**Why this matters:** this is where you put data the API can't reach — quality scores from brand audits, retention numbers from HR, community engagement reporting.

---

## 8. Admin Tab

> 📷 *Screenshot placeholder: admin tab — refresh buttons + tag map*

Configuration and bulk operations.

### Refresh buttons (top right)

- **⟳ Refresh All from PS** — pulls active period only. Fastest. ~10-15 seconds.
- **⟳ Refresh YTD (all months)** — pulls Jan through active month. ~30-60 seconds.
- **⟳ Backfill Year…** — prompts for a year (e.g., 2025), pulls all 12 months. ~1-2 minutes. Used to seed historical data.
- **🔍 Debug PS Data** — raw PS response inspector for troubleshooting tag mappings.

### ProfitSword Tag Map

The grid below maps each property to its PS site tag. If a property is unmapped, refreshes skip it (red dot). Mapped properties show a green dot.

### Configuration panels

ProfitSword credentials, AI key, active period, dataset IDs.

**Why this matters:** if data isn't flowing for a property, this is where you check the tag map. If you're onboarding mid-year, this is where you backfill.

---

## 9. AI / Council Mode (briefly)

> 📷 *Screenshot placeholder: AI panel + persona selector*

The hub has 24 AI personas (CEO, COO, CFO, CIO, VP Revenue, VP Sales, etc.) you can chat with. Each persona has full portfolio context loaded. Used for:
- Coaching call prep
- Owner update drafts
- Board narrative writing
- Multi-perspective analysis (Council Mode pulls multiple personas into one room)

This is its own deep topic — covered in the [Persona Platform](../superhost-agents/CLAUDE.md) guide.

---

## Operating rhythm — how to actually use this

**Daily (5 minutes):** Overview tab → KPI tiles → NOI YTD chart. If anything is red, drill in.

**Weekly (15-30 minutes):** Forecast tab → GM Forecast Credibility cards (sorted weakest first). Pick the bottom 2-3 properties, plan a coaching call.

**Monthly (1 hour at month-end):**
1. Hit Refresh All from PS
2. Enter PSC Manual Inputs for every property (Brand Score, Google, AOS, etc.)
3. Capture or verify Primary Forecast GOP for the new month (auto-snapshots fire on Day 1, but verify)
4. PSC tab → review every property
5. Owner Groups tab → click each owner, draft updates

**Quarterly:** Forecast tab → Quarterly Forecast view. Owner Reports view. Board narrative draft via AI.

---

## When something looks wrong

The single best diagnostic resource is `docs/HUB_OPERATIONS.md`. It documents every operational gotcha we've hit so far:
- Auto-start scheduled task and why it works
- Auto-refresh schedule
- YTD aggregation requirements
- Primary Forecast snapshot timing
- STR comp set publication lag
- RevPAR Index target import workflow

Open that doc first when something doesn't add up.

---

## Sharing the hub with a colleague

Two paths covered in detail in `docs/HUB_OPERATIONS.md`:
1. **Tailscale** — your colleague gets the full live hub, your machine has to be on
2. **Cloud deploy** — the hub runs always-on, accessible from anywhere

For quick one-off snapshots, use the Export button or the PSC PDF print.

---

## End of walkthrough

If you're recording a Loom of this, the natural beats are:
1. Opening (1 min) — what the hub is, who it's for
2. Overview tab (2 min) — the daily cockpit
3. PSC tab (3 min) — the signature deliverable, scoring system
4. Forecast tab (2 min) — current month + 30/60/90 + GM credibility
5. Owner Groups (1 min) — owner-call prep
6. Data Entry / Admin (1 min) — keeping it healthy
7. Closing (30 sec) — operating rhythm

Total target: 10-12 minutes, on the long side. Trim ruthlessly when you record.
