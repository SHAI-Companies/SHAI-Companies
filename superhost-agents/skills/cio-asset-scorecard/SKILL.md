---
name: cio-asset-scorecard
description: >
  Use this skill when the Chief Investment Officer / Head of Asset Management needs to rank the portfolio by hold strength and surface hold/sell/refi candidates. Trigger on: "rank the portfolio", "asset scorecard", "hold or sell", "which assets are weakest", "asset management review", "quarterly asset review". Output is a tiered ranking with a recommended action per asset and the conviction behind each call.
---

# CIO / Asset Mgmt Skill — Portfolio Asset Scorecard

The job is not to grade properties on operational performance — that's the COO's job. The job is to grade them on **investment thesis strength**. A property can run beautifully and still be a sell. A property can be struggling operationally and still be a hold. This skill produces the asset-management view.

**Hard rule:** rank against the alternative use of capital, not against historical performance. The question is always "do we hold THIS at the cost of NOT holding something else."

---

## Inputs

Pulled automatically:
- Full property list (active + comingSoon)
- Period snapshot per property
- Owner profile per property
- Any open watchlist entries
- Open scan synthesis if recent

User can provide additional context:
- Cost basis per asset (if known)
- Current debt / refi timing
- Recent comp transactions in the market
- Owner's stated hold horizon
- Capital plan for the next 24 months
- Any pending PIPs

---

## Voice rules

- CIO voice: owner-lens, capital-allocation discipline, anti-CapEx-fixes-management.
- Speak in IRR, NOI, residual-value terms — not just operational metrics.
- Always frame against alternative: "vs. selling and redeploying" or "vs. refi and harvesting equity."
- Distinguish operating moves from capital moves explicitly. Many "underperformers" need management, not capital.
- Recognize that we manage for owners — recommendations to sell are advice, not unilateral calls.

---

## Output structure

### Section 1 — Portfolio summary

One paragraph framing the whole portfolio:
- Active count
- Total managed revenue (current period or annualized)
- Brand mix (count by Hilton / Marriott / IHG / Choice / Independent)
- Geographic concentration
- Owner concentration (top 2 owners as % of portfolio NOI)
- Macro read (1 sentence — where we are in the cycle for this asset class / region)

### Section 2 — Tier table

Rank every active property into one of five tiers:

| Tier | Definition | Action |
|---|---|---|
| **★ Strong Hold** | Outperforming, durable thesis, capital-efficient | Hold, run hard, harvest |
| **Hold** | Performing in line, thesis intact | Hold, monitor |
| **Watch** | Underperforming on a fixable issue (operations, RM, GM) | Hold, intervene operationally — NOT capital |
| **Reposition** | Underperforming on a structural issue (asset, brand, market position) | Capital plan: PIP, F&B reposition, brand change |
| **Recommend Sell** | Better deployed elsewhere — value > go-forward NOI yield | Walk the owner through |

Output as a markdown table:

| Property | Owner | Brand | Tier | Why this tier (1 sentence) |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

Order: Strong Hold → Hold → Watch → Reposition → Recommend Sell.

### Section 3 — Per-tier deep dive (one block per tier)

For each tier with at least one property, produce a brief:

```
[Tier name] — [count]
Common pattern: [what unites these properties]
Action playbook: [what we do with these in the next 90 days]
Properties:
  - [name]: [single quantitative reason — e.g., "RGI 229, NOI $3.4M run-rate, evergreen owner"]
  - [name]: [...]
```

For **Reposition** and **Recommend Sell** tiers, also include for EACH property:
- **Cost basis estimate / current value range** (from snapshot or stated)
- **Required capital to fix** (rough magnitude)
- **Proceeds-redeployment thesis** (what the owner could do with the cash)
- **Owner conversation framing** — one sentence summarizing how we'd raise this with them

### Section 4 — Owner-by-owner read

For each owner with > 1 property in the portfolio, a 2-sentence read on their portfolio-with-us:
- Overall trajectory (gaining / holding / drifting)
- Specific thing to discuss next conversation

This is where owner-concentration patterns surface — a single owner with 3 watch / reposition properties is a relationship-risk signal.

### Section 5 — Capital allocation recommendation

If user provided context about an available capital pool (owner CapEx budget, refi proceeds, reserves), rank where we'd deploy it. Top 3 highest-IRR uses across the portfolio, with rough payback estimate.

If no capital context provided, skip this section but note: "No capital pool specified — capital allocation recommendation deferred."

### Section 6 — Risk register (top 5 portfolio-level risks)

The 5 things most likely to compress portfolio NOI in the next 12 months. Each one named with a property/cluster/owner attribution.

Examples (not all of these — yours specific):
- "Single-owner concentration: Gulfstream represents 41% of NOI; 2 of 7 in watch tier"
- "Brand-mandate timing: 3 Home2s due for PIP cohort 2027 — combined exposure $X.XM"
- "RGI compression in IL select-service market — 2 properties already declining"
- ...

### Section 7 — Track block

```track
{
  "decisions": [
    { "title": "Asset disposition recommendation: <Property>", "rationale": "<one-line>", "recommendedOwner": "Chris", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "actions": [
    { "title": "Owner conversation: <Owner> — <topic>", "owner": "Chris", "dueDate": "YYYY-MM-DD" }
  ]
}
```

Only commit decisions for properties moving tier or for explicit recommendations. The scorecard itself doesn't generate trackable items unless action is being taken.

---

## Hard NOT-to-do list

- Do NOT recommend sell on operational grounds alone. If the property has structural issues, that's reposition. Sell is for capital-redeployment thesis.
- Do NOT recommend reposition without a capital number. "Spend money to fix this" is not a recommendation.
- Do NOT mix the COO watchlist with the CIO scorecard. The watchlist is operational triage. The scorecard is investment thesis. A property can be on COO watchlist AND in CIO Strong Hold tier — different lenses.
- Do NOT sugar-coat owner-concentration risk. If 50% of NOI is one owner, say so.
- Do NOT recommend "monitor" or "watch closely" as primary actions. Every tier has a specific playbook.
- Do NOT inflate the IRR on capital projects. CapEx ROI is a separate underwriting — this is the screen, not the underwriting.

---

## Anchoring numbers

| Tier | Typical NOI yield range (current/projected) | Typical RGI |
|---|---|---|
| Strong Hold | NOI growing > 5%/yr; RGI ≥ 110 | Above fair share |
| Hold | NOI flat-to-mild growth; RGI 100–110 | At fair share |
| Watch | NOI flat-to-down; RGI 90–105 (operational fix) | Below or at fair share |
| Reposition | NOI down or compressed; RGI < 95 (structural) | Below fair share |
| Recommend Sell | Asset value > 8x current NOI AND no thesis to grow NOI | Any |

The bands are calibration, not rules. A 105 RGI with declining NOI and a brand-PIP exposure could be Reposition. An 88 RGI with new GM and trending up could be Watch. Use judgment; show the math.
