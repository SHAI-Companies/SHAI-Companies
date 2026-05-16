# SHAI Forecast Stack — Strategic Spec

**Author:** Chris Hatfield · **Captured:** 2026-05-13

The vision: SHAI is not a forecasting tool. It is a hotel operating intelligence system that predicts financial performance, operational stress, and guest experience outcomes simultaneously. Forecasting is one output of that system, not the system itself.

This document is the canonical reference for the data layers, integrations, and AI outputs the forecasting engine targets. When new build work is proposed, map it back here.

---

## The Six Data Layers

### 1. PMS Raw Demand Data — the most important layer outside ProfitSword

**Sources:** PEP, Opera, FOSSE, Choice Advantage, OnQ, OPERA Cloud — brand-dependent.

**Required exports:**
- Daily pickup by segment
- Pace reports
- On-the-books (OTB) by future date
- Booking window reports
- Cancellation trends
- Wash percentage
- Length of stay patterns
- Denials / regrets
- Channel mix
- Rate code production
- Market segment production
- Corporate negotiated account production
- Group block utilization
- Transient vs group mix
- Day-of-week demand curves

**Why it matters.** ProfitSword tells you what happened financially. The PMS tells you how guests behaved, when they booked, what channels drove demand, and how future pace compares to prior years. **This is where predictive power starts.**

**Single most valuable file outside PS:** Daily Pace / Pickup Report Export from PMS. It teaches the model booking behavior, lead times, demand acceleration, cancellations, and compression timing — the heartbeat of predictive hotel forecasting.

### 2. STR / Market Performance Data

**Required:**
- Daily STAR reports
- Weekly STAR reports
- 12–24 months historical
- MPI, ARI, RGI
- Occupancy / ADR / RevPAR penetration
- Competitive set occupancy trends
- Comp set ADR positioning

**Why it matters.** A hotel does not forecast in isolation. You need to know if demand softness is market-wide, if your ADR ceiling is below comp set, or if compression is forming before it shows in your PMS. Target output:

> "Market occupancy is pacing +11% versus STLY while property occupancy pace is +3%. Share erosion likely tied to ADR resistance in negotiated corporate segment."

### 3. Event and Compression Intelligence — where most hotel forecasts fail

**Sources:**
- Citywide / convention calendars
- University schedules · sports · concerts · festivals · graduations
- Government events · major employer events
- Airline disruptions · construction closures · weather disruption history

**Why it matters.** Hotels do not operate on linear demand curves. Forecasting models must recognize recurring compression, transient spikes, shoulder-night demand, and displacement opportunities. Keeneland, NCAA weekends, Bourbon events, concerts, graduations — each produces a different booking curve. The model should know when ADR can stretch, when occupancy will stall, and when staffing should flex.

### 4. Revenue Management / Pricing Intelligence — the ADR engine

**Sources:** Lighthouse, IDeaS, Duetto, OTA Insight.

**Required:**
- Rate shopping exports · competitor pricing snapshots
- Forward 90-day pricing · occupancy forecasts · compression indicators
- OTA parity reports · BAR changes over time
- Yield decisions · LOS restrictions · sellout history

**Why it matters.** Forecasting without pricing intelligence creates weak ADR projections. Target output:

> "Competitor ADR increased 14% inside 21-day booking window during prior compression periods. Current property pricing is lagging market velocity."

### 5. Operational Data — turns forecasting into NOI forecasting

**Required:**
- Labor productivity (Hotel Effectiveness exports, payroll)
- Housekeeping minutes per occupied room
- Maintenance ticket trends · OOO room trends
- Guest complaint trends · GSS scores · service recovery incidents
- F&B capture trends · ancillary revenue trends

**Why it matters.** Occupancy forecasting alone is incomplete. The real value is forecasting GOP, margin, and operational strain — labor pressure, overtime risk, guest experience degradation, flow-through impact. Target output:

> "Forecasted occupancy increase of 9% without corresponding staffing adjustments historically resulted in 14-point decline in cleanliness scores and 6% overtime overage."

### 6. External Economic Signals — optional, powerful at portfolio scale

**Inputs:** Fuel prices · airfare trends · consumer confidence · unemployment · corporate travel indexes · TSA throughput · inflation · regional indicators.

**Why it matters.** Directional indicators for transient softness, corporate travel pullback, leisure compression.

---

## The Ideal Forecast Stack

**Core Historical Layer**
- ProfitSword financials
- PMS history
- STR history

**Live Demand Layer**
- OTB pace
- Pickup
- Market compression
- Event feeds
- Competitor pricing

**Operational Layer**
- Labor
- GSS
- OOO inventory
- Payroll efficiency

**Intelligence Layer (AI output)**

*Forecast:* Occupancy · ADR · RevPAR · Total Revenue · GOP · Margin · Flow-through

*Narrative:* Why forecast changed · key demand drivers · risks · opportunities · recommended actions

*Strategic actions, e.g.:*
- Push ADR on shoulder nights
- Restrict OTA inventory
- Add housekeeping labor Friday/Saturday
- Target negotiated accounts during soft midweek
- Reduce discounting inside 14-day window

---

## Current State Map — what we have today

| Layer | Status | Where it lives |
|---|---|---|
| **PS financials** | ✓ Live | Auto-refresh every 4h; full P&L + segment pace tags (TOTPACETRN/TOTPACEGP/TOTPACECT) |
| **STR (via PS)** | ✓ Live | STR pipes comp set into PS; MPI/ARI/RGI computed in `extractMetrics`. 2–3 week publication lag |
| **STR direct API** | ✗ Not built | Direct API was draft-emailed (`docs/INTEGRATION_REQUESTS.md`); redundant now since PS gives us the data |
| **PMS pace / pickup** | ✗ Not built | The single highest-value gap. No PMS ingestion yet |
| **Demand AI (daily forecast)** | ⚠ Partial | `/api/forecast/demand/:propId/daily` — Claude Haiku 4.5, 28–31 day projection, derives segment mix from PS pace tags. Lacks PMS-derived pickup curves, lead-time bands, channel mix |
| **Daily PTD snapshot overlay** | ✓ Live | Per-day cumulative MTD snapshots feed actuals overlay on the daily forecast |
| **Event / compression feeds** | ✗ Not built | None |
| **Revenue mgmt / pricing** | ✗ Not built | Lighthouse / Duetto / OTA Insight are in App Launcher only — no data flow |
| **Operational — Hotel Effectiveness** | ✗ Not built | Integration request drafted in `docs/INTEGRATION_REQUESTS.md`, not sent |
| **Operational — labor / payroll** | ⚠ Partial | Paylocity in App Launcher; PS gives labor $ + DAYFTE; no productivity / mpor |
| **Operational — GSS / complaints** | ⚠ Manual | `guestScore` in PSC manual entry; no auto-feed |
| **External economic** | ✗ Not built | None |

---

## Highest-Leverage Next Moves

**Tier 1 — PMS pace ingestion (Chris's single most valuable file).** A canonical per-property per-day pace record:
- Schema: `{ propId, period, asOfDate, segment, otbRooms, otbRev, pickup1d, pickup7d, leadTime, lyComparable, etc. }`
- Ingestion path: paste/upload CSV or Excel from PMS (per brand: PEP, Opera, FOSSE, Choice Advantage). Re-runnable importer per the existing `tools-import-*.py` pattern
- Surface on property modal + Demand AI panel (pickup velocity, lead-time bands, segment-level pace vs LY)
- Estimated build: 8–12 hours per brand for the importer; the canonical schema + endpoints are 4–6 hours

**Tier 2 — Event / compression calendar.** Per-property events feed. Sources: brand calendars + manual entry to start, then plug into citywide / university / sports APIs. The model already knows day-of-week shape from PS pace; events tell it which days break the pattern.

**Tier 3 — Hotel Effectiveness operational layer.** Activate the integration request that's already drafted in `docs/INTEGRATION_REQUESTS.md`. Brings labor productivity and minutes-per-occupied-room into the forecast so we can output flow-through and staffing-pressure narratives.

**Tier 4 — Pricing intelligence.** Lighthouse / Duetto export. Adds forward 90-day pricing, competitor rate movements, compression indicators. ADR-engine layer.

---

## Operating Principle

The forecasting engine is judged on **whether it changes decisions**, not on accuracy in isolation. Every forecast output should pair a number with the action it implies — push ADR, restrict inventory, flex staffing, target accounts. If a forecast doesn't end in a recommended action, the system is still reporting, not forecasting.
