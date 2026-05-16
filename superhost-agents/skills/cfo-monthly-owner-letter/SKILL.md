---
name: cfo-monthly-owner-letter
description: >
  Use this skill when the CFO needs to draft an owner-facing monthly close letter — calibrated to the specific owner's profile (sophistication, format, tone, hot buttons, red flags). Trigger on: "draft the owner letter", "write the Lakhany update", "month-end owner package", "monthly NOI letter", or any request that produces an owner-bound monthly narrative. The skill produces a tight, lender-grade letter that lands in the owner's inbox already calibrated.
---

# CFO Skill — Monthly Owner Letter
## Calibrated, lender-grade, owner-by-owner

Most management companies send the same templated monthly letter to every owner. We don't. This skill drafts one letter per owner, calibrated to the owner profile loaded from the hub: sophistication level, preferred format, hot buttons, red flags, fund-life pressure, contact tone.

**Hard rule:** if no owner profile is loaded for the property/owner, produce a default lender-grade letter and explicitly note "owner profile not loaded — using lender-grade default." Do NOT fabricate owner preferences.

---

## Inputs the skill expects

Pulled automatically from hub context:
- Period (active period from config)
- Property snapshot (revenue, ADR, occupancy, RevPAR, GOP, NOI, flow, score, comp index)
- Owner profile (type, sophistication, format, cadence, hot buttons, red flags, priorities, constraints, tone, primary contact)
- Open commitments from cockpit (decisions/actions touching this owner's properties)
- Recent watchlist additions for this owner's properties

If the user provides additional context (verbal note, paste of a P&L, recent incident), use it.

---

## Voice rules

- **Lead with the result, then the cause.** First sentence states NOI vs. plan and YOY. Second sentence says why.
- **Numbers before narrative.** Every claim is backed by a number from the snapshot.
- **Bad news first, factually.** No softening. No passive voice. "Revenue ran $42K below plan" not "we faced revenue headwinds."
- **Match the owner's sophistication:**
  - **High sophistication** → flow-through, RGI, debt-yield, covenant headroom — assume they read
  - **Medium** → variance, NOI, occupancy, ADR — explain technical terms in 1 phrase if used
  - **Low** → revenue, profit, occupancy, guest scores — minimize jargon, lean on plain English
- **Honor format preference:**
  - **letter** → 4–6 short paragraphs, salutation, signed close
  - **email** → subject line + 3 short paragraphs + bullet "this month's three things"
  - **deck** → numbered sections with sub-headings, table-friendly
  - **excel** → defer to the owner-package workbook; produce a 2-paragraph cover note only
- **Honor cadence:** monthly = full close letter; quarterly = bigger picture, light on monthly noise.
- **Honor tone field verbatim** — if profile says "Direct. NOI-first. No softening of bad news," the draft mirrors that.
- **Lead with red flags if present.** If profile lists "PIP letters" or "AR > 60 days" as red flags AND any property triggered them this period, that's the FIRST paragraph, not buried.

---

## Output structure (in this exact order)

### Section 1 — Subject / Salutation
- Email format: `Subject: [Owner Name] — [Period] Close — [headline result]` (e.g., `Lakhany Group — April 2026 Close — NOI +$48K to plan`)
- Letter format: salutation to primary contact name from profile (e.g., `Sajid,`)

### Section 2 — Headline paragraph (2–3 sentences)
Ledes with NOI vs. plan and YOY. Includes RevPAR vs. plan. Names the single biggest driver of the variance. End with a one-line forward read or close.

**Reference structure:**
> "April closed at NOI $X — [direction] $X to plan, [direction] $X (X%) vs LY. RevPAR $X ([direction] $X vs budget). The variance was driven by [single specific driver]. [One forward-look sentence.]"

### Section 3 — Performance walk (3–5 sentences)
For sophistication = high, include: revenue vs plan + YOY, GOP margin movement (in pts), flow-through (if revenue variance > $10K), and the single largest cost line variance. For medium, the same minus flow-through. For low, revenue + profit + occupancy in plain English.

### Section 4 — Properties with material variance (1 paragraph)
If single-property owner, skip. If multi-property owner, name the top contributor and the largest drag. Use property names exactly as they appear in the property list. Quantify in dollars.

### Section 5 — Red flag handling (only if triggered)
If any of the owner's red-flag conditions hit this period, address directly in 2–3 sentences. State the issue, the cause, and what the company is doing. Reference any open action from the cockpit by date.

### Section 6 — Forward note (1–2 sentences)
What the next 30 days look like — booking pace, scheduled CapEx, group ceiling, brand events. Quantified where possible.

### Section 7 — Close
- Letter: `Direct line if you'd like to discuss. — Chris`
- Email: `Three things this month:` followed by a 3-bullet TLDR.

---

## Calibration matrix (apply per owner)

| Profile field | Drives |
|---|---|
| `sophistication: high` | Include flow %, RGI, covenant headroom, debt yield (if relevant) |
| `sophistication: medium` | Variance, NOI, occupancy, ADR — light on the rest |
| `sophistication: low` | Revenue, profit, occupancy — plain English only |
| `format: letter` | 4–6 paragraphs, salutation, named close |
| `format: email` | Subject line, 3 paragraphs max, "three things" bullets |
| `format: deck` | Numbered headings, table-ready, exec-summary at top |
| `format: excel` | 2-paragraph cover note, defer to workbook |
| `cadence: monthly` | Full close letter |
| `cadence: quarterly` | Quarter-flavored: 3-month roll-up tone |
| `hotButtons: [...]` | Lead the performance walk with these specifically |
| `redFlags: [...]` | Surface FIRST paragraph if any triggered this period |
| `tone: "..."` | Mirror the tone language verbatim — if it says "Direct. No softening." apply to every sentence |
| `priorities: [...]` | Forward note touches these |
| `constraints: [...]` | Avoid asking for anything that violates these (e.g., "no key money asks until 2027") |
| `primaryContact.name` | Salutation in letter format |
| `primaryContact.title` | Tone calibration cue |

---

## Hard NOT-to-do list

- Do NOT use generic openings ("We are pleased to report", "It's worth noting", "As we look ahead"). Cut them on sight.
- Do NOT use the same letter for two owners. Even if portfolios are similar, voice and emphasis differ.
- Do NOT bury bad news. If NOI missed plan, that's the lede.
- Do NOT make commitments the operations team hasn't agreed to. If you reference an action, it must exist in the cockpit's open actions for that owner's properties.
- Do NOT include forward forecasts unless explicitly requested. The letter reports results, not promises.
- Do NOT add unrequested deal teasers (e.g., "we'd like to discuss adding Property X to your portfolio") — that's a separate conversation.

---

## Output format

Return the letter as plain text, ready to copy into email or paste into a Word doc. NO markdown headings unless the format is "deck" — then use bold for section labels. Subject line at top if format is "email." Salutation at top if format is "letter."

End every output with a single line:
```
[CALIBRATION] Owner: <name> | Sophistication: <level> | Format: <format> | Profile: <loaded|default>
```
This footer is for Chris's review — strip it before sending.

---

## Reference example — Lakhany Group, April 2026 close (high-sophistication, letter format, NOI-direct tone)

> Sajid,
>
> April closed at NOI $1.18M — $48K above plan, +$92K (+8.5%) vs LY. RevPAR ran $4.20 above budget on a 1.4-pt occupancy lift, with ADR holding plan. The single largest driver was Embassy Naperville flow — 64% on +$104K revenue.
>
> GOP margin compressed 0.4 pts vs plan as utilities at Naperville ran $14K over (chiller cycling, root-cause underway). Across the three properties, A&G was favorable $7K, S&M favorable $11K, R&M in line. No covenant-related items this period.
>
> Home2 Normal continued to gain share — RGI 138.8, +1.0% vs LY. Tru Northlake remains the drag — ADR $112.40 against a $124 plan, comp set heating up. We have a rate-strategy revision in motion (see attached scorecard); next month's pace already reflects 14 days of the new floor.
>
> Forward read: May booking pace +6% YOY across the three. The chiller repair at Naperville lands May 7, no displacement expected.
>
> Direct line if you'd like to discuss.
>
> — Chris
>
> [CALIBRATION] Owner: Lakhany Group | Sophistication: high | Format: letter | Profile: loaded
