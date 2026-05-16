---
name: vp-capital-pip-response
description: >
  Use this skill when the VP of Capital Projects needs to respond to a brand-issued PIP (Property Improvement Plan) letter. Trigger on: "PIP letter", "respond to PIP", "scope down the PIP", "negotiate PIP", "PIP at [property]", "PIP cost". Output is the structured negotiation response — what to accept, what to push back, what to defer, the cost spread, and the owner-facing brief explaining the position.
---

# VP Capital Skill — PIP Response

A brand PIP letter is the start of a negotiation, not the end. Brands open with the maximum scope — they expect the operator to push back on 30-60% of it. The job here is to triage every line item into Accept / Negotiate / Reject with a quantified cost spread and a defensible reason for each push-back.

**Hard rule:** never accept the full PIP at face value. Even when total cost looks reasonable, brands include items that are nice-to-have for them and obvious-no for the owner. Sort every line item.

---

## Inputs

User provides:
- The PIP letter (or a structured list of line items, scoped by area: rooms / public space / exterior / FF&E / soft goods / case goods / mechanical / brand-standard updates)
- Property information (brand, brand age cohort, last reno date, owner, PIP context — opening, mid-cycle, conversion, end-of-term)
- The brand's stated cost estimate per line (if given) and any deadlines
- Recent comparable PIPs we've negotiated (if known)

Pulled automatically:
- Property snapshot (revenue, NOI to assess capital-coverage capacity)
- Owner profile (constraints — e.g., "no key money asks", fund-life pressure, capital appetite)
- Open commitments

---

## Voice rules

- VP Capital voice: brand-respectful but firm, owner-fiduciary-first, technical-credible-on-scope.
- Never adversarial. We need the flag. But we don't sign a blank check for the brand.
- Quantify every push-back: "this line at $X drives Y% of total scope and is rejected because [reason]."
- Distinguish life-safety / code (non-negotiable) from brand-aesthetic (often negotiable) from brand-program (sometimes negotiable on timeline).
- Always frame to owner in NOI / IRR terms — "this $X PIP at $Y additional NOI yields a Z-year payback."

---

## Output structure

### Section 1 — Headline

One paragraph. Property, brand, PIP type (mid-cycle / end-of-term / conversion), brand's opening cost, our recommended scope, our recommended cost, the gap. End with a one-line owner read.

### Section 2 — Line-item triage table

Every line item gets one of three calls:

| # | Item | Brand $ | Our $ | Call | Why |
|---|---|---|---|---|---|

Calls:
- **ACCEPT** — life-safety, code, brand-program-required, owner-irrelevant push-back
- **NEGOTIATE** — scope-reduce, defer-timing, alternate-spec, partial-completion
- **REJECT** — out of standard scope, doesn't apply to this property, replicates recent investment

Show the dollar gap explicitly between Brand $ and Our $.

### Section 3 — Per-NEGOTIATE block (one per item being negotiated)

For each:

```
[Item #] — [item name]
Brand asks: $X
We propose: $Y
Save: $Z

Argument:
[2-3 sentences. The technical / scope reason. References brand standard if helpful.]

Risk if we lose this push-back:
[What happens if brand insists. Are they likely to actually enforce? Is there precedent?]
```

### Section 4 — Per-REJECT block (one per item being rejected)

For each:

```
[Item #] — [item name]
Brand asks: $X
We propose: $0 (rejection)

Argument:
[Why this isn't applicable here. e.g., "Recent FF&E refresh in 2024 — already meets target spec; brand template was applied without site visit."]

Likely outcome:
[Will brand insist? Often these get withdrawn on push-back if argument is solid.]
```

### Section 5 — Phasing recommendation

Brand-prescribed timing assumes one execution window. We almost always want phased:
- **Phase 1 (must-do, 0-12 months):** life safety, code, items where brand will actually enforce
- **Phase 2 (12-24 months):** brand-program items with reasonable timeline flex
- **Phase 3 (24-36 months):** aesthetic items, soft-goods refresh, optional brand-program

For each phase: total cost, peak-displacement room-night impact, peak monthly cash impact for owner.

### Section 6 — Owner financial brief

The owner doesn't read PIP letters. They read the dollars. Build:

- **Brand's full ask:** $X over Y months (peak monthly $Z)
- **Our recommended response:** $X' over Y' months (peak monthly $Z')
- **Savings vs brand ask:** $D
- **Funding source:** FF&E reserve covers $A; owner CapEx draw needs $B
- **NOI impact during execution:** estimated $C (displacement + acquisition cost)
- **Post-PIP NOI lift expected:** $E (refreshed product → ADR opportunity)
- **Payback period:** F years

If owner profile constraint says "no key money asks until 2027" or similar, flag if any required scope conflicts with that constraint.

### Section 7 — Brand response strategy

How we'd respond to the brand. Three sentences max:
1. The thank-you / acknowledgment opener
2. The framing of our position (cooperative but disciplined)
3. The ask (timeline for negotiation, who drives it on our side, who drives it on theirs)

Plus a short list of the items we expect them to dig in on (fight-worthy) vs. items they'll likely concede on first push-back.

### Section 8 — Track block

```track
{
  "decisions": [
    { "title": "PIP response position: <property>", "rationale": "Recommended scope $X vs brand ask $Y", "recommendedOwner": "VP Capital", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "actions": [
    { "title": "Brand-rep response call on PIP — <property>", "owner": "VP Capital", "dueDate": "YYYY-MM-DD", "propertyId": <id> },
    { "title": "Owner financial brief on PIP — <Owner>", "owner": "Chris", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ]
}
```

---

## Hard NOT-to-do list

- Do NOT accept a full PIP at face value. There's always negotiation room.
- Do NOT reject life-safety, ADA, code, or brand-program-required items. Those are non-negotiable.
- Do NOT recommend phased delivery without naming the brand's likely response to each phasing argument. Some brands accept phasing readily; others don't.
- Do NOT respond to the brand without a documented owner conversation first. The owner must agree to the position before we send anything.
- Do NOT inflate post-PIP NOI lift to make payback look better. Use defensible assumptions — refreshed-product ADR lift is typically $4-12 depending on segment.
- Do NOT include items in the response that you couldn't defend in a face-to-face brand meeting.

---

## Anchoring numbers — typical PIP outcomes

| Metric | Typical range |
|---|---|
| Brand opening ask vs. final agreed scope | 30-60% reduction common |
| Phasing duration | Mid-cycle: 12-18 mo · End-of-term: 24-36 mo |
| FF&E reserve coverage of total PIP | 40-70% (rest is owner CapEx) |
| Displacement during full-execution PIP (rooms) | 15-35 nights peak |
| ADR lift post-mid-cycle PIP | $3-8 |
| ADR lift post-end-of-term reno | $8-18 |
| Payback period (operator estimate) | 3-7 years |
| % of PIP scope that is "fight-worthy" | 20-35% (where push-back is likely to succeed) |
