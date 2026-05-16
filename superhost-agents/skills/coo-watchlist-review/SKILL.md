---
name: coo-watchlist-review
description: >
  Use this skill when the COO needs to make the call on which 2–4 properties belong on (or come off) the watchlist this week. Trigger on: "run the watchlist", "what should be on watch", "weekly watchlist review", "Tim's watchlist", "what's slipping". The output is a tight COO-grade brief: the entries, the gating criteria, the intervention each one needs, the exit triggers, and what to escalate.
---

# COO Skill — Weekly Watchlist Review

The watchlist is the company's source of truth on which properties have stopped being self-correcting. Properties earn their way on. They earn their way off. This skill makes the call — and forces the discipline that the watchlist isn't a graveyard.

**Hard rule:** properties don't go on the watchlist for a single bad week. They go on when a pattern crosses a threshold and stays there. Properties don't come off because someone is tired of looking at them — they come off when the exit criteria are hit.

---

## Inputs

Pulled automatically:
- Portfolio snapshot (current period)
- Existing watchlist entries (current state in cockpit)
- Open actions for each property (from cockpit)
- Owner notes on each property (`data.notes[<id>]`)

---

## Skill-specific rules (voice rules come from the canonical voice block)

- COO lens: diagnostic, systematic, intolerant of vague accountability.
- Every entry names the metric, the threshold, the current value, the duration, the owner of the fix, and the exit criteria.
- "Watch" is a verb. If you can't say what we're watching FOR — it's not watchlist material.
- Never recommend a watchlist entry without naming the GM and the RDO.
- Never recommend exit without naming the actual numerical gate being met.
- Never put more than 4 properties on the watchlist at once. Past 4 it's not a watchlist; it's a problem portfolio.

---

## Threshold framework — what earns watchlist status

A property goes on watch if ANY of these hit, with duration:

| Trigger | Threshold | Duration |
|---|---|---|
| Score | < 90 | 2 consecutive periods |
| Flow-through | < 0% (negative) | 2 consecutive months |
| RGI vs comp | < 95 | 3 consecutive periods |
| GOP margin | > 4 pts below budget | 2 consecutive months |
| Labor % | > 5 pts above budget | 2 consecutive months |
| GSS | > 5 pts decline period-over-period | confirmed 2 periods |
| Brand QA | < 85 or failing | single occurrence |
| AR aging | > 60 days at > 8% of revenue | single period |
| Open AGM/GM vacancy | > 60 days | single occurrence |
| Owner concern flagged | written concern from owner | single occurrence |

**Multiple triggers compound the case but don't multiply the count** — a single property hitting 3 thresholds is one entry, with all 3 named.

---

## Output structure

### Section 1 — Watchlist call

A markdown table with columns:

| Property | Status | Trigger(s) | Current → Threshold | Duration | RDO |

Status values: **ADD** (new this week), **HOLD** (already on, recommend keep), **EXIT** (recommend off this week).

If the recommendation differs from the current state, explain in the per-property block below.

### Section 2 — Per-property block (one per ADD or EXIT)

For each ADD:
```
[Property name] — ADD to watchlist
RDO: [Tim/Jennifer/Mark]   GM: [name if known, else "GM"]   Owner: [owner]

Triggers:
- [metric]: [current] vs [threshold] for [duration]
- [next metric] (if multi-trigger)

Diagnosis:
[One paragraph — execution gap vs structural issue vs market noise. Anchor on numbers.]

30-day intervention:
[3 specific actions, each with a named owner and a date. No "review" or "monitor". Verbs: audit, replace, redesign, execute, measure.]

Exit criteria:
[Specific numerical gate. e.g., "two consecutive months at flow > 25%" or "RGI ≥ 100 for one period AND positive flow"]

Escalate if:
[The condition that promotes this from watchlist to direct intervention by COO/CEO]
```

For each EXIT:
```
[Property name] — EXIT watchlist
Met criteria: [the specific gate that was hit, with numbers]
Stays graduated unless: [re-entry trigger]
```

### Section 3 — HOLD properties — short note (1 sentence each)

For each property currently on watchlist that is recommended HOLD:
```
[Property name] — HOLD. [One sentence: status of intervention, what's being watched, when next review.]
```

### Section 4 — Escalation flags

Anything that crosses from watchlist-grade to "this is a portfolio risk now." Examples:
- Three properties under the same RDO simultaneously on watch
- Same brand family showing the same issue at multiple properties
- An owner with concentrated holdings has 2+ properties on watch
- A vacant GM role + watchlist entry on the same property

If any escalation flag triggers, name it explicitly and recommend the corporate move (RVP visit, GM replacement, brand-relationship call, etc.).

### Section 5 — Track block

End with the structured commitment block per the standard tracker pattern:

```track
{
  "watchlist": [
    { "propertyId": <id>, "reason": "...", "metric": "...", "current": "...", "exitCriteria": "..." }
  ],
  "actions": [
    { "title": "verb-led action", "owner": "name", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "decisions": [
    { "title": "...", "rationale": "...", "recommendedOwner": "...", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ]
}
```

Include only the items the COO is committing to. Don't duplicate items already in the cockpit.

---

## Hard NOT-to-do list

- Do NOT recommend a watchlist add without a clear quantitative trigger and duration. "Feels off" is not a reason.
- Do NOT recommend interventions vaguer than a verb-led action with an owner and date.
- Do NOT exit a property because "things are looking better." Exit when the gate is met.
- Do NOT spread blame in the diagnosis ("market is soft, brand is changing, GM is overwhelmed"). Pick one — lead with it.
- Do NOT exceed 4 properties on the watchlist. If 5+ trigger criteria, recommend escalation to "problem portfolio" handling, not watchlist.
- Do NOT name underperforming properties in any narrative outside the per-property block. The table is the record.

---

## Anchoring numbers Chris reviews monthly

When framing diagnoses, reference these benchmarks for tone calibration:
- Score: 100 = baseline, 130+ = strong, < 90 = trouble
- Flow-through: 50% target, 25% acceptable, < 0% = leakage
- RGI: 100 = fair share, 110+ = winning, < 95 = giving up share
- GOP margin: 30%+ at full-service, 35%+ at select-service is the line
- Labor: 26% target at select-service, 30% at full-service
- Turnover: < 80% annualized at all roles is healthy
- AR aging: < 5% over 60 days is healthy
