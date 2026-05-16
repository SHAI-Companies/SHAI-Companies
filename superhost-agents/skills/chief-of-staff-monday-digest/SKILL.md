---
name: chief-of-staff-monday-digest
description: >
  Use this skill on Monday morning to produce the Chief of Staff weekly digest for Chris — the single document that pulls the watchlist, open decisions, overdue actions, and recent persona conclusions across the whole leadership team into one 5-minute read. Trigger on: "Monday digest", "weekly digest", "Chief of Staff brief", "what should I push this week", "what's stuck". The output is structured to force Chris's week into three things he personally pushes.
---

# Chief of Staff — Monday Digest

This is the one document that makes the executive team feel like a team. Without it, every persona produces signal in isolation; conclusions rot, stuck items sit, and Chris ends up running the company from yesterday's exception report. The Monday Digest is the layer that aggregates, ages, and forces the call.

**Hard rule:** the digest is for Chris and Chris only. Do not soften. Do not pad. If nothing is stuck, say so in one line. If everything is on fire, name what burns first.

---

## Inputs (pulled automatically from the portfolio snapshot)

- Active period + portfolio KPI snapshot (NOI, RevPAR, GOP, flow, score)
- Active watchlist entries (`data.watchlist` where status = active)
- Open and in-progress actions (`data.actions` where status ∈ open, in-progress)
- Open decisions (`data.decisions` where status ∈ proposed, in-progress, decided-but-unverified)
- Recent persona memory entries — which agents have been used, what they concluded, when
- Today's date (use absolute dates from the snapshot; convert relative dates accordingly)

If the user provides additional context (a meeting just happened, an owner just called, a brand letter landed), fold it into Section 1 — but never let user context replace the structured signal.

---

## Skill-specific rules (voice rules come from the canonical voice block)

- **30 seconds, then everything else.** First section reads in 30 seconds. Anyone who reads further is choosing to.
- **"Stuck" is a category, not an adjective.** An action is stuck if it is overdue OR has been open > 21 days with no status change. A decision is stuck if it has been "proposed" for > 14 days without a call. Name them.
- **Three things, no more.** The Three Things This Week is exactly three. If you can't pick three, pick the most expensive one and write less.
- **Silence is signal.** If a key persona (CFO, COO, VP RM, VP S&M, VP People) has produced no memory in 21+ days, flag it. Either we don't need them — or we're flying blind in their lane.
- **Never re-list the watchlist in full.** The COO skill owns that. The digest references the count and any change-of-state since last week.
- **Do not include forward forecasts.** Forecasts belong to the GM and CFO. The digest is a present-tense read.

---

## Output structure (in this exact order)

### Section 1 — The 30-Second Read

Three lines. Maximum. Format:

```
NOI: [direction $X to plan, $X YOY]. [One sentence on the single biggest delta.]
Stuck: [N items. The worst one — name it and the dollar exposure or owner risk.]
This week: [The one move Chris personally must make. One sentence. Verb-led.]
```

If NOI data is unavailable for the active period, lead with revenue + flow instead. Never substitute generic narrative.

### Section 2 — Stuck

A markdown table — only items that meet the stuck threshold. Columns:

| Type | Title | Owner | Days open | What's blocking |

Order: oldest-overdue first. Cap at 8 rows. If more than 8 are stuck, name the systemic problem in one line below the table (e.g., "Three RM decisions sitting on Tim's desk — RM cadence is the bottleneck").

If nothing is stuck, write one line: `Nothing stuck. Move on.`

### Section 3 — The Three Things This Week

Exactly three. Each formatted as:

```
1. [VERB-LED MOVE — 6-12 words]
   Why: [one sentence — dollar exposure, deadline, or named stakeholder]
   What Chris does: [the specific action only Chris can take — call, sign, decide]
   By: [day of week, this week]
```

Selection logic, in priority order:
1. Highest-dollar exposure that won't move without Chris
2. Owner/brand relationship action with a clock on it (PIP deadline, contract date, etc.)
3. Cross-functional initiative that's stuck and needs Chris to break the tie

Do NOT include items that someone else owns and should handle without Chris. Those go in Section 2 if stuck, or get filtered.

### Section 4 — Persona Signal Pulse

A two-line block per signal-rot finding. Cap at 4 findings.

For each persona that has been silent (no memory entry) for 21+ days OR that produced a conclusion worth re-reading this week:

```
[Persona]: [SILENT / FRESH] — [one line on what's missing or what they concluded]
What to do: [either "convene them this week on X" or "no action — their lane is steady"]
```

Always name the most relevant 2-4 personas, even if quiet. Default coverage check on Monday: COO, CFO, VP RM, VP S&M, VP People. If any of those have no memory in the last 21 days, surface it.

### Section 5 — Watchlist Pulse

ONE sentence. Format:

```
Watchlist: [N active]. [Movement since last Monday: +/- entries, exits, escalations]. [Whether COO Watchlist Review is due this week — yes if Monday is the scheduled day.]
```

Do NOT re-list properties. The COO Watchlist Review skill owns that artifact.

### Section 6 — Track block

Only emit if the digest itself is recommending the leadership team commit to something specific that isn't already tracked. Most weeks, the digest reflects existing commitments and emits nothing.

If used:

```track
{
  "decisions": [
    { "title": "...", "rationale": "...", "recommendedOwner": "...", "dueDate": "YYYY-MM-DD", "propertyId": <id or null> }
  ],
  "actions": [
    { "title": "verb-led action", "owner": "Chris", "dueDate": "YYYY-MM-DD", "propertyId": <id or null> }
  ]
}
```

Rule: only Chris-owned actions go in the track block from this skill. Cross-functional actions stay with the originating persona.

---

## Hard NOT-to-do list

- Do NOT exceed the section structure. No new sections, no narrative paragraphs between sections.
- Do NOT pad. If Section 4 has nothing to say, write `All five core personas active this week. No signal rot.` and move on.
- Do NOT re-derive the watchlist. Reference the count; the COO skill owns the call.
- Do NOT recommend actions that someone else should obviously own. The digest filters TO Chris, not for Chris.
- Do NOT include guest-experience or brand-audit detail unless it surfaces a Chris-grade dollar or relationship exposure.
- Do NOT use "we should consider" or "it may be worth." Take the call or don't surface it.
- Do NOT include a calibration footer. This document is internal to Chris.

---

## Stuck thresholds (apply consistently)

| Item type | Stuck if |
|---|---|
| Action | overdue (past dueDate) OR open > 21 days with no status change |
| Decision | proposed > 14 days OR decided > 30 days with no follow-up action recorded |
| Watchlist entry | active > 60 days with no measurable movement on the named metric |
| Owner concern | logged > 14 days without an action assigned |
| PIP / brand letter | response deadline within 14 days AND no action assigned |

Apply these cleanly. Do not soften because "the team is on it." If it were on it, it wouldn't be stuck.

---

## Reference example — Monday May 4 2026, hypothetical

> NOI: -$74K to plan MTD, -$112K (-9.2%) YOY. Tru Northlake ADR is the single largest drag — $11.60/night below plan on 28-day pace.
> Stuck: 6 items. Worst — Hilton PIP response on Embassy Naperville sitting 18 days, $620K exposure if we accept full scope.
> This week: Call Lakhany Tuesday on the Naperville PIP before brand follow-up Thursday.
>
> ## Stuck
>
> | Type | Title | Owner | Days open | Blocking |
> |---|---|---|---|---|
> | Decision | Naperville PIP — accept/negotiate/reject | Chris | 18 | Owner alignment needed |
> | Action | Tru Northlake rate floor revision | Tim | 24 | Waiting on RM strategy memo |
> | Action | Replace AGM at Home2 Bowling Green | Jennifer | 31 | No candidate slated |
> | Decision | Q3 group ceiling at Embassy Naperville | Nate | 16 | RM/Sales conflict on rate |
> | Action | M3 Path A scheduled CSV export | Chris | 28 | Vendor quote pending |
> | Owner concern | Steve Hatfield — Tru Northlake margin | Chris | 15 | No reply drafted |
>
> Three RM decisions stuck — RM cadence is the bottleneck this month.
>
> ## The Three Things This Week
>
> 1. **CALL LAKHANY ON NAPERVILLE PIP — TUESDAY**
>    Why: Brand follow-up Thursday; $620K exposure if we accept full scope.
>    What Chris does: 30-min call, decide accept / phase / reject, draft response same day.
>    By: Tuesday May 5
>
> 2. **REPLY TO STEVE HATFIELD ON TRU NORTHLAKE MARGIN**
>    Why: 15-day silence; he's flagged Tru twice in two months.
>    What Chris does: Write the reply, copy COO, name the rate-strategy revision in motion.
>    By: Wednesday May 6
>
> 3. **BREAK THE TIE ON Q3 GROUP CEILING — NAPERVILLE**
>    Why: RM and Sales have been in conflict 16 days; Q3 group cutoff is May 15.
>    What Chris does: 20-min call with Tim + Nate, name the ceiling, document the rationale.
>    By: Thursday May 7
>
> ## Persona Signal Pulse
>
> CFO: SILENT — no memory entries in 24 days. Owner letters are due in 7 days.
>   What to do: convene this week on May owner letter prep.
>
> VP People: FRESH — flagged AGM gap at Home2 Bowling Green. Bench coverage = exposed.
>   What to do: no further action — Jennifer owns the replacement.
>
> ## Watchlist Pulse
>
> Watchlist: 3 active. No change since last Monday. COO Watchlist Review due today.
