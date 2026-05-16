---
name: portfolio-quarterly-rollup
description: >
  Use this skill whenever a hotel portfolio executive needs to produce a monthly close
  narrative, quarterly portfolio rollup, or Q1/Q2/Q3/Q4 results summary — for internal
  leadership, ownership groups, or investor audiences. Trigger immediately on any mention
  of: March results, Q1 results, quarterly rollup, portfolio recap, YOY performance summary,
  month-end close narrative, quarter-end summary, index performance rollup, winner/loser
  summary, "what's working", portfolio highlights, or any request to tell the story of how
  the portfolio performed over a month or quarter. Also trigger when the executive uploads
  P&L data, STR reports, scorecard exports, or any multi-property financial data and asks
  for a consolidated narrative. This skill produces a 3-page max ownership-ready document —
  data-forward, minimal narrative, written in the Superhost voice.
---

# Portfolio Quarterly Rollup Skill
## Superhost Hospitality — Monthly Close & Quarterly Results Narrative

You are producing a **COO-level portfolio narrative** for Superhost Hospitality. Your job
is to tell the story of how the portfolio performed — in the Superhost voice — with a
data-forward structure, quantified narrative, and no filler.

**This is not a data dump. It is also not a narrative essay.** It is a structured,
table-driven document where every narrative sentence speaks directly to numbers visible
on the page.

---

## Superhost Voice Standards

These rules govern every sentence:

- **Data-forward.** Tables do the heavy lifting. Narrative supports the tables.
- **Speak to the numbers.** Every sentence must reference a visible number on the page.
- **Short sentences that land.** No compound clauses built to sound thorough.
- **Lead with the result, then the cause.** Never bury the headline.
- **No corporate filler.** Cut: "we are pleased to report", "it is worth noting",
  "as we look ahead", "we remain committed to", "leveraging our platform."
- **Confidence without spin.** State challenges directly.
- **One sentence per idea.** If you can't say it in one sentence, you don't understand it yet.
- **Ownership lens.** Every metric connects to NOI.
- **No "same-store."** Use **"portfolio"** when referring to properties with YOY comparisons.
- **Percentage points, not basis points.** Use "pts" (e.g., "+0.8 pts", "−2.1 pts") in narrative
  and tables. Reserve "bps" for internal analytical work, not ownership-facing documents.
- **Never name a single property in a negative context in narrative.** Tables show the data
  property-by-property; that is where individual names belong. In narrative paragraphs,
  refer to underperformers by count, quadrant, or aggregate dollar impact (e.g., "five
  properties in the losing-both quadrant," "four properties accounted for $X of NOI miss").
  Positive callouts may name properties ("led by Property A and Property B"). Negative
  callouts must stay aggregate. The exception: a property may be named in narrative if it is
  the **single largest driver** of a portfolio-level result and ownership is already aware
  of the situation — in that case, frame the reference factually, not critically.

**Tone test:** Would a COO say this on a 10-minute ownership call? If not, cut it.

---

## Portfolio Context

**Operator:** Superhost Hospitality
**Headquarters:** Naperville, Illinois
**Portfolio:** ~17 active branded properties — select-service and extended-stay
**Flags:** Hilton (Home2, Hampton, DoubleTree, Tru, Embassy), Marriott (TownePlace), IHG (Holiday Inn), Choice
**Ownership Groups:** Lakhany Group, Capitol One, Gateway, Alpental Capital, INDC, Gulfstream
**COO:** Tim Foley
**RDO Structure:** Jennifer Kruk | Mark Gammill
**Design System:** Navy #0D2137 | Teal #1A7E8F | Gold #C8963F | White #FFFFFF
**Font:** Calibri throughout

---

## HARD OUTPUT CONSTRAINTS

- **Maximum 3 pages.** Non-negotiable.
- **Minimum font size: 18 half-points (9pt).** Tables can use smaller within reason.
- **Data-forward:** tables carry the information; narrative ties it together.
- **Narrative limit:** 2–4 sentence paragraph under each major section — every sentence
  must reference specific numbers visible on the page.
- **No Q2 thesis, no forecast, no forward-looking commitments.** The doc reports results.
  Forward-looking commitments belong in a separate ownership email or meeting.
- **No "Actions" section.** Actions live in follow-up communications, not in the results doc.

---

## Section 1 — Data Inputs

**This skill runs inside SHAI Hub. All data comes from the live portfolio snapshot that the server injects into the system prompt on every `/api/ai/chat` call.** No file uploads are expected or accepted — the data is already in your context. Do not ask the user to attach P&L files or STR reports.

### What you receive in the system prompt

The server appends `buildPortfolioSnapshot()` output to every call. It contains:

| Section | Fields available per property (live, pulled from ProfitSword) |
|---|---|
| **Active period detail** | Revenue, GOP $, GOP %, NOI, Occ %, ADR, RevPAR, Flow %, Labor %, Rooms sold/available |
| **STR (when present)** | RGI, ARI, MPI, my RevPAR vs comp RevPAR |
| **Forecast** | Live GOP forecast, Day-1 Locked Primary Forecast (for accuracy scoring) |
| **PSC manual** | Brand Score, Google Score, QA Pass/Fail, AOS, Turnover, Community Engagement |
| **Contacts** | GM, AGM, DOS, Owner contact, RDO, RSM names + emails |
| **YTD aggregates** | Per property and portfolio: Revenue, GOP, NOI vs budget; Avg Occ / ADR / RevPAR; Avg RGI |
| **Last 3 closed months** | Per property: Revenue, GOP, RevPAR, Occ |
| **Prior-year same-period** | Per property: Revenue, GOP, NOI, Occ, ADR, RevPAR |
| **Cockpit** | Active alerts, decisions, actions, watchlist items |

### Period scope

- **Monthly Close Narrative:** use the **active period** numbers (current month) and prior-year same-month for YOY comparison.
- **Quarterly Portfolio Rollup:** aggregate the active period's quarter (e.g., active=2026-03 → aggregate Jan+Feb+Mar 2026); compare to same-quarter prior year. The YTD aggregates section in the snapshot is the foundation when the active period is month 3, 6, 9, or 12 of a quarter.

### When data is missing from the snapshot

Some fields in the canonical Q1 reference require detail beyond what the snapshot currently surfaces — specifically:

- **Department-level overhead breakdown** (A&G, S&M, IT, R&M, Utilities individual lines for the Overhead vs Budget table): partial. The snapshot surfaces portfolio Revenue, GOP, and Labor %, but does NOT yet split A&G / S&M / R&M / Util individually. **When this granularity is not in the snapshot, omit the Overhead vs Budget detail table and replace it with a single-line note:** `Departmental overhead breakdown will be issued in the second-pass document — current snapshot reports rolled-up GOP only.` Keep the section header so the structure stays intact.
- **Net Income (below NOI):** if the snapshot reports NOI/IBFC but no Net Income, drop the Net Income row from the KPI table (leave the other 7 rows). State `Net Income to be added with full P&L second pass` in the table caption.
- **STR / RGI:** if the active period's RGI is absent from the snapshot, fall back to **Mode B** of Section 3.6 (the NOI-only diagnostic with `STR pending` placeholders in the 4-cell snapshot — see canonical Q1 reference).
- **Guest Experience Scores:** if `m.guestScore`, `m.googleScore`, etc. are absent for the period, render the `GSS pending` placeholder pattern shown in the canonical reference.

### What NOT to do

- Do not ask the user to upload P&L files, STAR reports, scorecard exports, or GM narratives. They are not coming.
- Do not fabricate numbers to fill gaps. If the snapshot doesn't have it, mark it pending using the patterns above.
- Do not reference "the attached file" or "the P&L you provided" — there is no attachment.
- Do not pull numbers from training data. Every number in the output must trace to a value visible in the live snapshot inside the current system prompt.

---

## Section 2 — Index Framework & Methodology

Always report all three indexes. These are the portfolio's competitive health signals.

| Index | Full Name | Benchmark | What It Measures |
|---|---|---|---|
| MPI | Market Penetration Index | 100 = fair share | Occupancy capture vs. comp set |
| ARI | Average Rate Index | 100 = rate parity | ADR vs. comp set |
| RGI | Revenue Generation Index | 100 = fair share | RevPAR share vs. comp set |

**Critical methodology rules:**

- **NEVER average RevPAR Index % change (or any index) across properties.** RGI is a
  ratio and averaging distorts the picture. Properties have different room counts and
  comp-set compositions.
- **Report index movement as counts, not averages.** Example: "12 of 17 above fair share;
  6 of 15 portfolio gainers YOY."
- **Pull out properties with no YOY comp data.** Any property missing RevPAR Index %
  change gets excluded from portfolio share-movement analysis and flagged separately in
  the narrative (e.g., new properties, data population gaps).
- **Use "portfolio" not "same-store"** in all labels and narrative.
- **Index language rules:**
  - Above 100 = above fair share / "gaining share"
  - Below 100 = below fair share / "giving up share"
  - Movement matters as much as level — a 97 trending up is better than a 103 trending down

---

## Section 3 — Required Document Structure (3-Page Max)

Build in this exact order. This is the proven, ownership-approved structure — matches the canonical Q1 2026 output verbatim.

### 3.1 Header Banner (2-row table, navy fill)

Render as a **single 2-row table** with navy `#0D2137` cell shading, white text, Calibri.
Row 1 is the title line; row 2 is the meta line. Both rows are single merged cells, centered.

**Row 1 — title (bold, ~20pt white):**
```
SUPERHOST HOSPITALITY  |  [Quarter/Month] [Year] PORTFOLIO RESULTS
```
Quarter format: `Q1 2026 PORTFOLIO RESULTS`. Month format: `MARCH 2026 PORTFOLIO RESULTS`. Title text always ALL CAPS in this banner.

**Row 2 — meta (regular ~12pt white):**
```
17 Active Properties   |   [Date Range]   |   [Status]
```
Date range examples: `January – March, 2026` (quarterly), `March, 2026` (monthly).
Status options: `Final Close` · `Preliminary — Totals Not Final` · `Month-End Close`.

Use thin-space ` ` or 3 spaces between pipe separators in row 2 (the Q1 doc uses wider spacing here than row 1).

**Reference (Q1 2026):**
> Row 1: `SUPERHOST HOSPITALITY  |  Q1 2026 PORTFOLIO RESULTS`
> Row 2: `17 Active Properties   |   January – March, 2026   |   Preliminary — Totals Not Final`

### 3.2 Headline Block (5 stacked sentences)

Five short, dense sentences. Each on its own line within a single paragraph block (line breaks, not separate paragraphs). Every sentence quantified. Order is fixed.

1. **Total Revenue:** dollar value, variance vs budget, variance YOY (with %). Add a one-clause YOY-growth attribution (e.g., `— YOY growth +14.2% inventory-driven`) if the YOY gap is meaningfully inventory- vs same-property-driven.
2. **IBFC (NOI) + GOP margin:** IBFC dollar, variance vs budget, variance YOY (with %); semicolon; GOP margin %, variance vs budget pts, variance vs LY pts.
3. **Net loss/income:** dollar with sign convention `$(XXX K)` for losses; direction word + dollar amount vs LY.
4. **Beat/miss split:** `X of 17 properties beat NOI plan for $XK; Y missed for $YK`.
5. **Single-property concentration callout** (when any one property concentrates ≥40% of the miss): name the property, state its dollar contribution, then provide the ex-property portfolio number. Example: `HGI Atlanta Airport alone is $252K of the miss — ex-HGI ATL the portfolio is +$210K to plan`. Skip this line if no single property concentrates ≥40% of the miss.

Direction words: `narrowed`, `widened`, `expanded`, `compressed`, `flat`. No passive voice.

**Reference (Q1 2026):**
> Total Revenue $14.673M, +$37K vs budget and +$1.516M (+11.5%) YOY — YOY growth +14.2% inventory-driven.
> IBFC $3.763M, −$40K vs budget but +$162K (+4.5%) YOY; GOP margin 29.7%, −0.3 pts vs budget and −1.7 pts YOY.
> Net loss $(606K), narrowed $150K YOY.
> 10 of 17 properties beat NOI plan for $374K; 7 missed for $414K.
> HGI Atlanta Airport alone is $252K of the miss — ex-HGI ATL the portfolio is +$210K to plan.

### 3.3 KPI Table (mandatory)

**H2 header (include the period explicitly):** `[Quarter/Month] [Year] Key Performance Indicators`
Examples: `Q1 2026 Key Performance Indicators` · `March 2026 Key Performance Indicators`

**6 columns:** `Metric | [Period] Actual | Budget | [Prior Period Same] | vs Budget | vs LY`
Quarterly column headers: `Q1 Actual | Budget | Q1 2025 | vs Budget | vs LY`
Monthly column headers: `Mar Actual | Budget | Mar 2025 | vs Budget | vs LY`

**8 rows in this exact order:** `Occupancy | ADR | RevPAR | Total Revenue | GOP | GOP Margin | IBFC (NOI) | Net Income`

Note the label is `IBFC (NOI)` — IBFC primary, NOI in parens. The headline block also leads with "IBFC" not "NOI."

**Format rules inside the KPI table:**
- Dollar totals (Revenue, GOP, IBFC, Net Income): **full integer with commas**, no abbreviation — `$14,672,931` not `$14.67M`.
- Per-unit dollars (ADR, RevPAR): two decimals — `$116.93` · `$75.39`.
- Net loss: parenthesized — `$(606,293)` · `$(591,406)`.
- Percentages: one decimal — `65.0%` · `29.7%`.
- Variance pts: signed, one decimal, suffix `pts` — `+0.8 pts` · `−2.0 pts`.
- Variance dollars: signed, full integer with commas — `+$37,304` · `−$40,099`.

Variance columns: Teal `#1A7E8F` favorable, Gold `#C8963F` unfavorable. Alternating row shading `#F5F5F5`.

**Narrative under KPI table (3 sentences, every sentence quantified):**
1. Revenue + RevPAR — what drove the beat/miss (rate vs. occupancy)
2. GOP margin movement — and YOY attribution (expansion-property mix vs. same-property erosion)
3. Net loss/income movement + the biggest line-item driver (typically interest)

**Reference (Q1 2026):**
> Revenue beat budget by $37K — RevPAR +$0.66 above plan on +0.8 pts of occupancy lift, partly offset by $0.47 of ADR softness.
> GOP margin compressed 0.3 pts to budget and 1.7 pts YOY; the YOY slide is expansion-property mix, not same-property erosion (same-store ADR +$1.48, +1.3% YOY).
> Net loss narrowed $150K YOY on lower interest ($2.609M vs $2.776M, −$167K).

### 3.4 Overhead vs. Budget Section

**H2 header (exact format):** `Overhead vs. Budget — $XK [Direction]`
Single em-dash with single spaces. Direction is **Title Case** (`Overrun`, `Favorable`).

Direction word options: `Overrun` · `Favorable` · `On Plan`.

**Reference:** `Overhead vs. Budget — $43K Overrun`

**Table — 5 columns × 6 rows:**

| Col | Header | Notes |
|---|---|---|
| 1 | Line | Full names: `Admin & General`, `Sales & Marketing`, `Information Technology`, `Repairs & Maintenance`, `Utilities`, `Total Overhead` |
| 2 | Actual | full integer with commas — `$1,935,839` |
| 3 | Budget | full integer with commas — `$1,920,903` |
| 4 | Variance | signed dollar, full integer with commas — `−$14,936` · `+$38,857` |
| 5 | Read | short qualitative — see options below |

**SIGN CONVENTION FOR THIS TABLE (different from KPI):**
Expense-line variance reads as `Budget − Actual`, NOT `Actual − Budget`.
- Positive variance (+$X) = under budget = **favorable**.
- Negative variance (−$X) = over budget = **overrun** = unfavorable.
- This is the inverse of the KPI table's revenue/profit-line convention. Don't flip it.

**`Read` column vocabulary:** `Slight overrun` · `Major overrun` · `Material overage` · `Favorable` · `On plan` · `Held to plan` · `Net favorable` · `Net unfavorable` · `Strongest line`

Total Overhead row gets **bold** styling.

**Narrative under overhead table (2 sentences, every sentence quantified):**
1. Name the line that drove the overrun/favorability with dollar magnitude; name the favorable lines it offset (with dollars).
2. Connect the total overhead variance to the IBFC miss/beat — state explicitly whether overhead fully accounts for the IBFC variance or whether operating profit also moved.

**Reference (Q1 2026):**
> Utilities drove the overrun — $83K over budget — and absorbed the $39K S&M and $12K IT favorability.
> The $43K overhead overrun fully accounts for the $40K IBFC miss to budget; revenue and rooms profit landed on plan.

### 3.5 STR — Competitive Position Section

**H2 header (exact):** `STR — Competitive Position`

**Methodology note line** (one short italic paragraph, muted gray `#595959`): `RevPAR Index is a ratio; portfolio averages distort the picture. Reported as counts and property-level movement.`

**4-box snapshot — single-row table, 4 cells, each cell stacks 3 lines:**

Cell shading:
- Cell 1 (Above Fair Share) — Light green `#E6F1E6`
- Cell 2 (Below Fair Share) — Light gold `#F7EDD9`
- Cells 3 & 4 (Gainers / Decliners) — Light gray `#F5F5F5`

**When STR data IS available — populate counts:**
```
| X / 17            | X / 17            | X / 15              | X / 15                |
| Above Fair Share  | Below Fair Share  | Portfolio Gainers   | Portfolio Decliners   |
| (RGI > 100)       | (RGI < 100)       | (RGI YOY ↑)         | (RGI YOY ↓)           |
```

**When STR data IS NOT available — graceful degradation (canonical Q1 2026 pattern):**
Keep the section structure intact. Replace the top-cell counts with the literal text `STR pending`. The labels stay the same. Then under the snapshot, write a short paragraph explaining:

> STAR data not yet received for [period] — competitive index reporting will be issued as a follow-on. RGI is a ratio; portfolio averages distort the picture. Property-level index movement and the share-vs-NOI quadrant diagnostic will be added in the second-pass document.

The denominator excludes properties with no prior-year comp; flag those by name in narrative when data is available.

**Reference (Q1 2026, STR pending):**
> All four cells render with `STR pending` as the top value; labels intact. Narrative explains the data is on a separate vendor cadence.

**When STR data is available, narrative under snapshot (2–3 sentences):**
- Position vs. trend read (level vs. movement)
- Name the top index gainers; describe decliners in aggregate (count, pattern, % range)
- Mention no-comp properties by name (factual flag, not negative)

### 3.5b Guest Experience Scores

**H2 header (exact):** `Guest Experience Scores`

A second 4-cell snapshot table mirroring the STR section. Same row structure (count + label + qualifier).

**4-box snapshot — single-row table, 4 cells, each cell stacks 3 lines:**
```
| X.XX           | X.XX             | X / 17                     | X / 17                |
| Overall Svc    | Cleanliness      | Above Brand Median         | On Brand Watch        |
| (portfolio avg)| (portfolio avg)  |                            |                       |
```

**Cell shading:** mirror the STR section logic — favorable counts (Above Median) tinted green `#E6F1E6`, watch counts tinted gold `#F7EDD9`, the score cells light gray `#F5F5F5`.

**When brand-system GSS data is not yet in (canonical Q1 2026 pattern):** populate the score cells with `GSS pending`, keep labels intact, then write below:

> Brand-system GSS data (Hilton SALT, Marriott GSS, IHG HeartBeat, Choice MOTH) and Medallia [period] results not yet received — will be issued with the STR follow-on. Quality scores are a leading indicator for RevPAR Index movement; both will be reported together.

**When GSS data is available, narrative under snapshot (2 sentences):**
- Overall service + cleanliness movement vs. prior period or brand median.
- Property count above brand median vs. on brand watch — name watched properties only if there is one and ownership is already aware.

### 3.6 Diagnostic — by Property

This section has TWO modes depending on STR data availability.

#### Mode A — STR data available: Share Movement × NOI (4-quadrant diagnostic)

**H2 header:** `Diagnostic — Share Movement × NOI`

**Single table, 5 columns:** `Property | RGI | RGI Δ | NOI vs B | Quadrant`

**Quadrant labels include the property count in parentheses, on the first row of each group only:**

1. **★ Winning Both  (n)** — RGI up + NOI beat — light green `#E6F1E6` tint
2. **NOI Win, Share Loss  (n)** — RGI down + NOI beat — no tint
3. **Share Gain, Margin Leak  (n)** — RGI up + NOI miss — light gray `#F5F5F5` tint
4. **✗ Losing Both  (n)** — RGI down + NOI miss — light gold `#F7EDD9` tint

The Quadrant cell is **populated only on the first row of each group** — empty for subsequent rows (visual grouping). Quadrants render in the order above. Properties with no RGI comp data are excluded from this table (call them out by name in narrative instead).

**RGI Δ format:** percent with sign (`+11.7%`, `−6.4%`). Use `−` (U+2212).
**NOI vs B format:** signed dollar in K (`+$108K`, `−$252K`). Use parentheses only in the headline block for net loss; use signed-dollar everywhere else.

**Narrative (2–3 sentences):**
- Quantify each quadrant with specific dollar amounts.
- Name the top NOI contributors in the **winning-both** and **NOI-win-share-loss** quadrants.
- For the losing-both quadrant, state aggregate dollar impact and property count — do NOT name underperforming properties in narrative. The table already shows them. **Exception:** a single property may be named if it concentrates ≥40% of the quadrant's dollar impact AND ownership is already aware of the situation (frame factually, not critically).

#### Mode B — STR data pending: NOI vs Budget by Property (single-axis fallback)

**H2 header:** `Diagnostic — NOI vs Budget by Property ([Period])`
Examples: `Diagnostic — NOI vs Budget by Property (Q1)` · `Diagnostic — NOI vs Budget by Property (March 2026)`

**Methodology note** (italic, muted): `Without RGI data, this is a one-axis read on NOI variance to plan; the full Share × NOI quadrant diagnostic will be reissued with the STR follow-on. Properties grouped: NOI Beat (top) and NOI Miss (bottom).`

**Single table, 6 columns:** `Property | Revenue ($K) | Rev vs B ($K) | IBFC ($K) | IBFC vs B ($K) | YOY Rev`

**Format rules:**
- Dollar values in this table are **$ thousands as bare integers** — `2,380` not `$2.38M`. Header makes the unit explicit (`Revenue ($K)`).
- Variance dollars: signed bare integer — `+127`, `−287`, `+0`.
- YOY Rev: signed percent with one decimal — `+11.2%`, `−6.9%`, `no comp` for properties without prior-year comparison.

**Properties grouped:**
- Top block: NOI Beat (rows where `IBFC vs B` ≥ 0), sorted descending by IBFC vs B.
- Bottom block: NOI Miss (rows where `IBFC vs B` < 0), sorted ascending (worst first).
- A subtle separator row or blank line between the two groups is acceptable but optional.

**Narrative (4 sentences):**
1. Beats: `X properties beat budget on NOI for $XK of upside, led by [Property 1] (+$XK), [Property 2] (+$YK), and [Property 3] (+$ZK)`.
2. Misses: `Y properties missed for $YK of downside`; if ≥40% concentration in one property, follow with `; [Property] accounts for $XK — XX% of the total miss`.
3. Ex-concentration view: `Ex-[Property], the portfolio is [+/−]$XK to budget`.
4. No-comp flag (only if applicable): `[N] properties have no YOY revenue comp ([names]) and are flagged for the STR follow-on`.

**Reference (Q1 2026, STR pending):**
> Ten properties beat budget on NOI for $374K of upside, led by Embassy Suites Naperville (+$108K), Home2 Normal (+$75K), and Hampton Schaumburg (+$71K).
> Seven properties missed for $414K of downside; HGI Atlanta Airport accounts for $252K — 61% of the total miss.
> Ex-HGI ATL, the portfolio is +$210K to budget.
> Two properties have no YOY revenue comp (Home2 Suites Owensboro, zTru by Hilton Holland) and are flagged for the STR follow-on.

### 3.6b NOI Miss Properties — Variance Detail ($K)

A departmental decomposition of the NOI-miss properties only. Always included when there are any miss properties in scope (Mode A or Mode B).

**H2 header (exact):** `NOI Miss Properties — Variance Detail ($K)`

**Methodology note** (one paragraph, italic muted) — include verbatim:
> Granular variance to budget by department for the [N] NOI-miss properties. Sign convention: Variance = Actual − Budget. Revenue/profit lines (Rev, Rms Profit, GOP): + favorable, − unfavorable. Expense lines (A&G, S&M, IT, R&M, Util): + overrun, − under budget. Flow %: GOP loss as a % of revenue decline; "neg" = revenue beat / GOP miss (cost leak); ">100%" = GOP fell faster than rev. Property names abbreviated: DT = DoubleTree, TPS = TownePlace Suites, HGI = Hilton Garden Inn.

**Single table, 11 columns:** `Property | Rev | Rms Profit | A&G | S&M | IT | R&M | Util | GOP | Flow % | Read`

One row per miss property. Use compact property names (DT Winston-Salem, TPS Dallas Mesquite, HGI Atlanta Airport, etc.). Dollar values as **signed bare integers in $K** (`+20`, `−287`, `+0`).

**`Flow %` column values:**
- Numeric percent when revenue moved and GOP followed (e.g., `83%`, `65%`, `91%`)
- `neg` when revenue beat but GOP missed (cost leak — no rate to flow)
- `>100%` when GOP fell faster than revenue
- Always one of these three forms — never blank.

**`Read` column** — one short clause per row, e.g.:
- `Mechanical $2K miss; rooms +$20K`
- `Rooms-dept cost leak`
- `Pure rev ramp shortfall`
- `Util +$25K — entire story`
- `Rev collapse; OH −$60K favorable`
- `Rev miss + R&M leak; ramping`
- `Rooms profit −$19K; A&G leak`

**Narrative (3–4 short sentences with a one-line lead):**

Lead sentence pattern: `[N] patterns.` — where N is the number of distinct failure modes you see.

Then one short sentence per pattern, naming the affected property/properties and the specific dollar driver. Patterns the Q1 doc used:
- **Revenue collapse** — top-line miss drove rooms-profit miss; overhead may even be favorable (the team cut costs against softening revenue).
- **Revenue ramp shortfall** — opening properties below ramp curve; flow-through reads roughly normal because GOP fell with rev.
- **Cost leak** — revenue held or beat, but GOP missed; usually a specific overhead line or rooms-department cost block.
- **Mechanical** — small $ miss, rooms profit clean, no real story.

**Reference (Q1 2026 pattern paragraph):**
> Three patterns.
> HGI Atlanta Airport is a revenue collapse — $287K rev miss, $241K rooms profit miss; overhead actually came in $60K under budget. The team cut what they could against a softening top line.
> zHome2 Suites Holland and zTru by Hilton Holland are revenue ramp shortfalls — flow-throughs of 83% and 65% mean GOP fell with rev as expected for properties still ramping.
> Quality Inn Lexington, Home2 Plano, and TownePlace Dallas Mesquite are cost-leak stories — revenue held or beat budget, but GOP missed; Quality Inn Lex is almost entirely a $25K utilities overrun, and Home2 Plano shows a $19K rooms profit drag plus $8K A&G overrun.
> Doubletree Winston-Salem is a mechanical $2K IBFC miss — rooms profit +$20K and overhead $8K favorable; operating performance is clean.

### 3.7 Bottom Line Callout (required close)

**Render as a single-cell, single-row table** (a boxed callout). Light gray fill `#F5F5F5`. No header outside the table — the label lives INSIDE the cell as the first paragraph.

The cell contains THREE paragraphs in this exact order:

1. **`BOTTOM LINE`** — uppercase label, Navy `#0D2137`, bold, ~12pt.
2. **Headline sentence** — Navy, bold, ~14pt — captures the period's thesis in one tight sentence. No "we are pleased to report." Vivid framing. Examples: `On plan at the top, missing on overhead, carried by the same few rooms.` · `NOI missed plan; YOY position improved.`
3. **Body** — 2–3 sentences, every sentence quantified, ties the headline to specific numbers from the doc. No forward-looking language. No next-period thesis. No commitments. No actions.

**Reference (Q1 2026):**
> **BOTTOM LINE**
> **On plan at the top, missing on overhead, carried by the same few rooms.**
> Revenue +$37K to budget; IBFC −$40K, the entire miss explained by a $43K overhead overrun ($83K of utilities pressure portfolio-wide). Of the $414K NOI miss column: $252K is HGI ATL (revenue-driven, 91% flow-through, overhead $60K favorable). The remaining $162K of miss splits between three cost-leak properties (Quality Inn Lex, Home2 Plano, TownePlace Dallas Mesquite — $76K combined) and two ramping Holland properties ($84K combined).

---

## Section 4 — What NOT to Include

**Do not include any of these in the results doc:**
- Q2 / next-period thesis or commitments
- "What We're Working On" / action items section
- Subjective winners/losers callouts beyond the diagnostic table
- Same-store RGI movement full table (redundant with diagnostic)
- No-comp properties table (mention in narrative only)
- Averaged indexes of any kind
- Passive-voice hedging ("results were impacted by...")

**These belong in separate deliverables:**
- Actions & commitments → ownership email or follow-up memo
- Deep-dive property reviews → separate property diagnostics
- Forecast / forward-looking narrative → separate forecast doc

---

## Section 5 — Analytical Standards

**Never do:**
- Report a number without a comparison (vs. budget, STLY, or comp set)
- Use percentage alone when a dollar amount is available
- Average any index across the portfolio
- Use passive voice ("results were impacted by") — use active ("demand softened")
- Include narrative that doesn't reference a specific number on the page

**Always do:**
- Quantify top and bottom performers by dollar, not rank
- Connect index movement to rate or volume cause when naming diagnostics
- Flag no-comp properties explicitly and by name
- State % of NOI beat attributable to overhead vs. revenue
- Preserve all property names in the format used in the scorecard and P&L

**Flow-through standard (when referenced):**
GOP flow-through target = 50%. Formula: `Flow % = (Actual GOP − Budget GOP) / (Actual Revenue − Budget Revenue)`
Note: When revenue variance is near zero, flow % becomes noisy — in that case, lead with
overhead favorability instead.

---

## Section 5b — Number Formatting Standards

Lock these conventions. Inconsistent formatting reads sloppy to ownership.

| Magnitude | Format | Example |
|---|---|---|
| ≥ $1M | `$X.XXM` (two decimals) | `$3.76M` · `$14.67M` |
| $1K–$999K | `$XK` or `$XXK` (no decimals) | `$108K` · `$252K` · `$40K` |
| < $1K | `$X` (no decimals) | `$83` |
| Net loss in headline only | parentheses | `($606K)` |
| Variance dollars | signed | `+$108K` · `−$252K` · `+$0.50` |
| Percentages | one decimal | `29.7%` · `+4.5%` |
| Variance in pts | signed, one decimal, suffix `pts` | `+0.8 pts` · `−2.1 pts` |
| Minus sign | use U+2212 (`−`) — visually balanced; hyphen-minus acceptable in code | `−$40K` |
| RGI | one decimal | `229.2` · `84.6` |
| RGI Δ | percent with sign + one decimal | `+11.7%` · `−6.4%` |

**Property naming:** use canonical short names from the property list. Do NOT improvise abbreviations. If the official name is `Embassy Suites Chicago Naperville`, use `Embassy Suites Naperville` (drop "Chicago") consistently. Maintain a name map between STR and P&L data — they often differ.

---

## Section 6 — Output Format

**Default output:** Word document (.docx), 3 pages max, Superhost design system.

Build with `docx-js`. Key technical constraints (learned the hard way):
- US Letter: `size: { width: 12240, height: 15840 }`
- Margins: 1080 DXA (0.75") all sides fits the 3-page target
- Font: **Calibri throughout** — `default: { document: { run: { font: "Calibri", size: 20 } } }`. Use 20 (10pt) for body, 18 (9pt) for dense tables, 28 (14pt) for the Bottom Line headline, 40 (20pt) for the header banner title row.
- Table widths: DXA explicit on table + each cell.
- Cell shading: `ShadingType.CLEAR` (never SOLID).

**Canonical color palette (from the Q1 2026 ownership-approved output):**

| Token | Hex | Use |
|---|---|---|
| Navy | `#0D2137` | Header banner fill; primary text; BOTTOM LINE label + headline |
| Teal | `#1A7E8F` | Favorable variance text color (KPI table) |
| Gold | `#C8963F` | Unfavorable variance text color (KPI table); accent rules |
| Slate Gray | `#595959` | Methodology notes (italic, muted) |
| White | `#FFFFFF` | Text on navy banner |
| Light Green | `#E6F1E6` | "Above Fair Share" tint; "Winning Both" quadrant tint |
| Light Gold | `#F7EDD9` | "Below Fair Share" tint; "Losing Both" quadrant tint |
| Light Gray | `#F5F5F5` | Bottom Line callout fill; neutral row alternation; "Gainers/Decliners" cells |

**Section header style (H2):** Navy `#0D2137`, bold, ~14pt Calibri, with a thin gold underline rule. No "Ownership Summary" or other subtitles in H2s — the section title alone.

**If ownership requests HTML or email versions, produce separately** — do not try to cram
into the 3-page Word format.

---

## Reference Files

- `references/output-email.md` — Email format for quarterly ownership communications
- `references/voice-examples.md` — Before/after sentence examples in Superhost voice
- `references/q1_2026_example_structure.md` — The proven 2-page version of Q1'26 as a
  reference implementation (created from the April 2026 build)

---

## Build Workflow

1. **Ingest data.** Identify P&L file (A vs B and/or A vs A), STR file, any scorecard.
2. **Verify STR completeness.** Pull any property missing RGI % change — flag separately.
3. **Compute the 4-quadrant diagnostic.** Match STR property names to P&L names
   (naming conventions differ — e.g., "Home2 Suites by Hilton Bloomington Normal" vs.
   "Home2 Normal"). Build explicit name map.
4. **Compute overhead contribution to NOI beat.** (Overhead favorable / NOI beat × 100).
5. **Build KPI, overhead, STR snapshot, diagnostic tables.**
6. **Write each section's 2–4 sentence quantified narrative.**
7. **Render to docx.** Validate with `validate.py`. Convert to PDF and visually verify
   3-page limit. If it spills to 4+ pages, tighten margins, compress table padding, or
   shorten narrative — never drop a required section.
8. **Deliver.** Present files tool with the final docx.

---

## Appendix — Q1 2026 Preliminary Close (Canonical Reference, STR Pending)

This is the canonical Q1 2026 ownership-ready output produced via Claude.ai chat and approved as the format-of-record. **Use this as the literal structural and stylistic template.** Replace all values with the current period's data. Match every section header, sentence pattern, table layout, and the "pending data" graceful-degradation behavior.

### A.1 Header Banner (2-row navy table)

Row 1 (navy fill, white text, bold ~20pt, centered): `SUPERHOST HOSPITALITY  |  Q1 2026 PORTFOLIO RESULTS`
Row 2 (navy fill, white text, regular ~12pt, centered): `17 Active Properties   |   January – March, 2026   |   Preliminary — Totals Not Final`

### A.2 Headline Block (5 stacked sentences)

> Total Revenue $14.673M, +$37K vs budget and +$1.516M (+11.5%) YOY — YOY growth +14.2% inventory-driven.
> IBFC $3.763M, −$40K vs budget but +$162K (+4.5%) YOY; GOP margin 29.7%, −0.3 pts vs budget and −1.7 pts YOY.
> Net loss $(606K), narrowed $150K YOY.
> 10 of 17 properties beat NOI plan for $374K; 7 missed for $414K.
> HGI Atlanta Airport alone is $252K of the miss — ex-HGI ATL the portfolio is +$210K to plan.

### A.3 Q1 2026 Key Performance Indicators

| Metric | Q1 Actual | Budget | Q1 2025 | vs Budget | vs LY |
|---|---|---|---|---|---|
| Occupancy | 65.0% | 64.2% | 67.1% | +0.8 pts | −2.0 pts |
| ADR | $116.93 | $117.40 | $115.45 | −$0.47 | +$1.48 |
| RevPAR | $76.04 | $75.38 | $77.41 | +$0.66 | −$1.37 |
| Total Revenue | $14,672,931 | $14,635,627 | $13,156,950 | +$37,304 | +$1,515,981 |
| GOP | $4,364,944 | $4,391,944 | $4,134,548 | −$27,000 | +$230,396 |
| GOP Margin | 29.7% | 30.0% | 31.4% | −0.3 pts | −1.7 pts |
| IBFC (NOI) | $3,762,807 | $3,802,906 | $3,600,943 | −$40,099 | +$161,864 |
| Net Income | $(606,293) | $(591,406) | $(756,141) | −$14,887 | +$149,848 |

> Revenue beat budget by $37K — RevPAR +$0.66 above plan on +0.8 pts of occupancy lift, partly offset by $0.47 of ADR softness.
> GOP margin compressed 0.3 pts to budget and 1.7 pts YOY; the YOY slide is expansion-property mix, not same-property erosion (same-store ADR +$1.48, +1.3% YOY).
> Net loss narrowed $150K YOY on lower interest ($2.609M vs $2.776M, −$167K).

### A.4 Overhead vs. Budget — $43K Overrun

| Line | Actual | Budget | Variance | Read |
|---|---|---|---|---|
| Admin & General | $1,935,839 | $1,920,903 | −$14,936 | Slight overrun |
| Sales & Marketing | $2,321,690 | $2,360,547 | +$38,857 | Favorable |
| Information Technology | $391,647 | $403,838 | +$12,191 | Favorable |
| Repairs & Maintenance | $620,313 | $624,023 | +$3,710 | On plan |
| Utilities | $791,430 | $708,214 | −$83,216 | Major overrun |
| **Total Overhead** | **$6,060,919** | **$6,017,525** | **−$43,394** | **Net unfavorable** |

> Utilities drove the overrun — $83K over budget — and absorbed the $39K S&M and $12K IT favorability.
> The $43K overhead overrun fully accounts for the $40K IBFC miss to budget; revenue and rooms profit landed on plan.

### A.5 STR — Competitive Position (STR pending mode)

> STAR data not yet received for Q1 — competitive index reporting will be issued as a follow-on. RGI is a ratio; portfolio averages distort the picture. Property-level index movement and the share-vs-NOI quadrant diagnostic will be added in the second-pass document.

| STR pending | STR pending | STR pending | STR pending |
|---|---|---|---|
| Above Fair Share<br>(RGI > 100) | Below Fair Share<br>(RGI < 100) | Portfolio Gainers<br>(RGI YOY ↑) | Portfolio Decliners<br>(RGI YOY ↓) |

### A.6 Guest Experience Scores (GSS pending mode)

> Brand-system GSS data (Hilton SALT, Marriott GSS, IHG HeartBeat, Choice MOTH) and Medallia Q1 results not yet received — will be issued with the STR follow-on. Quality scores are a leading indicator for RevPAR Index movement; both will be reported together.

| GSS pending | GSS pending | GSS pending | GSS pending |
|---|---|---|---|
| Overall Service Score<br>(portfolio avg) | Cleanliness Score<br>(portfolio avg) | Properties Above Brand Median | Properties on Brand Watch |

### A.7 Diagnostic — NOI vs Budget by Property (Q1)

> Without RGI data, this is a one-axis read on NOI variance to plan; the full Share × NOI quadrant diagnostic will be reissued with the STR follow-on. Properties grouped: NOI Beat (top) and NOI Miss (bottom).

| Property | Revenue ($K) | Rev vs B ($K) | IBFC ($K) | IBFC vs B ($K) | YOY Rev |
|---|---|---|---|---|---|
| Embassy Suites Naperville | 2,380 | +127 | 269 | +108 | +11.2% |
| Home2 Normal | 1,163 | +155 | 468 | +75 | +27.8% |
| Hampton Inn Schaumburg | 933 | +63 | 326 | +71 | +13.1% |
| TownePlace Suites Owensboro | 699 | +45 | 220 | +31 | −18.1% |
| Mainstay Inn & Suites | 149 | +38 | 6 | +27 | −12.2% |
| Holiday Inn Lexington | 679 | +67 | 92 | +21 | +18.2% |
| Home2 Lexington | 744 | +7 | 150 | +19 | +10.8% |
| Home2 Evansville | 1,005 | +5 | 426 | +12 | +3.7% |
| Tru Northlake | 741 | +13 | 236 | +9 | +1.3% |
| Home2 Suites Owensboro | 827 | −51 | 281 | +0 | no comp |
| Doubletree Winston-Salem | 1,063 | −43 | 355 | −2 | +1.6% |
| TownePlace Suites Dallas Mesquite | 801 | +9 | 245 | −23 | −10.1% |
| zTru by Hilton Holland | 303 | −37 | −9 | −24 | no comp |
| Home2 Plano | 638 | −9 | 184 | −25 | +1.6% |
| Quality Inn Lexington | 303 | +6 | −54 | −28 | +1.5% |
| zHome2 Suites Holland | 559 | −72 | 103 | −60 | −12.4% |
| Hilton Garden Inn Atlanta Airport | 1,686 | −287 | 465 | −252 | −6.9% |

> Ten properties beat budget on NOI for $374K of upside, led by Embassy Suites Naperville (+$108K), Home2 Normal (+$75K), and Hampton Schaumburg (+$71K).
> Seven properties missed for $414K of downside; HGI Atlanta Airport accounts for $252K — 61% of the total miss.
> Ex-HGI ATL, the portfolio is +$210K to budget.
> Two properties have no YOY revenue comp (Home2 Suites Owensboro, zTru by Hilton Holland) and are flagged for the STR follow-on.

### A.8 NOI Miss Properties — Variance Detail ($K)

> Granular variance to budget by department for the seven NOI-miss properties. Sign convention: Variance = Actual − Budget. Revenue/profit lines (Rev, Rms Profit, GOP): + favorable, − unfavorable. Expense lines (A&G, S&M, IT, R&M, Util): + overrun, − under budget. Flow %: GOP loss as a % of revenue decline; "neg" = revenue beat / GOP miss (cost leak); ">100%" = GOP fell faster than rev. Property names abbreviated: DT = DoubleTree, TPS = TownePlace Suites, HGI = Hilton Garden Inn.

| Property | Rev | Rms Profit | A&G | S&M | IT | R&M | Util | GOP | Flow % | Read |
|---|---|---|---|---|---|---|---|---|---|---|
| DT Winston-Salem | −43 | +20 | +6 | −5 | +4 | +4 | −1 | −3 | 8% | Mechanical $2K miss; rooms +$20K |
| TPS Dallas Mesquite | +9 | −14 | +2 | −1 | +2 | +5 | +2 | −23 | neg | Rooms-dept cost leak |
| zTru Holland | −37 | −33 | −10 | −10 | +1 | +6 | +3 | −24 | 65% | Pure rev ramp shortfall |
| Home2 Plano | −9 | −19 | +8 | +2 | −1 | +3 | −4 | −25 | >100% | Rooms profit −$19K; A&G leak |
| Quality Inn Lex | +6 | −4 | +1 | +1 | −3 | +1 | +25 | −27 | neg | Util +$25K — entire story |
| zHome2 Holland | −72 | −52 | +2 | −6 | +0 | +10 | +1 | −60 | 83% | Rev miss + R&M leak; ramping |
| HGI Atlanta Airport | −287 | −241 | −18 | −39 | +0 | +5 | −10 | −261 | 91% | Rev collapse; OH −$60K favorable |

> Three patterns.
> HGI Atlanta Airport is a revenue collapse — $287K rev miss, $241K rooms profit miss; overhead actually came in $60K under budget. The team cut what they could against a softening top line.
> zHome2 Suites Holland and zTru by Hilton Holland are revenue ramp shortfalls — flow-throughs of 83% and 65% mean GOP fell with rev as expected for properties still ramping.
> Quality Inn Lexington, Home2 Plano, and TownePlace Dallas Mesquite are cost-leak stories — revenue held or beat budget, but GOP missed; Quality Inn Lex is almost entirely a $25K utilities overrun, and Home2 Plano shows a $19K rooms profit drag plus $8K A&G overrun.
> Doubletree Winston-Salem is a mechanical $2K IBFC miss — rooms profit +$20K and overhead $8K favorable; operating performance is clean.

### A.9 Bottom Line (single-cell light-gray callout)

> **BOTTOM LINE**
>
> **On plan at the top, missing on overhead, carried by the same few rooms.**
>
> Revenue +$37K to budget; IBFC −$40K, the entire miss explained by a $43K overhead overrun ($83K of utilities pressure portfolio-wide). Of the $414K NOI miss column: $252K is HGI ATL (revenue-driven, 91% flow-through, overhead $60K favorable). The remaining $162K of miss splits between three cost-leak properties (Quality Inn Lex, Home2 Plano, TownePlace Dallas Mesquite — $76K combined) and two ramping Holland properties ($84K combined).

---

**End of canonical reference.** When generating new periods, match this structure section-for-section, table-for-table, sentence-shape-for-sentence-shape. Vary the values, not the form.
