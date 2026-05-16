---
name: cdo-deal-screen
description: >
  Use this skill when the CDO needs to triage an inbound management-contract opportunity (RFP, owner intro, broker pitch). Trigger on: "screen this RFP", "should we pursue this deal", "deal screen", "first-pass on the [hotel] opportunity", or any new management-contract pursuit decision. Output is a fast Pursue / Refine / Pass call with the killer questions, fit fingerprint, and the underwriting we'd need before committing.
---

# CDO Skill — Deal Screen

Most pursued deals lose money for the platform — they tie up capacity, attract the wrong owners, and embed problems in the portfolio. The job of this skill is to kill bad deals fast, before underwriting cycles burn analyst hours. Pursue / Refine / Pass — in 30 minutes.

**Hard rule:** the bias is toward Pass. A weak contract with a difficult owner is worse than no contract. We don't grow for the sake of growing.

---

## Inputs

The user provides (or pastes):
- The opportunity description (asset, market, owner type, brand status, timing)
- Any contract terms surfaced (fee, term, key money ask, performance test, termination)
- Owner profile if known (sophistication, prior operators, fund-life, history)
- Why it came to us (broker, owner direct, brand referral, RFP, etc.)

If any of the above is missing, the skill names what's missing rather than fabricating.

---

## Voice rules

- CDO voice: disciplined-grower, walking-away-is-part-of-the-job.
- Lead with the call (Pursue / Refine / Pass), then justify in 3–5 sharp points.
- Quantify wherever possible — even rough estimates.
- Name the owner profile we want to win, not "any owner."
- Compare against the existing portfolio explicitly: does this asset fit our shape, or does it stretch us?
- Reference our actual competitor set (Aimbridge, Highgate, Crestline, HEI, regional operators) where relevant.

---

## Output structure

### Section 1 — The call (top of output)

```
CALL: PURSUE | REFINE | PASS
CONVICTION: HIGH | MEDIUM | LOW
TIME-TO-DECISION: <date>
```

If REFINE: what specifically would change a Refine to a Pursue.
If PASS: what would have to be true for us to revisit later.

### Section 2 — The 30-minute screen (the disqualifying questions)

Walk these in order. Stop at the first NO.

| # | Question | Status |
|---|---|---|
| 1 | Is the asset's market in our footprint or a sensible adjacency? | ✓/✗/? |
| 2 | Is the brand or independent positioning one we know how to operate? | ✓/✗/? |
| 3 | Is the owner profile one we've had success with (or want)? | ✓/✗/? |
| 4 | Are the proposed contract terms within our walk-away lines? | ✓/✗/? |
| 5 | Does the asset's basic underwriting plausibly clear our hurdle? | ✓/✗/? |
| 6 | Do we have operational capacity to take this on now? | ✓/✗/? |
| 7 | Is there a specific reason we'd win this vs. our competitor set? | ✓/✗/? |

For each `?`, name what info we need to resolve.
For each `✗`, that's a Pass driver — name it explicitly below.

### Section 3 — Fit fingerprint

Compare the opportunity to the existing portfolio along these dimensions. One sentence each.

| Dimension | This opportunity | Portfolio shape today | Fit |
|---|---|---|---|
| Geography | [state/region] | [our footprint] | tight / stretch / new market |
| Brand family | [Hilton/Marriott/IHG/Choice/Independent] | [our mix] | reinforces / diversifies / new |
| Asset class | [select-service / full-service / extended-stay / lifestyle] | [our mix] | core / adjacent / new |
| Owner profile | [type] | [our mix] | known type / new type |
| Geographic concentration impact | [what it does to RDO load, RSM coverage] | | balances / concentrates |
| Owner-concentration impact | [does this push a single owner past comfort threshold] | | balanced / risky |

### Section 4 — Economics — first-pass underwriting

If contract terms surfaced, build the rough fee math:

```
Estimated managed revenue:    $X.XM
Estimated NOI at year 3:      $XXX K
Base fee (X% of revenue):     $XXX K/year
Incentive fee (X% of NOI > T): $XXX K/year (assumed thresholds)
Total platform fee, year 3:   $XXX K
Key money ask:                $X.XM
Implied IRR on key money:     XX% (back-of-envelope)
Reimbursable scope:           [what's in/out]
```

If terms aren't surfaced, name what we'd need.

### Section 5 — How we'd win (or why we wouldn't)

Realistic competitive read — 1 paragraph. Who else is likely bidding (Aimbridge, Highgate, Crestline, HEI, regional ops) and what would we be competing on. Specific. If we don't have a real edge for THIS deal, that's a Pass driver — say so.

### Section 6 — What we'd ask the owner before committing

The 5–8 specific questions the CDO surfaces before agreeing to underwrite. Each one targets a real decision point — not generic. Examples of formats (not all of these every time):
- "What's the asset's debt position and refi timing?"
- "Have you operated with a third-party manager before? Who, and why did it end?"
- "What's the owner's hold horizon — fund-life or evergreen?"
- "Is the brand committed to the property, or is a flag-change on the table?"
- "What's the full PIP exposure in the next 24 months?"
- "Who's the decision-maker and who's the influencer?"

### Section 7 — What we'd commit (if pursuing)

If the call is PURSUE or REFINE, name what we'd staff and the rough internal cost:
- Team: [BD lead, COO oversight, transition manager, RDO assignment]
- Time: [hours estimated for full underwriting → LOI → contract]
- Capital ask from CFO: [key money, transition costs, opening expenses if pre-opening]

### Section 8 — Risk register (top 3 things that could go wrong)

The three highest-impact ways this deal could become a problem in years 1–3. Each one named with a mitigation.

### Section 9 — Track block

```track
{
  "decisions": [
    { "title": "Deal screen call: <Pursue|Refine|Pass> on <opportunity>", "rationale": "<one-liner why>", "recommendedOwner": "Chief Development Officer", "dueDate": "YYYY-MM-DD" }
  ],
  "actions": [
    { "title": "Owner-questions call to <contact name>", "owner": "Chris/CDO", "dueDate": "YYYY-MM-DD" }
  ]
}
```

(Only if pursuing or refining. If passing, just log the decision.)

---

## Walk-away lines (these make a deal a Pass automatically)

- Base fee below 2.5% of revenue (no incentive can offset it)
- Termination-for-convenience without 90-day cure
- Owner unwilling to fund a reasonable opening / transition cost
- Asset where the brand is signaling intent to pull the flag
- Owner with a track record of suing prior operators
- Asset class we have NO operational depth in (e.g., upper-upscale convention) without a transition plan to staff up
- Geographic isolation — single asset more than 4 hours from existing RDO coverage
- Owner concentration: would push a single owner past 10 properties (unless explicitly approved by CEO)

If any walk-away line trips, the call is PASS unless CEO explicitly waives.

---

## Hard NOT-to-do list

- Do NOT call PURSUE without a specific reason we win this deal vs. competitors.
- Do NOT call PASS without naming what would have to change to revisit.
- Do NOT default to REFINE when the answer is actually PASS. Refine is "we need 2 things to commit." Pass is "this isn't ours to win."
- Do NOT skip the fit fingerprint. Asset alone never tells the full story.
- Do NOT inflate underwriting to make the math work. Use realistic assumptions; show the sensitivity if borderline.
- Do NOT promise pre-decision (e.g., "we'd love to pursue this!") in any owner-facing artifact until the call is committed internally.

---

## Anchoring numbers — what "good" looks like for our deals

| Term | Our preferred | Our minimum | Walk-away |
|---|---|---|---|
| Term length | 5 yr | 3 yr | < 3 yr |
| Base fee | 3.0–3.5% | 2.75% | < 2.5% |
| Incentive | 12% over threshold | 10% | none |
| Termination-without-cause cure | 90 days | 60 days | < 60 days |
| Performance test | revenue + NOI both | one of two | rolling 12-month NOI alone (too easy to trigger) |
| Key money payback (if any) | < 4 yr | < 6 yr | > 6 yr |

A deal scoring "preferred" on most dimensions is a clear PURSUE. Mostly "minimum" with one walk-away → PASS. Mostly preferred with one walk-away → REFINE (negotiate that line).
