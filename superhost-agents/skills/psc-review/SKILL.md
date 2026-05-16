---
name: psc-review
description: Use this skill whenever Chris is preparing for, running, or following up on a Performance Scorecard (PSC) review call with a GM, RDO, or property leader. Trigger on any mention of PSC review, scorecard call, monthly review, GM accountability call, Tim's call, Jennifer's call, Mark's call, RDO call, property review, or any request to analyze a Superhost scorecard PDF and prepare for a conversation about it. Also trigger when uploading a scorecard for any of the 17 active properties (Home2, Hampton, Holiday Inn Express, Comfort Inn, Tru, Avid, etc.). This skill produces the full review package — high-level analysis, lead questions tailored to the property's variance, GM response standards, and a print-ready one-page call sheet — using the Superhost voice (direct, NOI-first, no corporate filler). Built for portfolio scale: same discipline, every property, every month.
---

# PSC Review System

A complete monthly Performance Scorecard review system for Superhost Hospitality property reviews. Turns the PSC card into a structured call with diagnostic questions, answer standards, and an action exit.

## When to Use

Use this skill whenever Chris is:
- Preparing for a monthly review call with any property GM
- Running a PSC review on the call itself (referencing materials live)
- Building call materials for an RDO to use with their properties
- Analyzing a scorecard PDF that's been uploaded
- Building a coaching plan for a struggling GM
- Capturing post-call action items in a structured format

## Core Principle

The Performance Scorecard is the measurement. The call structure is the accountability. Without a framework, monthly reviews drift — GMs talk, executives listen, and decisions don't get made. This skill fixes that.

**Three operating rules:**
1. **NOI is the lens.** Top-line is interesting. Flow-through and GOP are what we manage to.
2. **Forecast credibility is non-negotiable.** Every forecast is a commitment. Variance pattern reveals discipline.
3. **Every call ends with action.** Owner. Date. Dollar impact. No exceptions.

## The 6-Step Call Structure

Every PSC review follows the same 25-30 minute structure:

| # | Step | Time | What Happens |
|---|------|------|--------------|
| 1 | Score + Headline | 0:30 | One-sentence headline that sets the tone |
| 2 | The Win | 2:00 | What's working. Capture playbook. |
| 3 | The Gap | 5:00 | Where score is dragged. Quantify in dollars. |
| 4 | Forecast Credibility | 5:00 | Pattern check: sandbagging, optimistic, accurate? |
| 5 | Targeted Questions | 10:00 | 3-5 specific, data-driven questions |
| 6 | Action Items | 5:00 | Commitments captured. Owner. Date. $ impact. |

## How to Run a Review

When Chris uploads a scorecard PDF or describes a property's monthly performance:

### Step 1: Read and Diagnose

Extract from the scorecard:
- **Score and tier** (Excellent ≥150, On Track 120-149, Watch 90-119, At Risk 60-89, Needs Action <60)
- **Financial variance** (Total Revenue, Occupancy, ADR, RevPAR, RevPAR Index, GOP, GOP Margin, Flow-Through)
- **Forecast accuracy** (forecast vs. actual GOP — both monthly and YTD)
- **GSAT/Quality** (Brand Score, Google Score, QA/BSA pass)
- **Associate** (AOS, Retention/Turnover)
- **Forward forecast** (next month, two months out, full quarter)

### Step 2: Identify the Story

Every property's scorecard tells a story. Find it:
- Is the GOP beat earned through flow or timing?
- Is the revenue beat rate-driven or occupancy-driven? (Different flow implications.)
- Is the index winning while we lose absolute dollars, or vice versa?
- Is the forecast pattern consistent with the variance?
- Where is the cleanest line, and what's the playbook?
- Where is the messiest line, and what's the dollar impact?

Reference: `reference/diagnostic_framework.md`

### Step 3: Generate the High-Level Analysis

Produce a concise, NOI-first analysis using Chris's voice:
- **Headline** — one sentence that lands
- **What's Actually Happening** — 3-4 short paragraphs separating YTD from current month, top-line from bottom-line, real wins from timing wins
- **What I'd Ask the GM** — 5 specific questions tied to the variance
- **What's Green / Watch / Red** — quick visual sort

Voice rules: direct, short sentences that land, plain problem-naming, no corporate filler, quantify everything in dollars.

### Step 4: Build the Call Sheet (One-Page Print-Ready)

Generate a Word doc with:
- Property header with score and trend
- At-a-glance key numbers bar (6 metrics)
- Lead with these five (priority questions, highlighted)
- Backup questions if time permits (8-10 by category)
- Action capture box (3 blank rows: # / Action / Owner / Due / $ Impact)

Use `scripts/build_call_sheet.js` as the template generator.

### Step 5: Build Response Standards (Optional)

When Chris asks for it, generate the GM Response Standards doc — for each of the 5 lead questions, show:
- Strong answer (green) — quantified, segmented, owns the variance, brings a plan
- Weak answer (red) — generic, defers, no specifics
- What you're grading — the underlying competency

Plus the GM grading rubric (5/5 strong → trust extended; 0/5 strong → formal coaching path).

Use `scripts/build_response_standards.js` as the template generator.

## Property Roster (Reference)

The 17 active Superhost properties as of 2026:
- Operated under Hilton, Marriott, IHG, and Choice Hotels flags
- Three RDO assignments: **Tim Foley**, **Jennifer Kruk**, **Mark Gammill**
- RSMs: **Teresa Bitner**, **Nate Taylor**

When Chris references "Tim's call," "Jennifer's properties," or "Mark's portfolio," scope questions to that RDO's territory. If unclear, ask which property.

## Scoring Tiers and Cadence

| Tier | Score | Cadence | Time |
|------|-------|---------|------|
| Excellent | ≥150 | Monthly — light, async written + 10-min check | 10 min |
| On Track | 120-149 | Monthly — full framework | 25 min |
| Watch | 90-119 | Monthly — full + RDO present | 30 min |
| At Risk | 60-89 | Bi-weekly — RDO + COO, written PIP | 30 min |
| Needs Action | <60 | Weekly — full leadership, weekly metrics | 30 min |

This stratification is how 17 properties fit in two half-days per month, not five.

## Question Library

The full question bank is in `reference/question_bank.md`, organized three ways:
1. **By scorecard line** — Revenue, Occupancy, ADR, Index, GOP, Flow, Forecast, GSAT, Associate
2. **By score tier** — questions sharpen as score drops
3. **By forecast pattern** — Optimistic, Sandbagging, Disorganized

For any review, pull 3-5 questions matched to where the variance lives. Don't ask all of them.

## Voice and Tone

Chris's voice is the standard for all output:
- Direct, NOI-first, no corporate filler
- Short sentences that land
- Plain problem-naming — "March flow collapsed" not "we observed a deceleration in operational efficiency"
- Quantify in dollars whenever possible
- Audience-specific registers: GMs (operational), RDOs (coaching), ownership (NOI/index focus)

Reference: `reference/voice_guide.md`

## Forecast Credibility Patterns

The variance pattern over time reveals more than any single number:

| Pattern | What It Means | Required Action |
|---------|---------------|-----------------|
| Forecast > Actual repeatedly | Optimistic — losing control or hiding miss | Tighten weekly forecast review |
| Forecast < Actual repeatedly | Sandbagging — under-committing | Reset expectation. Forecast is a target. |
| Forecast ≈ Actual (±3%) | Disciplined — credible forecaster | Use as portfolio benchmark |
| High variance, no pattern | Disorganized — no underlying model | Coach methodology. RDO support. |

## Output Artifacts

A complete PSC review session produces three deliverables:

1. **High-Level Analysis** — chat-based, NOI-first written analysis with 5 questions
2. **Call Sheet** — one-page landscape Word doc, print-ready (scripts/build_call_sheet.js)
3. **Response Standards** — landscape Word doc grading framework (scripts/build_response_standards.js)

For deep-dive sessions on coaching a struggling GM or building a PIP, also produce:
4. **30-Day Reset Plan** — structured action plan with weekly checkpoints

## Traps to Avoid

Generic questions kill the call. Cut these:
- "How are things going?" → pulls a generic answer every time
- "What's working well?" → invites highlight reels
- "Any concerns?" → gives GM permission to deflect
- "Why didn't we hit budget?" → leads to excuses, not analysis

Replace with:
- "Walk me through the variance on line X"
- "What specifically changed between forecast and actual?"
- "What's the dollar impact of the biggest gap?"
- "What are you committing to in the next 30 days?"

## Brand Colors (for any visual outputs)

- Navy: `#0D2137`
- Teal: `#1A7E8F`
- Gold: `#C8963F`
- Light Gray: `#F2F2F2`
- Dark Text: `#1F1F1F`

Font: Calibri throughout (matches existing scorecard system).

## File Structure

```
psc-review/
├── SKILL.md                          (this file)
├── reference/
│   ├── diagnostic_framework.md       (how to read each scorecard line)
│   ├── question_bank.md              (full question library)
│   └── voice_guide.md                (Chris's voice rules)
└── scripts/
    ├── build_call_sheet.js           (one-page call sheet generator)
    └── build_response_standards.js   (response standards generator)
```

## Track Block — REQUIRED at the end of every review

Every review ends with a fenced ```track``` block. This is what makes the action items flow into the Superhost cockpit's action tracker — without it, commitments sit in chat history and rot. Decision-grade insights flow into decisions. Properties that crossed a watch threshold flow into watchlist.

Hard rules:
- Always emit the block, even if empty (`{ "decisions": [], "actions": [], "watchlist": [] }`).
- Every action needs a verb-led title, an owner (GM name or role), a `dueDate` (YYYY-MM-DD, never "TBD"), the `propertyId`, and a `dollarImpact` field where it can be estimated.
- Use a decision entry only when the call surfaces something the leadership team must call (not GM-level operational moves).
- Use a watchlist entry only when the property crossed one of the COO watchlist thresholds during the review (score < 90 for 2 periods, flow < 0% for 2 months, RGI < 95 for 3 periods, GOP margin > 4 pts below bud for 2 months, GSS > 5 pts decline, brand QA fail, AR > 60d > 8% of revenue, GM/AGM vacancy > 60d, written owner concern). If already on the watchlist, do not re-add.

Format — fenced exactly:

```track
{
  "actions": [
    { "title": "verb-led — what the GM committed to", "owner": "GM name or role", "dueDate": "YYYY-MM-DD", "propertyId": <id>, "dollarImpact": <number or null>, "notes": "1 short line of context" }
  ],
  "decisions": [
    { "title": "decision the team needs to make", "rationale": "1-2 sentences", "recommendedOwner": "Tim/Chris/RDO name", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "watchlist": [
    { "propertyId": <id>, "reason": "which threshold crossed", "metric": "flow|rgi|gop|score|gss|qa|ar|vacancy|owner-concern", "current": "current value", "exitCriteria": "specific numerical gate" }
  ]
}
```

The block is invisible to the user — Chris and the GM see the prose call sheet; the system stores the block and surfaces the items in the cockpit.

## Bottom Line

The scorecard is the measurement. This skill is the discipline. Used consistently, it turns 17 monthly calls into a portfolio operating system — same questions, same rigor, same standard. The point isn't the meeting. The point is that nothing important gets missed and nothing committed to gets forgotten.
