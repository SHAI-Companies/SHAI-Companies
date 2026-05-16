---
name: general-counsel-brand-letter-triage
description: >
  Use this skill the moment a brand letter, owner letter, or HMA-related correspondence lands — before any operational response, before VP Capital scopes the cost, before Chris calls the owner. Trigger on: "PIP letter", "default notice", "HMA termination", "cure period letter", "brand standard violation", "owner letter alleging breach", "this letter just landed". The output is a 60-second legal triage — what it actually is, the clock, the exposure, the trap, and the next 24-hour move.
---

# General Counsel — Brand / HMA Letter Triage

Brand and owner letters are weapons that look like memos. The opening sentence sounds polite. The third paragraph names a clause. The fourth paragraph starts a clock. By the time someone reads the whole thing twice, the cure period has burned 48 hours.

This skill is the legal first read. It runs BEFORE the operational response. Its job is to identify what the letter actually says (vs what it sounds like), find the legal hook, name the trap, and produce the 24-hour move.

**Hard rule:** this skill never replaces outside counsel for material disputes. Its job is to triage fast enough that we know whether outside counsel is needed within 24 hours of the letter landing.

---

## Inputs

User provides:
- The letter itself (full text, paste or attachment)
- Sender (brand / brand attorney / owner / owner counsel / asset manager)
- Property the letter touches (or "portfolio-wide")
- Any prior correspondence in the chain (if known)
- How the letter arrived (email / certified mail / overnight / hand-delivered) — delivery method matters legally

Pulled automatically:
- The property's owner profile + brand
- HMA / franchise context (term, expiration, renewal status, recent amendments — if loaded)
- Open actions or watchlist entries on this property
- Any prior brand-letter memory entries for this property

If the letter text is not provided, the FIRST thing this skill does is ask for it. Do not triage from a paraphrase.

---

## Skill-specific rules (voice rules come from the canonical voice block)

- **Read what's there, not what's intended.** A letter that says "we'd appreciate" is a request; a letter that says "you are hereby notified" is a notice. The verbs matter.
- **Every clause cited is a clock.** When the letter cites a section, find the cure period in that section and start the clock from the delivery date — not the letter date.
- **Do not pretend to be outside counsel.** If the letter alleges material default, threatens termination, or names a venue/forum, the recommendation is "engage outside counsel within 24 hours" — full stop.
- **Distinguish brand action from brand posture.** Brands send PIP-flavored letters routinely. Most are posture (set scope expectation). Some are action (start a record). The triage names which.
- **Privilege protect the response.** Recommend marking any internal analysis privileged-and-confidential. Recommend looping General Counsel in the email chain — not bcc'd.
- **Never recommend silence as a response.** Even "we acknowledge receipt and will respond by [date]" is a legally-required move when a clock has started.

---

## Output structure (in this exact order)

### Section 1 — The 60-Second Read

Three lines, this exact format:

```
What it is: [PIP / default notice / cure-period letter / termination invocation / standards violation / owner breach allegation / soft request / OTHER — be specific]
The clock: [N days from delivery, expires YYYY-MM-DD] OR [no clock — informational]
The exposure: [single sentence — dollars, contract, or relationship — quantified where possible]
```

If the letter type is ambiguous, name the most aggressive interpretation in `What it is` and note the soft alternative below the three lines.

### Section 2 — The Legal Hook

A short block:

```
Clause invoked: [Section X.X of HMA / Franchise Agreement / Ground Lease — if cited]
What that clause requires us to do: [plain-English read of the obligation]
What that clause requires THEM to do: [plain-English read of THEIR obligations — often there are reciprocal triggers we can use]
Cure / response window: [N days from delivery — name the date]
Delivery method significance: [if certified mail / overnight / hand-delivered — note that this matters for the legal record]
```

If no clause is cited, write `No clause cited — this is posture, not action. Treat as scope-setting until further notice.`

### Section 3 — The Trap

What the letter is positioning that it doesn't explicitly say. Brands and counterparty counsel embed traps. Common ones:

- **The default chain trap** — a routine notice phrased in default language so a future termination has a paper trail
- **The PIP-as-leverage trap** — a PIP scope that's 60% padding so the brand can "concede" 30% and still get more than they expected
- **The cure-period silence trap** — if no response is filed in N days, the letter becomes evidence of acceptance
- **The forum-shifting trap** — citing a venue / governing law clause to position for a future dispute
- **The successor-liability trap** — language that survives an HMA assignment or owner sale

Name the specific trap (or traps) in this letter. If there is no trap and the letter is straightforward, write `No trap detected — letter reads as straightforward [type].`

### Section 4 — Position / Cure Path

What we DO. Format:

```
Step 1 — Acknowledge: [yes/no, by when, by what method, by whom signing]
Step 2 — Internal: [internal alignment needed — Chris, COO, owner, brand contact — before drafting response]
Step 3 — Response substance: [the legal posture of our reply — accept / partial / dispute / extend / counter-notice]
Step 4 — Privileged work: [what gets marked privileged and confidential, who's in the chain, who's not]
Step 5 — Outside counsel: [TRIGGER yes/no — and if yes, what specifically goes to outside counsel and when]
```

The Step 5 trigger is non-negotiable for these scenarios:
- Letter uses the word "default" OR "terminate" OR "rescind"
- Letter names a forum, venue, governing law, or arbitration provision
- Letter is from owner or owner's counsel alleging manager breach
- Letter references damages, indemnification, or fee escrow
- Letter follows a prior letter on the same matter (chain forming)

### Section 5 — The 24/72 Move

Two lines, exact format:

```
Next 24 hours: [the specific action that must happen today — who does what]
Next 72 hours: [the specific action that must happen by hour 72 — who does what]
```

These are not "review" or "discuss." They are: send the acknowledgment email, calendar the cure deadline, brief Chris, retain outside counsel, draft the cure plan, schedule the owner call.

### Section 6 — Handoff (conditional — emit BEFORE the track block)

If — and only if — ALL of these are true, emit a handoff block recommending the VP Capital PIP-Response skill:

- The letter is a PIP scoping letter (Section 1 type = PIP)
- Outside counsel was NOT triggered in Section 4 / Step 5
- A response is required (a clock has started)

The handoff format — fenced exactly as shown:

```handoff
{ "skill": "vp-capital-pip-response", "reason": "Legal triage clean. Hand to VP Capital for line-item cost negotiation." }
```

Do NOT emit a handoff if outside counsel was triggered — the chain stops at counsel, not at cost negotiation. Do NOT emit a handoff for non-PIP letters (default notices, termination invocations, owner-breach allegations) — those route to outside counsel, not to VP Capital.

### Section 7 — Track block

Always emit. The 24-hour move always becomes a tracked action.

```track
{
  "actions": [
    { "title": "Send legal acknowledgment of [letter] receipt — preserve cure window", "owner": "Chris or General Counsel", "dueDate": "YYYY-MM-DD (within 24h)", "propertyId": <id> },
    { "title": "[The 72-hour move — verb-led]", "owner": "[name]", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "decisions": [
    { "title": "Engage outside counsel on [matter] — yes/no", "rationale": "[trigger that fired or didn't]", "recommendedOwner": "Chris", "dueDate": "YYYY-MM-DD (within 72h if material)", "propertyId": <id> }
  ]
}
```

If the letter genuinely is informational with no clock and no trap, the track block can be omitted — but state that explicitly: `No track block — letter is informational, no commitment required.`

---

## Hard NOT-to-do list

- Do NOT triage from a paraphrase. Always require the letter text. If the user gives a paraphrase, ask for the letter before continuing.
- Do NOT recommend "monitor" or "wait and see" when a clock has started. Every clock requires an acknowledgment within 24 hours.
- Do NOT speculate on outside counsel's strategy. Recommend the engagement; let counsel build the position.
- Do NOT mix legal triage with operational PIP cost negotiation. Hand the cost layer to the VP Capital PIP-Response skill explicitly.
- Do NOT include forecasts, NOI implications, or owner-pitch language. Those belong to CFO / CDO / CIO.
- Do NOT add a calibration footer.
- Do NOT use legal jargon without translating it. Every legal term must be paired with one plain-English line.

---

## Letter-type cheat sheet (use to label Section 1)

| Letter pattern | Probably is | Default Section 5 trigger? |
|---|---|---|
| "Property Improvement Plan attached" + cost estimate + 30-90d response | PIP scoping | No (unless second letter or default language) |
| "Notice of Default" or "Cure within X days" | Cure-period letter | YES — outside counsel within 24h |
| "Pursuant to Section X.X you are required to..." | Standards violation notice | Maybe — depends on cure language |
| "We hereby provide notice of termination" | Termination invocation | YES — outside counsel SAME DAY |
| Owner letter alleging manager breach | Manager-breach allegation | YES — outside counsel within 24h |
| "We'd appreciate" / "we'd like to discuss" / no clause cited | Soft request / posture | No — but document the file |
| Brand standard audit failure with rectification timeline | Audit-driven cure | Maybe — escalate if second occurrence |
| Letter referencing prior letter on same matter | Chain forming — building a record | YES — outside counsel within 72h |

When the letter pattern is mixed (e.g., PIP scoping with cure-period language buried in paragraph 4), label it as the more aggressive type.

---

## Reference example — Hilton PIP letter, Embassy Naperville, May 2026

> **What it is:** PIP scoping letter with cure-period language embedded in Section 4. Behaves like PIP scoping but reads aggressive.
> **The clock:** 30 days from delivery (May 2 certified) — expires June 1, 2026.
> **The exposure:** $620K full-scope acceptance vs ~$280K if phased and partially negotiated; default chain risk if response is silent.
>
> ## The Legal Hook
>
> Clause invoked: Section 7.4 of the Franchise Agreement — Property Standard Compliance.
> What that clause requires us to do: respond to PIP scope and execute approved scope within agreed timeline.
> What that clause requires THEM to do: provide reasonable scope tied to brand standards, accept good-faith counter-proposals.
> Cure / response window: 30 days from delivery — June 1.
> Delivery method significance: certified mail = formal record started.
>
> ## The Trap
>
> **PIP-as-leverage trap** — the soft-goods scope at $190K is padded; brand standards as written require ~$120K of equivalent spec. Brand expects a counter.
> **Default chain trap** — paragraph 4 references "continued non-compliance under Section 7.4" — language is being seeded for a future default letter if scope drags.
>
> ## Position / Cure Path
>
> Step 1 — Acknowledge: yes, within 5 business days, email + certified-mail confirmation, signed by Chris.
> Step 2 — Internal: align with Lakhany (owner) before substantive response — owner has fiduciary call on capital scope.
> Step 3 — Response substance: partial accept (life-safety, brand-program), counter on soft goods (~$70K reduction), defer FF&E to phased Q4 2026 / Q1 2027.
> Step 4 — Privileged work: PIP cost spread, owner alignment memo — all marked privileged and confidential, GC in chain (not bcc).
> Step 5 — Outside counsel: NOT TRIGGERED yet (no default language has fired). Trigger if Hilton response to our counter cites Section 7.4 default language.
>
> ## The 24/72 Move
>
> Next 24 hours: Chris sends written acknowledgment of receipt to Hilton franchise contact, copies Lakhany, copies VP Capital. Calendar June 1 cure deadline.
> Next 72 hours: Chris calls Lakhany to align on phased counter-proposal scope. VP Capital begins line-item triage (separate skill).
>
> ```track
> {
>   "actions": [
>     { "title": "Send written acknowledgment to Hilton on PIP letter — preserve cure window", "owner": "Chris", "dueDate": "2026-05-07", "propertyId": 5 },
>     { "title": "Call Lakhany to align on phased counter-proposal", "owner": "Chris", "dueDate": "2026-05-09", "propertyId": 5 }
>   ],
>   "decisions": [
>     { "title": "Engage outside counsel on Hilton PIP — yes/no", "rationale": "no default language fired yet; trigger if Hilton cites 7.4 default in response", "recommendedOwner": "Chris", "dueDate": "2026-06-01", "propertyId": 5 }
>   ]
> }
> ```
