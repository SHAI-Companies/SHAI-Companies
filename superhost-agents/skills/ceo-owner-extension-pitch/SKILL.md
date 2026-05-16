---
name: ceo-owner-extension-pitch
description: >
  Use this skill when the CEO is preparing for a contract-extension conversation with an existing owner. Trigger on: "build the Lakhany extension pitch", "prep for the renewal conversation", "owner extension brief", "extend their contract", or any request to prepare the case for keeping (and ideally growing) an existing owner relationship. Output is a tight, owner-specific brief Chris uses to walk into the meeting prepared.
---

# CEO Skill — Owner Extension Pitch

A management contract is a 5-year asset. Losing one is not "we're sorry to see you go" — it's a 7-figure event. This skill produces the brief Chris walks into the renewal conversation with: what we've delivered, why we keep delivering, what we'd ask for in the next term, and what we'd concede.

**Hard rule:** never pitch on price. We don't compete on base fee. We compete on what we've actually done for this owner over the term we just finished. The brief leads with results, not promises.

---

## Inputs

Pulled automatically:
- Owner profile (full record, including hot buttons, red flags, fund-life, priorities, constraints)
- All properties in the owner's portfolio (current + comingSoon)
- Period snapshot for each property
- Decision log entries with `propertyId` matching this owner's portfolio (last 12 months)
- Action log entries (closed) for this owner's properties (last 12 months)
- Open scan synthesis if this owner appeared in any recent scan

If the user provides additional context (current contract terms, what the owner has signaled, competitive threats), apply it.

---

## Voice rules

- CEO voice: opinionated, owner-as-customer lens, lead with the result.
- No hedging language. No "we believe" or "we feel." Either we did the work or we didn't.
- Speak in dollars, not percentages-only. Owners track dollars.
- Always quantify what we've delivered vs. what they'd have done with another operator. Net them out.
- Anchor on the moments that mattered, not the average month.
- Match the owner's sophistication and tone (from profile) — calibrate.

---

## Output structure (single brief, ~600–900 words)

### Section 1 — Frame
One paragraph. The owner, the portfolio (count, brand mix, geography, total managed revenue), the term we just finished (or are finishing), and the moment we're in. End with the central question: "Why extend, and on what terms."

### Section 2 — What we delivered (the proof)
Anchor on 3–5 specific results from the term. NOT a generic recap. Each one names a number and an action.

For each:
- **Result:** the dollar or % outcome (e.g., "+$420K cumulative NOI vs. portfolio underwriting")
- **What we did:** the specific intervention (e.g., "RM strategy reset at Embassy Naperville Q2 2025, +$8 ADR")
- **Why it stuck:** what made the gain durable, not one-time

If the owner profile lists "hotButtons," at least 2 of the proof points should map to those buttons explicitly.

### Section 3 — Where we struggled (own it)
1–2 sentences. The thing that didn't go right this term — said directly, not glossed. Owner respects the operator who owns failure. Then the one-line lesson.

### Section 4 — The next term — what we're committing to
3 specific commitments. Each has:
- **Target:** measurable outcome with a number and a date
- **The lever:** what we'll do differently
- **Risk:** what could prevent it (named explicitly so we don't pretend it's risk-free)

If the owner profile lists "priorities," each commitment should map to a priority.

### Section 5 — What we're asking for
The contract-term ask. Be specific:
- Term length (preferred 5 years; minimum 3)
- Fee structure (base + incentive — name what the incentive thresholds are)
- Termination protection (cure period, performance test specifics)
- Reimbursable scope (what we want covered)
- Brand/PIP cooperation (if applicable)

If the owner profile has "constraints" (e.g., "no key money asks until 2027"), respect them — don't ask for what's blocked.

### Section 6 — What we'd concede
What we'd give up to win the extension. Identify 2–3 concessions in priority order. Each one:
- **What:** the concession
- **What we get back:** what's the price for them giving us this term
- **Walk-away:** the line below which we don't extend

This is the negotiation playbook. If we don't pre-decide what we'd concede, we'll concede everything in the room.

### Section 7 — How they'd be sold by a competitor
1 paragraph. Aimbridge / Highgate / Crestline / HEI or a regional operator — who's likely the alternative bid, and what's their pitch? What do they have that we don't? What do WE have that they don't? Specific.

### Section 8 — The ask, one sentence
The single sentence Chris says in the room when the conversation arrives at the question. Direct. No hedging.

### Section 9 — Talking points if pushed
A short bulleted list — 4–6 items — for when the owner pushes back on a term. Each is a 1–2 sentence response.

### Section 10 — Track block

```track
{
  "decisions": [
    { "title": "Extension term sheet — [Owner]", "rationale": "Recommended terms for next 3-5 yr extension", "recommendedOwner": "Chris Chatfield", "dueDate": "YYYY-MM-DD", "propertyId": null }
  ],
  "actions": [
    { "title": "Schedule extension meeting with [primary contact]", "owner": "Chris Chatfield", "dueDate": "YYYY-MM-DD" }
  ]
}
```

---

## Hard NOT-to-do list

- Do NOT pitch on base fee. We never compete on price.
- Do NOT lead with the future — lead with what we already did.
- Do NOT make commitments that operations hasn't agreed to. If a commitment shows up here, the COO must be able to say "yes, I can do that."
- Do NOT ask for things blocked by the owner's stated constraints (key money, fund-life, etc.).
- Do NOT include generic management-company boilerplate ("our values," "our commitment to excellence"). Cut on sight.
- Do NOT ignore the failure — owning the one thing that didn't work is what makes the rest of the brief credible.

---

## Reference example — Lakhany Group, end of Term 1 (2022–2026)

> ## Lakhany Group — Extension Brief
>
> Lakhany has been with us since 2022. Three Hilton-flagged hotels — Embassy Naperville, Home2 Normal, Tru Northlake. Combined managed revenue $14.8M in 2025. Sajid is the decision-maker; he reads the numbers. Term 1 closes June 2026. The question is whether we extend, and on what terms.
>
> **What we delivered**
> - **+$1.04M cumulative NOI vs. underwriting.** Embassy Naperville is the engine: from $2.1M NOI in '22 to $3.4M run-rate in '25. The driver was RM — we reset the BAR strategy in Q2 '23 (compressed midweek, premium leisure weekends) and held the discipline through 2025. RGI 229 in April.
> - **Reduced labor 4.2 pts at Home2 Normal in 2024.** PEO scheduling rules audit — 8 weeks of work, sticky savings.
> - **Held Tru Northlake through brand-PIP turbulence in 2024.** $640K PIP scoped down from $1.2M opening ask. Didn't cost Sajid his cash flow that year.
>
> **Where we struggled**
> Tru Northlake's RGI hasn't recovered from the brand-cohort softness. We owned the RM, but not the surrounding comp set; new Marriott opened down the road in late '24 and we didn't pre-empt fast enough.
>
> **Next term — what we're committing to**
> 1. **Embassy Naperville: NOI floor $3.5M annually.** Lever: hold RM discipline, exec-chef hire to anchor F&B. Risk: chiller is at end of life — capital plan landing this summer.
> 2. **Tru Northlake: RGI ≥ 100 by Q2 2027.** Lever: full RM reset + targeted GM coaching. Risk: if comp set keeps adding rooms, we hit the ceiling regardless.
> 3. **Reduce portfolio AR aging > 60 days from 7% to < 4% within 2 quarters.** Lever: collections process redesign + auto-escalation.
>
> **What we're asking for**
> - 5-year extension, June 2026 → June 2031
> - Base fee at current 3.0%; incentive at 12% of NOI above threshold ($3.0M Embassy, $750K Home2 Normal, $400K Tru Northlake)
> - Termination-without-cause cure period extended from 60 to 90 days
> - Reimbursable scope: add cybersecurity tooling and BI license cost
> - No PIP-cooperation language change requested
>
> **What we'd concede**
> 1. Move from full reimbursable on the new BI tool to 50/50 split if pushed (we get: 5-yr commitment instead of 3)
> 2. Drop the AR-aging commitment if challenged on attribution (we get: hold incentive thresholds at proposed level)
> 3. **Walk-away:** any base-fee reduction below 2.5%, or any single-year termination-for-convenience clause
>
> **Competitive read**
> Aimbridge would pitch on scale and brand-relationship leverage. Highgate would pitch on value-add asset management. Neither has Sajid's three properties under direct senior attention the way we do. Sajid's hot button is NOI predictability — that's our shot.
>
> **The ask**
> "Sajid — five years. Same fee structure. Two added items in reimbursable. We've delivered what we said we would; we want the runway to lock in the next thesis."
>
> **If pushed on…**
> - **Fee:** "Show me an operator who got you to $3.4M NOI at Embassy and we'll talk."
> - **Term length:** "Three years undercuts the strategic moves we just outlined — chiller capital, F&B reposition, AR redesign — those need a 5-year horizon to land."
> - **Reimbursable expansion:** "BI cost is $14K/year; the analytics it produces saved you $80K in '25. Do the math."
> - **Termination:** "We've never been the operator that fights an exit. We're the one that gives you a 90-day clean handoff."
