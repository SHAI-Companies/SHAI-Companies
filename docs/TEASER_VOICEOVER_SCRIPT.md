# SHAI Executive Hub — 1:53 teaser
## Voiceover script · ready to read

**Total runtime:** 1 minute 53 seconds (113 seconds), paced to the visual scenes
**Target word count:** ~199 spoken words
**Pace:** ~110 wpm — measured, not rushed (storyteller cadence)
**Voice:** Superhost — terse, direct, NOI-first, no marketing filler

The shipped audio at `public/teaser-vo.mp3` was recorded with ElevenLabs
Sawyer (Midnight Storyteller). Re-recording with a different voice (or a
human) is fully supported — drop a new mp3 at the same path, then update
`SCENE_STARTS` in `public/teaser.html` so the visual transitions land on
the new scene breaks.

---

## Before you record

- **Mic check, room tone.** Record 5 seconds of silence in your space first;
  if you hear hum, hiss, or HVAC, fix it before the take.
- **Read the whole script through once dry** before rolling. Find the breaths.
- **Pause at scene transitions.** The visual is doing half the work — let it
  breathe. A half-second silence between scenes reads as confidence, not as
  a stumble.
- **Don't overemphasize.** This is a board / lender / owner audience. They
  trust calm narration. Selling reads as defensive.
- **Do multiple takes per scene.** Easier than re-doing the whole reel.

---

## The script

Each block is one scene. Read at a steady pace. Numbers in brackets are
the scene start time — useful if you're reading along while the silent
reel plays as a guide track.

---

### `[0:00]` Scene 1 — Cold open

> Seventeen hotels. Six owners. Four brand families.
>
> One operating picture — powered by SHAI.

*(beat — let the splash hold)*

---

### `[0:09]` Scene 2 — Portfolio cockpit

> Live portfolio numbers — revenue, NOI, occupancy, RevPAR.
>
> Every property. Every period.
>
> Pulled from ProfitSword, corrected, owner-ready.

---

### `[0:19]` Scene 3 — Daily Flash

> Daily Flash gives ownership the morning read.
>
> Period-to-date, full period, every metric. Drift in dollars and points.

---

### `[0:28]` Scene 4 — Forecast credibility

> Eight metrics, locked on day one of the month.
>
> Drift tracked daily. One credibility score per general manager.

---

### `[0:38]` Scene 5 — Demand AI daily forecast

> A thirty-day forecast from Claude. Day-of-week shape.
>
> Snapshot actuals overlaid on what we expected — what's actually landing.

---

### `[0:48]` Scene 6 — STR Comp Set

> Live competitive position. RGI, ARI, MPI on every property.
>
> Auto-derived from ProfitSword. No second STR subscription.

---

### `[0:57]` Scene 7 — Weekly STR Commentary

> Weekly narrative captured per property — the story behind the number.
>
> Demand, comp moves, what we're doing next.

---

### `[1:06]` Scene 8 — AI Council

> When the call needs more than one head, the council deliberates.
>
> Seven executives against the live portfolio — then synthesizes the recommendation.

---

### `[1:17]` Scene 9 — Skills Library

> Pre-built plays for every persona.
>
> Monday digest, brand-letter triage, scorecard review, property pulse.
>
> Owner-grade output. One click.

---

### `[1:27]` Scene 10 — PSC Scorecard

> Every property reviewed monthly against the same Superhost rubric.
>
> Forecast accuracy. Flow-through. RevPAR index. Composite score.
>
> The call ends with action.

---

### `[1:38]` Scene 11 — Owner letter

> Output that reads lender-grade.
>
> Owner letters tuned to each owner — voice consistent, period on period.

---

### `[1:48]` Scene 12 — Closer

> Powered by SHAI.
>
> Available now. Superhost Hospitality.

*(let the closing splash hold for the final beat)*

---

## Word count by scene

| Scene | Time | Words | Approximate read time |
|---|---|---|---|
|  1 | 0:00 | 16 | 6.8 s |
|  2 | 0:08 | 18 | 7.7 s |
|  3 | 0:16 | 16 | 6.8 s |
|  4 | 0:24 | 17 | 7.3 s |
|  5 | 0:32 | 18 | 7.7 s |
|  6 | 0:40 | 16 | 6.8 s |
|  7 | 0:48 | 16 | 6.8 s |
|  8 | 0:56 | 19 | 8.1 s |
|  9 | 1:04 | 18 | 7.7 s |
| 10 | 1:12 | 19 | 8.1 s |
| 11 | 1:20 | 17 | 7.3 s |
| 12 | 1:28 | 9 | 3.8 s |
| **Total** | — | **199** | **85 s** |

That leaves ~11 seconds of breath and silence across the reel — enough for
scene transitions to land without rushing into the next read.

---

## If you need shorter

If 96 seconds is too long for the audience, the easiest cuts (in order
of pain):

1. **Drop Scene 7 (Weekly STR Commentary)** — newest feature, may not be
   what leadership needs to hear about first. Saves 8 s.
2. **Drop Scene 5 (Demand AI heatmap)** — Scene 4 already establishes
   forecast discipline. Saves another 8 s.
3. **Drop Scene 9 (Skills Library)** — the Council in Scene 8 implies it.
   Saves another 8 s.

Cutting any one scene also requires updating `SCENE_COUNT` in
`public/teaser.html` and removing the corresponding `<section>` block.

---

## If you need longer

Add scenes for any of these — most of them already exist as named features
in the hub but didn't make the v2 reel:

- HR dashboard / Job Postings (people-facing)
- Statements / USALI P&L with Flow-Through (CFO-facing)
- Recon page — PMS Revenue, Cash Deposits, CC Batches (controller-facing)
- Owner Groups — 6-owner roster with click-to-filter
- Watchlist — properties on intervention with thresholds and exit criteria

Each new scene is 8 s and adds an entry to the `SCENES` array — no further
JS changes needed. Update voice copy here for the added scenes.

---

## A note on tone

The Superhost voice is what makes the reel land different from a SaaS demo.
Read like you've already won the room — not like you're trying to win it.
Owners and lenders trust calm, specific narration. Marketing-voice
("revolutionary," "best-in-class," "transformative") will tell them this is
a pitch, not a tool.

When you're tempted to hit a word harder, hit the silence before it instead.
