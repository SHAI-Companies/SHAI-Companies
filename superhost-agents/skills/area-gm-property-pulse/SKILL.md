---
name: area-gm-property-pulse
description: >
  Use this skill on a per-property basis Tuesday-Thursday to prep Chris for his weekly GM call or site visit. Trigger on: "pulse [property]", "prep me for the [property] call", "weekly brief on [property]", "what do I push the GM on at [property]". The output is a one-page property brief — numbers, top 3 risks, top 3 wins, owner watch, the 5 questions that force specificity, and the ask Chris walks out of the call with.
---

# Area GM — Weekly Property Pulse

Chris's job between Monday's portfolio digest and Friday's wrap is to push every property's GM on the things only Chris pushes on. This skill produces the per-property brief he reads in the 10 minutes before each call. One property per run.

**Hard rule:** the brief is not a status report. It's a prep document. Every section converts to a question, a push, or a decision. If a section reads informational, rewrite it as a move.

---

## Inputs (pulled automatically from the portfolio snapshot)

- The selected property's KPIs for the active period (revenue, ADR, occ, RevPAR, GOP, NOI, flow, score)
- Property vs budget vs LY (variance in dollars and points)
- STR / comp set position (RGI, ARI, MPI) if available
- Owner profile for this property (owner name, sophistication, hot buttons, red flags, recent concerns)
- Open actions and decisions tagged to this property
- Watchlist status for this property (active / not on watch)
- Persona memory entries scoped to this property — what other executives have already concluded about this hotel
- Recent owner notes (`data.notes[<id>]`)

If the user provides additional context (a specific incident, a recent owner email, a brand letter), surface it in Section 5.

---

## Skill-specific rules (voice rules come from the canonical voice block)

- **One property per run.** This skill never produces a multi-property brief. If asked, ask which property first.
- **Every risk is quantified.** "Occupancy could soften" is not a risk. "Midweek corporate down 12% vs pace, $X RevPAR exposure if trend holds" is a risk.
- **Top 3 wins must be replicable.** A win that only works at this property doesn't help the cluster. Name what the cluster could borrow.
- **Owner watch is mandatory.** Even if the answer is "nothing this week" — say it explicitly. Silence on the owner is the most expensive miss.
- **The 5 questions force specificity.** They are not Socratic discussion prompts. They are designed to break the GM's narrative if it conflicts with the numbers.
- **The Ask is one sentence, one commitment.** What does the GM commit to before next call. Not three things. One thing.

---

## Output structure (in this exact order)

### Section 1 — The Lede

One sentence. Format:

```
[Property] — [Score N/200, rank N of 17] — [single sentence: NOI/RevPAR vs plan + biggest single driver of variance]
```

If the property is on the watchlist, say so in the lede. If a brand QA, owner letter, or PIP is in flight, name it in the lede.

### Section 2 — Numbers Snapshot

A tight markdown table — 6 rows max:

| Metric | Actual | Budget | LY | Var $ / pts |

Required rows: Revenue, RevPAR, Occ, ADR, GOP%, Flow%. Add Labor% only if it is the largest variance.

Below the table: one line each for STR/comp set position (RGI / ARI / MPI), and one line for forecast credibility (drift % vs Day-1 lock if available).

### Section 3 — Top 3 Risks (next 30-60 days)

Three risks. Each formatted as:

```
1. [RISK HEADLINE — 6-12 words]
   What it costs: [dollar exposure if it materializes — $X RevPAR / $X NOI / $X PIP / etc.]
   What I'd ask the GM: [one specific question — not "what are you doing about it"]
```

Selection logic — pick risks that meet ALL of:
- Quantifiable in dollars or pts within 60 days
- Within the GM's control or escalation reach
- Not already being actively worked (look at open actions — if a risk is already an open action, skip it)

### Section 4 — Top 3 Wins (replicable)

Three wins. Each formatted as:

```
1. [WIN HEADLINE — what's working]
   The number: [the metric proving it works]
   Cluster borrow: [how Chris would push another GM in the cluster to copy it]
```

If you can't find three real wins, write only what's there and add one line: `Only N wins worth replicating this period — coach to find more.`

### Section 5 — Owner Watch

Format:

```
Owner: [name] — [sophistication tier] — [last touchpoint date if known]
Hot buttons triggered this period: [yes/no — and which]
Red flags triggered this period: [yes/no — and which]
What I owe the owner: [explicit answer — letter, call, decision, or "nothing this week"]
```

If the owner has flagged a concern in the last 30 days that's still unresolved, that goes here as a single line.

### Section 6 — The 5 Questions

Five questions Chris asks the GM. Each must:
- Reference a specific number from the snapshot
- Force a specific answer (not "tell me more about X")
- Land within the first 20 minutes of the call

Format:

```
1. [Question — should be one sentence, force a number]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
```

The fifth question is always a forward-looking commitment question — "what will be different by next call."

### Section 7 — The Ask

One sentence. The single commitment Chris wants the GM to make, with a date.

Format:

```
The Ask: [GM name or "the GM"] commits to [specific verb-led action with a number] by [date].
```

### Section 8 — Track block

Only emit if the prep itself is recommending something to be tracked that isn't already in the cockpit. The Ask in Section 7 should always become a tracked action.

```track
{
  "actions": [
    { "title": "[mirror Section 7 — verb-led]", "owner": "[GM name or role]", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "watchlist": [
    { "propertyId": <id>, "reason": "...", "metric": "...", "current": "...", "exitCriteria": "..." }
  ]
}
```

Include a watchlist add only if a Section 3 risk crosses the COO threshold (score < 90 for 2 periods, flow < 0 for 2 months, RGI < 95 for 3 periods, etc.). If the property is already on watch, do not re-add.

---

## Hard NOT-to-do list

- Do NOT exceed the section structure.
- Do NOT cover more than one property per run.
- Do NOT include a forecast or quarterly outlook — this is a 7-14 day prep document.
- Do NOT rewrite the GM's narrative for them — produce the questions that test it.
- Do NOT include guest-experience or brand-audit detail unless it's a Section 3 risk.
- Do NOT name the GM in a negative narrative paragraph. The Ask is the only place a GM commitment lives.
- Do NOT include a calibration footer. This is internal prep.

---

## Ordering for the cluster — which property to pulse first

When Chris asks "what's the cluster look like this week" without naming a property, default order:
1. Any property on the watchlist
2. Any property with score < 90 OR flow < 0 OR RGI < 95
3. Any property with an unresolved owner concern logged in the last 30 days
4. Any property with a brand QA, PIP letter, or contract event within 30 days
5. The lowest-NOI variance property in the cluster

Produce one full pulse for the highest-priority property and offer the next two as one-line ledes only.

---

## Reference example — Embassy Naperville, May 6 2026 prep

> **Embassy Naperville** — Score 87/200, rank 14 of 17 — NOI -$74K MTD vs plan, driven by $11.60 ADR shortfall on 28-day pace. Watchlist: ACTIVE.
>
> | Metric | Actual | Budget | LY | Var |
> |---|---|---|---|---|
> | Revenue | $1.04M | $1.11M | $968K | -$70K |
> | RevPAR | $112.40 | $124.00 | $108.20 | -$11.60 |
> | Occ | 71.2% | 74.0% | 70.8% | -2.8 pts |
> | ADR | $157.85 | $167.50 | $152.85 | -$9.65 |
> | GOP% | 28.4% | 31.2% | 30.1% | -2.8 pts |
> | Flow% | -38% | n/a | 41% | leakage |
>
> STR: RGI 94.2 (ARI 96.1 / MPI 98.0) — giving up rate share. Forecast credibility: GOP drift -8.4% vs Day-1 lock.
>
> ## Top 3 Risks
>
> 1. **RATE INTEGRITY EROSION — RGI 94 AND TRENDING**
>    What it costs: $14-18 RevPAR if RGI doesn't recover by July, ~$120K NOI exposure Q3.
>    What I'd ask the GM: Why is BAR floor sitting $8 below the comp median for Tuesday-Thursday?
>
> 2. **HILTON PIP RESPONSE DEADLINE MAY 20**
>    What it costs: $620K full-scope acceptance vs $280K phased — call hasn't been made.
>    What I'd ask the GM: What's your read on Lakhany's appetite for the phased proposal?
>
> 3. **CHILLER FAILURE RECURRENCE RISK — UTILITIES +$14K MTD**
>    What it costs: $8-12K/month if the May 7 repair doesn't hold.
>    What I'd ask the GM: What's the engineer's plan if it fails again before July?
>
> ## Top 3 Wins
>
> 1. **F&B FLOW HOLDING — 64% ON +$104K REVENUE**
>    The number: $104K F&B revenue beat at 64% flow.
>    Cluster borrow: Naperville banquet booking process — push to the two other Embassy properties.
>
> 2. **GROUP PACE Q3 +6% YOY**
>    The number: 14 days of new floor visible in pace.
>    Cluster borrow: The new group rate floor — propose to Tim for the cluster.
>
> 3. **GSS HELD AT 4.6 DESPITE THE CHILLER NOISE**
>    The number: GSS unchanged period-over-period.
>    Cluster borrow: Recovery script the front desk used — share with Tru Northlake.
>
> ## Owner Watch
>
> Owner: Lakhany Group — high sophistication — last touchpoint April 28 (close letter)
> Hot buttons triggered this period: YES — flow margin compression
> Red flags triggered this period: YES — PIP letter in flight
> What I owe the owner: Tuesday call before Hilton follow-up Thursday.
>
> ## The 5 Questions
>
> 1. Walk me through the Tuesday-Thursday rate decision tree — what triggered the $8 BAR drop?
> 2. What did your DOSM commit to on the Q3 group cutoff conflict with Nate?
> 3. The chiller — if the May 7 repair doesn't hold, what's the displacement plan?
> 4. Of the $14K utility miss this month, how much is chiller vs everything else?
> 5. By next Tuesday's call, what number will look different and by how much?
>
> ## The Ask
>
> The GM commits to a written rate-floor revision by Friday May 9 targeting RGI 100 by July 1.
>
> ```track
> {
>   "actions": [
>     { "title": "Submit written rate-floor revision targeting RGI 100 by July 1", "owner": "GM Embassy Naperville", "dueDate": "2026-05-09", "propertyId": 5 }
>   ]
> }
> ```
