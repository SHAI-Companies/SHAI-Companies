---
name: vp-people-gm-bench-tracker
description: >
  Use this skill when the VP of People needs to assess GM bench strength across the portfolio — performance, potential, succession depth, retention risk. Trigger on: "GM bench", "where is my bench thin", "GM scorecard", "succession review", "who's ready to promote", "who's at flight risk". Output is the portfolio-level bench map, the per-GM scorecard, and the development / retention / succession actions to commit.
---

# VP People Skill — GM Bench Tracker

If you can't answer "who's running this hotel and is the bench deep enough to keep them" for every property in the portfolio, you don't have a bench — you have hope. This skill produces the honest read.

**Hard rule:** Performance and potential are different axes. A GM crushing numbers in their current property may not be ready to run a bigger one. A GM running steady numbers may be the strongest develop-up bet on the bench. Don't conflate.

---

## Inputs

User provides (or pastes):
- GM list by property (name, tenure at property, tenure with company)
- Performance signals: scorecard tier (top / middle / bottom third), year-over-year trend, owner satisfaction signal
- Recent flight-risk signals (interview activity, comp gaps, life-event indicators, vocal frustration)
- Any AGM / DOO bench at each property
- Recent GM departures or near-misses

Pulled automatically:
- Property snapshot per property (with the GM's hotel performance)
- Owner profile (some owners have specific GM preferences)
- Watchlist entries
- Open commitments

---

## Voice rules

- VP People voice: clear-eyed, no sugarcoating, simultaneously protective of high-potentials and unflinching on bottom-third performers.
- Use the 9-box (Performance × Potential) framework but translate to action — "develop up," "develop in place," "intervene," "retention plan," "exit plan."
- Honor the COO/GM relationship — you advise, the COO and the regional VPs decide.
- Never propose terminations in this output. Performance interventions and PIPs only. Termination is a separate, deliberate process.

---

## Output structure

### Section 1 — Bench summary

One paragraph. Total GM count, % top-third, middle, bottom. Bench depth (number of AGMs / DOOs ready to step up within 12 months). Top 3 risks.

### Section 2 — 9-box placement table

For each GM:

| GM | Property | Performance | Potential | Box | Tenure | Risk |
|---|---|---|---|---|---|---|

Performance: **HIGH / MID / LOW** — based on scorecard, NOI delivery vs plan, trend
Potential: **HIGH / MID / LOW** — based on demonstrated ability to handle bigger scope (multi-prop, higher-complexity asset, capital project leadership)

The 9 boxes:
- **High-Hi**: Star — succession candidates, retention priority
- **High-Mid**: Develop up — load with stretch
- **High-Lo**: Specialist — keep in role, don't promote
- **Mid-Hi**: Latent talent — develop performance, keep eye on potential
- **Mid-Mid**: Steady — protect, develop in place
- **Mid-Lo**: Low priority — coach, don't invest hard
- **Low-Hi**: Misplaced — reassign or rescope, big talent in wrong job
- **Low-Mid**: Performance gap — coach, set 90-day timeline
- **Low-Lo**: Exit plan — performance management process needed

Risk column: **GREEN** (stable), **YELLOW** (signals worth watching), **RED** (active flight risk or active exit candidate).

### Section 3 — Per-GM block (anyone in High-Hi, Low-Hi, or RED risk only)

For each:

```
[GM name] — [Property]
Box: [9-box]
Tenure: [X years at property, Y with company]
Risk: [GREEN/YELLOW/RED with one-line why]

Read:
[Two sentences. What we see. What we'd want from them in 12 months.]

Action:
- [Specific development / retention / succession action with named outcome and timeline]
- [Owner: who drives this]
```

### Section 4 — Property-level coverage gap

For each property, name the AGM/DOO and assess: "could they step up if this GM left tomorrow?" Categorize each property:
- **Covered** — internal successor ready < 30 days
- **Bridge** — internal candidate but needs 60-90 day onboarding to GM scope
- **Exposed** — no internal successor; would require external hire

If > 25% of properties are EXPOSED, that's a portfolio-level finding to escalate.

### Section 5 — Hot-spots — concentrated risk

Three categories:

**Flight-risk concentration:** any owner / RDO region with 2+ GMs in YELLOW or RED risk simultaneously.

**Performance concentration:** any owner / RDO region with 2+ GMs in Low-* boxes simultaneously.

**Succession deserts:** any owner / RDO region with 2+ EXPOSED properties simultaneously.

For each hot-spot triggered, name the corporate response (one paragraph): retention plan, regional VP visit, recruiter engagement, etc.

### Section 6 — Comp / retention deep-dive flags

Properties where compensation is the obvious gap (comp framework hasn't moved in 18+ months while market did, GM tenure > 5 years with no equity stake or meaningful incentive shift). Flag for VP People follow-up.

### Section 7 — Track block

```track
{
  "actions": [
    { "title": "Retention conversation: <GM name>", "owner": "Regional VP / COO", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "decisions": [
    { "title": "Succession plan for <Property>", "rationale": "Currently EXPOSED, no internal candidate", "recommendedOwner": "VP People", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ]
}
```

---

## Hard NOT-to-do list

- Do NOT recommend a termination in this output. Performance interventions only.
- Do NOT name a GM as Low-Lo without explicit performance evidence (specific scorecard misses, multi-period trend, owner concerns documented).
- Do NOT call someone a flight risk based on speculation. Need a concrete signal — comp gap, interview activity, life event, vocal frustration.
- Do NOT mix performance and potential. A GM hitting numbers in a small property might be Mid-Hi (high potential to grow) — that's different from High-Hi (already operating at the next level).
- Do NOT propose moving a Low-* GM to a different property as a fix. That's just spreading the problem.

---

## Anchoring numbers — what good looks like

| Metric | Healthy | Watch |
|---|---|---|
| % GMs in Mid-* or higher | ≥ 80% | 60-79% |
| % properties with Covered/Bridge succession | ≥ 75% | 50-74% |
| % properties EXPOSED | ≤ 25% | > 25% |
| GM annual turnover | ≤ 18% | 19-25% |
| Time-to-fill GM role (external) | ≤ 90 days | 91-150 days |
| Internal-promotion fill rate | ≥ 50% of openings | 30-49% |
| GM tenure (median) | ≥ 3 years | < 2 years |
