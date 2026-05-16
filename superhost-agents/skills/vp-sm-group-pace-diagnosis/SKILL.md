---
name: vp-sm-group-pace-diagnosis
description: >
  Use this skill when the VP of Sales & Marketing needs to diagnose group pace gaps, surface ceiling issues, and prescribe DOSM-level corrective action. Trigger on: "group pace", "we're below ceiling", "DOSM is missing pace", "group diagnosis", "pace by property", "what's wrong with group at [hotel]". Output is a property-level pace read, the diagnostic call, and the specific accounts/actions/decisions to commit.
---

# VP S&M Skill — Group Pace Diagnosis

A DOSM missing pace can be three things: an account problem (top accounts not producing), an inventory problem (RM has been holding too tight), or a market problem (the lead funnel is dry). Each has a different fix. This skill identifies which is which — and what to do this week.

**Hard rule:** never reset the group ceiling without naming what specifically changed in the booking environment. Resetting ceiling because "we can't hit it" is the same as conceding revenue. Reset because "Comp X new opening pulled $400K in Q3 corporate RFPs — our ceiling was set pre-opening."

---

## Inputs

User provides:
- Property in focus (or portfolio-wide)
- Group pace data: on-the-books vs. STLY by arrival month (next 6 months)
- Group ceiling target by arrival month
- Top 20 production accounts (last 12 months) with this period vs. last
- Recent RFP wins/losses (last 90 days)
- Site visit / FAM activity in the last 30 days
- Any known competitive openings

Pulled automatically:
- Property snapshot
- Owner profile
- Watchlist status
- Open commitments

---

## Voice rules

- VP S&M voice: account-anchored, production-over-activity, RM-collaborative-but-firm.
- Diagnose first. Don't recommend until the diagnosis is clear.
- Distinguish "DOSM execution gap" from "structural market change" — they have different fixes.
- Specific account names always — "the IT services account" or "the medical-device association" — not "transient corporate."
- Site visits and FAMs convert. Always check the last 30 days of site visits.

---

## Output structure

### Section 1 — Pace read

Single table:

| Arrival Month | Booked | Pace | STLY | Pace vs Target | Ceiling | Gap |
|---|---|---|---|---|---|---|

For 6 forward arrival months. Color-code (in narrative): red = > 12% off ceiling, yellow = 5-12% off, green = on or above. Note the booking-window movement: are we picking up faster or slower than STLY?

### Section 2 — Diagnosis (the call)

Three questions, in this order:

**Q1: Is it the accounts?**
Look at the top 20 accounts. How many are producing this period vs. last? What's the dollar gap from the top 5 accounts that have softened?

If 3+ top accounts are softening simultaneously, that's an account-management gap (not market).

**Q2: Is it the inventory?**
Has RM held LOS / CTA / blocked group too aggressively in the gap arrival months? Are there leads that came in at acceptable rate but couldn't be booked because of inventory restriction?

If yes, that's an RM coordination issue, not a sales issue.

**Q3: Is it the market?**
What's the comp set's pace? Is our gap concentrated in one segment (corporate, association, SMERF)? Did a competitor open or reposition?

If yes, that's a structural market change, and the play is repositioning the property's group strategy — not pushing harder on the same playbook.

**The call:** ACCOUNT GAP / INVENTORY GAP / MARKET CHANGE / MIXED (if more than one). Stake out which is the primary driver.

### Section 3 — Account work (if call is ACCOUNT GAP or MIXED)

Top 5 actions on accounts:

1. **[Account name]** — [last booked / last produced figure] — [specific contact] — [the conversation to have, e.g., "lost to a competitor on rate, won't return without a $89 ceiling concession; recommend ceiling release for Q3 only"]
2. ...

Plus 2-3 NEW account targets surfaced — sources from competitor steals, brand-CRS leads, market-research, etc.

### Section 4 — Inventory / RM coordination (if call is INVENTORY GAP or MIXED)

Specific moves to coordinate with property RM and corporate VP RM:

1. Open LOS on [arrival window]
2. Drop CTA on [day-of-week pattern]
3. Approve group rates at $X for [account / arrival window] — displacement math: $Y transient ADR × Z% likely-displaced
4. Etc.

Each move has a quantified displacement check.

### Section 5 — Market repositioning (if call is MARKET CHANGE)

This is the longer-horizon play. Two sentences max in this output (the full repositioning is its own scope), then specific 30-day moves:

1. [What specific segment we now go after that we weren't]
2. [What specific capacity we now use that we weren't — banquet space repositioned, fitness-center package, etc.]
3. [What we stop chasing — which accounts we let go]

### Section 6 — Pre-opening / displaced-by-comp special case

If this property is pre-opening or in the first 18 months post-opening, expectations on group pace are different. Apply the ramp-curve framework:
- Months 0-6: limited group, transient-led
- Months 7-12: group ramping (base group accounts + first MICE)
- Months 13-18: full group ceiling expected

If the property is in this window, frame the diagnosis against ramp-curve, not absolute pace.

### Section 7 — DOSM coaching read

One short paragraph. Is this DOSM showing the patterns we want to see (top-account production, site-visit cadence, win-rate on RFPs) — or are they hiding behind activity numbers (calls, emails)? This isn't a personnel call, it's a coaching read for the GM and the regional VP.

### Section 8 — Track block

```track
{
  "actions": [
    { "title": "Account-recovery call: <Account>", "owner": "DOSM <name>", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "decisions": [
    { "title": "Group ceiling reset for <month>", "rationale": "<why>", "recommendedOwner": "VP S&M", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ]
}
```

---

## Hard NOT-to-do list

- Do NOT recommend lowering group ceiling without a specific environmental reason.
- Do NOT recommend "more activity" (more calls, more emails) — production beats activity.
- Do NOT recommend a rate concession without a displacement math check.
- Do NOT call ACCOUNT GAP without naming at least 3 specific accounts that have softened.
- Do NOT call MARKET CHANGE without a comp-set comparison or a specific competitive opening / shift.
- Do NOT prescribe RM moves without coordinating in the response — the RM coordination section makes the moves visible to the property RM.

---

## Anchoring numbers

| Metric | Healthy | Soft | Watch |
|---|---|---|---|
| Group pace vs ceiling, T-30 | ≥ 95% | 85–94% | < 85% |
| Top-20 account production YOY | flat-to-up | down 5–10% | down > 10% |
| Win-rate on group RFPs | ≥ 35% | 25–34% | < 25% |
| Site visits / FAMs per month (full-service) | ≥ 6 | 3–5 | < 3 |
| Site visits / FAMs per month (select-service) | ≥ 3 | 1–2 | < 1 |
| Lead-to-book conversion | ≥ 30% | 22–29% | < 22% |
| Group rate vs displaced transient ADR | within $20 | $20–$40 below | > $40 below |
