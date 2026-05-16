# Claude Code Handoff — PSC Review Module for Exec Hub

This document is the handoff brief for wiring the PSC Review system into the Superhost Executive Operations Hub via Claude Code.

## What Exists Now

A complete skill at `psc-review/` with:
- `SKILL.md` — operating instructions and decision rules
- `reference/diagnostic_framework.md` — how to read each scorecard line
- `reference/question_bank.md` — full question library (organized 3 ways)
- `reference/voice_guide.md` — Chris's voice rules
- `scripts/build_call_sheet.js` — one-page call sheet generator
- `scripts/build_response_standards.js` — response standards generator

The skill works in chat today. This handoff defines how to make it a feature inside the Hub.

## What to Build in the Hub

A new section called **"PSC Review"** with the following functionality:

### 1. Property Selector
- Dropdown of all 17 active properties (use existing property list from Hub)
- Filtered by RDO group (Tim / Jennifer / Mark)
- Defaults to most recent reviewed property

### 2. Live Data Pull
- Pull current month's PSC data from ProfitSword via existing proxy
- Auto-populate the scorecard fields (revenue, GOP, occupancy, ADR, RevPAR, Index, etc.)
- Fall back to manual entry if ProfitSword data not yet available

### 3. Auto-Generated Call Sheet
On property selection + month:
- Run the variance analysis (logic from `reference/diagnostic_framework.md`)
- Generate the 6 at-a-glance metrics most relevant to that property's variance
- Generate 5 lead questions tailored to the variance pattern (using question bank logic)
- Generate 8 backup questions across categories
- Render as an in-Hub card AND a downloadable Word doc

### 4. AI-Powered Question Generation
- Use existing Claude API integration in the Hub
- Send the scorecard data + diagnostic framework + question bank as context
- Return tailored questions specific to that property's variance pattern
- Match Chris's voice using the voice guide

### 5. Response Capture
- Live note-taking during call
- Capture answer quality per question (Strong / Mixed / Weak — 3-button rating)
- Auto-grade GM at end of call (5/5, 3-4, 1-2, 0 strong)
- Save call notes to property history for trend analysis

### 6. Action Item Tracking
- 3 action items per call (owner, due date, dollar impact)
- Auto-populate to Hub's existing alerts/tasks system
- Alert when action items come due
- Track completion at next month's call

### 7. Historical View
- Show last 6 months of PSC scores per property
- Show forecast accuracy pattern (sandbagging, optimistic, accurate, disorganized)
- Show GM grading trend across calls
- Identify properties needing escalation (3 consecutive Watch+ scores, etc.)

### 8. RDO Rollup View
- For each RDO (Tim, Jennifer, Mark), show portfolio-level patterns
- Common issues across their properties
- GM coaching trends
- Forecast credibility by RDO group

## Data Model

```javascript
// PSC Review record per property per month
{
  propertyId: string,
  monthYear: "2026-03",
  scorecardData: { /* all PSC fields */ },
  varianceAnalysis: {
    headline: string,
    storyType: "rate-driven" | "occupancy-driven" | "mixed" | "cost-discipline" | etc.,
    forecastPattern: "optimistic" | "sandbagging" | "accurate" | "disorganized"
  },
  callSheet: {
    glanceMetrics: [...],
    leadQuestions: [...],
    backupQuestions: [...]
  },
  callRecord: {
    date: timestamp,
    attendees: [...],
    answerQuality: { q1: "strong", q2: "weak", ... },
    gmGrade: "5/5" | "3-4" | "1-2" | "0",
    actionItems: [
      { description, owner, dueDate, dollarImpact, status }
    ]
  }
}
```

## Integration Points with Existing Hub

- **PIN gate:** PSC Review accessible at COO (1179) and RDO (4422) levels
- **Property data:** Use existing ProfitSword proxy and siteTag mapping
- **Alerts system:** Action items feed into existing alerts module
- **Reports section:** Add PSC Review history as a report type
- **Forecast Intelligence:** Cross-link with existing forecast accuracy tracking

## Voice & Style

All AI-generated text must follow `reference/voice_guide.md`:
- Direct, NOI-first, no corporate filler
- Short sentences that land
- Quantify in dollars
- Plain problem-naming

## Phase Plan

**Phase 1 (MVP):** Property selector + manual scorecard entry + auto-generated questions + downloadable call sheet. No data integration yet.

**Phase 2:** ProfitSword data integration + auto-populated scorecard.

**Phase 3:** Live call capture + answer quality rating + GM grading.

**Phase 4:** Action item tracking + alerts integration.

**Phase 5:** Historical view + RDO rollup + portfolio-level patterns.

## Validation Before Production

Before rolling out to all 17 properties, validate with:
- Tim Foley's properties first (since he's already bought in)
- 30-day pilot, full call cycle
- Then expand to Jennifer's group, then Mark's

## Files to Reference

When building, the Code agent should read:
1. `psc-review/SKILL.md` — operating logic
2. `psc-review/reference/diagnostic_framework.md` — variance analysis logic
3. `psc-review/reference/question_bank.md` — question generation source
4. `psc-review/reference/voice_guide.md` — voice rules for AI output
5. `psc-review/scripts/build_call_sheet.js` — Word doc generation pattern (already proven)
6. `psc-review/scripts/build_response_standards.js` — standards doc generation pattern

## Bottom Line

This skill turns 17 monthly calls into a portfolio operating system. Wired into the Hub with live data and historical tracking, it becomes the COO's primary command surface for property accountability. Same questions, same rigor, same standard — at scale.
