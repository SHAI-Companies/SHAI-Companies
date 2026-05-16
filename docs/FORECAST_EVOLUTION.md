# SHAI Forecast Evolution — From Reporting to Revenue Intelligence

**Author:** Chris Hatfield · **Captured:** 2026-05-13

> SHAI currently forecasts "what is likely." It needs to forecast **"what is most probable based on live demand behavior."** That means probability modeling, pickup curve modeling, market response modeling, and uncertainty weighting. That is the leap from AI reporting to AI revenue intelligence.

This doc is the canonical critique + roadmap for the daily-forecast engine's evolution past Phases 1–5 (data ingestion). It supersedes nothing in `SHAI_FORECAST_STACK.md` — the stack defines the *data layers*; this doc defines the *intelligence layers* on top.

---

## Where the Model Is Strong (Phase 1–5 baseline)

1. **Segment awareness** — recognizes transient dominance, minimal group, no contract base. Holiday Inn demand quality is heavily segment-dependent and this matters.
2. **Operational tie-in** — staffing recommendations, labor hours, HPOR alignment. Very few forecasting systems bridge demand → operational execution. Continue this direction.

---

## Where the Model Is Weak

### 1. The forecast is too linear *(biggest issue)*

The AI forecasts averages instead of demand curves. It acknowledges cliffs ("May 14–25 transient OTB ranges 14–74 rms/day") but then continues with static assumptions.

A human revenue strategist would immediately ask:
- Is this true demand destruction?
- Is this an export issue?
- Is pickup delayed?
- Are competitors also soft?
- Are events missing?
- Did BAR move too high?
- Is there displacement?

**The AI needs conditional logic.** It should branch its reasoning based on what the data suggests.

### 2. Confidence is only at month-level

Right now: `June = HIGH · July = HIGH`. That's dangerous. Daily confidence should fluctuate based on booking-window behavior, pace deviation, segment dependency, event certainty.

Example of what's needed:

| Date | Confidence | Why |
|---|---|---|
| May 14 | LOW | Cliff in transient OTB |
| May 15 | LOW | Same |
| May 16 | MED | Recovers |
| Memorial Weekend | MED-HIGH | Events lock demand |

### 3. No pickup curve intelligence

The model sees current OTB but doesn't appear to understand expected future pickup velocity. Critical to feed:

**Historical pickup curves** (by segment):

| Days Out | Avg Pickup |
|---|---|
| 21 days | 18 rooms |
| 14 days | 26 rooms |
| 7 days  | 41 rooms |
| 3 days  | 29 rooms |

Without this, the AI overreacts to temporary pace gaps that historically fill in close-to-arrival.

### 4. No "normal pace range" modeling

SHAI identifies anomalies but doesn't quantify anomaly severity. Need statistical pace deviation scoring:

> "Current transient pace is 42% below historical booking curve for same DOW/seasonality pattern."

That allows distinguishing **true risk** from **normal volatility**.

### 5. Group logic needs work

The model currently treats group as booked or not booked. Real forecasting evaluates:
- Probability of group conversion
- Block wash
- Inquiry pipeline
- Tentative vs definite
- Displacement value

Need uploads for: sales pipeline, tentative groups, lost business reports, denied business, wash history. Without these the AI underestimates future group pickup.

### 6. ADR logic is still weak *(biggest strategic flaw)*

> "ADR firms to $128–$137 May 26–28" — but **why**?

The AI infers ADR from occupancy instead of market positioning. Need Lighthouse rate-shop data integrated directly into forecasting logic so the model asks:
- Are comps raising rates?
- Is market compression forming?
- Is the property underpriced?
- Is ADR resistance occurring?

(Note: Phase 5 wired the Lighthouse rate-shop data structurally — but the prompt isn't yet *reasoning* with it the way Chris's critique demands.)

### 7. No forecast risk scoring

Every forecast should carry:

| Risk Type | Score |
|---|---|
| Pace Risk | High |
| ADR Risk | Medium |
| Wash Risk | Low |
| Compression Opportunity | Medium |
| Group Dependency | Low |
| OTA Exposure | High |

This transforms the system from forecasting → **ownership intelligence**.

### 8. No booking window segmentation

Different segments behave differently:

| Segment | Typical Window |
|---|---|
| OTA | 0–5 days |
| Corp | 7–14 days |
| Group | 30–120 days |
| Loyalty | 3–10 days |

The AI likely blends pickup behavior too broadly. That weakens forecasting precision.

### 9. No quantitative external demand scoring

Events are referenced narratively but not quantitatively weighted. Each date should carry a numeric Demand Score:

| Date | Demand Score |
|---|---|
| May 28 | Moderate |
| May 29 | High |
| May 30 | Medium |
| May 31 | Low |

Drivers: Keeneland, UK athletics, graduations, concerts, conventions, airline disruptions, interstate travel surges, weather risk.

### 10. No actual vs forecast feedback loop

The model must self-correct. Every day SHAI should compare projected pickup vs actual pickup, projected ADR vs actual ADR, then retrain assumptions. Without feedback loops, AI forecasting stagnates.

### 11. No STR share intelligence in forecast reasoning

The model forecasts property performance only. Hotels compete in markets. SHAI should ask:
- Are we underperforming market occupancy?
- Are we overpriced?
- Are we losing share?
- Is ADR compression internal or market-wide?

Without STR positioning, you cannot distinguish *weak market* from *weak strategy*.

---

## Priority Sequence (Chris's recommended order)

### Priority 1 — Pace behavior fundamentals
- Historical pickup curves (by segment, by lead time)
- Booking window distributions (OTA / Corp / Group / Loyalty)
- Cancellation / wash patterns

**This alone will massively improve forecast accuracy.**

### Priority 2 — Pricing & market intelligence depth
- Lighthouse comp pricing in active reasoning (not just context)
- STR daily penetration
- Quantitative event scoring (replacing narrative reference)

**This improves ADR intelligence.**

### Priority 3 — Trust & transparency
- Daily confidence scoring
- Anomaly severity scoring (pace deviation %)
- Forecast risk weighting (Pace / ADR / Wash / Compression / Group Dep / OTA Exposure)

**This improves executive trust.**

### Priority 4 — Adaptivity
- Daily AI retraining loop (actuals vs forecast comparison feeding back into model context)

**This is where SHAI becomes truly adaptive instead of static.**

---

## The Biggest Missing Piece

> SHAI forecasts "what is likely." It needs to forecast "what is most probable based on live demand behavior."

That means:
- Probability modeling
- Pickup curve modeling
- Market response modeling
- Uncertainty weighting

That is the leap from **AI reporting** to **AI revenue intelligence**.

---

## Implementation Notes (working scratch — update as phases ship)

**What's actually in place today (Phases 1–5):**
- ✓ PMS pace ingestion (Opera + Lighthouse) — Layer 1 data
- ✓ STR via PS + Lighthouse CY+LY comparables — Layer 2 data
- ✓ Web-search events with impact tiers — Layer 3 data
- ✓ Lighthouse rate shop (own BAR, comp set avg, 5 individual competitors) — Layer 4 data
- ✓ Operational labor tie-in in monthly summary
- ✓ Segment-grain daily forecast (Transient / Group / Contract × Rms / ADR / Rev)
- ✓ Monthly confidence
- ⚠ Daily confidence — not yet (Priority 3)
- ⚠ Risk scoring — not yet (Priority 3)
- ⚠ Pickup curve reasoning — partial (we have 7d pickup; no historical curves) (Priority 1)
- ⚠ Anomaly severity — not yet (Priority 3)
- ⚠ Booking-window-aware reasoning — partial (Priority 1)
- ⚠ Self-correction loop — not yet (Priority 4)

**Hardest data gaps to fill:**
- Historical pickup curves require *longitudinal pace data* — accumulates naturally as Chris drops weekly Rev Paks, but the curves only become statistically meaningful after ~12–16 weeks of snapshots stitched together.
- Wash history requires the PMS "no-show / cancellation" reports, not in current uploads.
- Actuals-vs-forecast loop requires persisting yesterday's forecast and computing the delta on today's run. Storage + comparison logic.

**Operating principle reaffirmed:** every forecast output must pair a number with the action it implies. If the forecast doesn't end in a recommended action, the system is still reporting, not forecasting.
