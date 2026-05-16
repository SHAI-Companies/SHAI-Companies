# Executive Hub — 12-scene teaser playbook

A self-playing reel highlighting SHAI for leadership. Built into the hub at
`/teaser.html` — open in any browser, plays automatically with synced
voiceover.

**Runtime:** 1 minute 53 seconds (113 seconds), set by the embedded
voiceover at `/public/teaser-vo.mp3`. Scene transitions are driven off
`audio.currentTime` so they stay synced regardless of network jitter,
the user pausing/resuming, or the audio seeking.

**If autoplay is blocked** (which Chrome does until the user has interacted
with the site once), a "Tap to play with sound" overlay appears. One click
starts both audio and reel. After that, replay always works in-session.

---

## How to view it

**Live:** http://localhost:3000/teaser.html (hub must be running)

**Direct file:** open `public/teaser.html` in Chrome / Edge.

Controls (none needed for normal viewing):
- Auto-starts on page load
- Click the stage → restart
- Spacebar → restart
- Replay button appears at end
- Top-left corner shows brand watermark; top-right shows running clock;
  bottom-right shows current scene number

Twelve scenes, paced to the voiceover:

| Scene | Start | Beat |
|---|---|---|
|  1 | 0:00 | Cold open — animated SHAI splash full-bleed, overlay "One pane · 17 hotels · Powered by SHAI" |
|  2 | 0:09 | Portfolio cockpit — 4 KPI tiles with animated counters, brand pills |
|  3 | 0:19 | Daily Flash — PTD vs Full Period, 4 metrics, drift visible |
|  4 | 0:28 | Forecast credibility — 8 Day-1 locked drift chips |
|  5 | 0:38 | Demand AI — May daily heatmap, snapshot actuals overlay |
|  6 | 0:48 | STR Comp Set — RGI / ARI / MPI per property, auto-derived |
|  7 | 0:57 | Weekly STR Commentary — narrative behind the number |
|  8 | 1:06 | AI Council — 7 personas light up, synthesis card |
|  9 | 1:17 | Skills Library — pre-built plays, owner-grade output |
| 10 | 1:27 | PSC Scorecard — stair-step scoring, NOI-anchored |
| 11 | 1:38 | Owner Letter — Lakhany Q2 portfolio summary |
| 12 | 1:48 | Closer — animated splash full-bleed, "Powered by SHAI · Available now" |

**Tuning a scene boundary:** if a scene fires too early or too late vs the
voiceover, edit the `SCENE_STARTS` array at the top of the `<script>` block
in `public/teaser.html`. The array holds the start time (in audio seconds)
of each scene. Nudge the relevant index by ±0.3-0.5 s and refresh — scenes
resync on the next `timeupdate` (~250 ms). No rebuild needed.

---

## Voiceover

The reel ships with a synced voiceover — `public/teaser-vo.mp3`, currently
the ElevenLabs Sawyer (Midnight Storyteller) read of the script. Total
runtime 1:53. The teaser auto-plays the audio and drives scene transitions
off `audio.currentTime`, so the visuals always track the audio precisely.

**Read-into-the-mic script** — see `docs/TEASER_VOICEOVER_SCRIPT.md`. That
doc is the standalone recording reference (timestamps, breath cues, target
word counts, shorter/longer cuts).

**To swap the voiceover:**
1. Drop a new mp3 at `public/teaser-vo.mp3` (any duration works).
2. Update the `TOTAL` constant in `teaser.html` to the new duration in
   seconds.
3. Update the `SCENE_STARTS` array entries to the new scene-break timestamps
   in the audio. Easiest way to find them: play the audio in your editor,
   note the second mark where each scene's narration begins.

The teaser falls back to wall-clock pacing if the audio fails to load
(file 404, decode error, etc.) — the visuals keep running so leadership
sees the reel even on a network hiccup.

---

## Recording it as an mp4

### Path A — Windows Xbox Game Bar (zero install, fastest)

1. Open `http://localhost:3000/teaser.html` in Chrome / Edge in fullscreen (F11).
2. Click anywhere on the page once (this satisfies Chrome's autoplay
   requirement — without a user gesture the audio won't play).
3. Press `Win + G` → record button (or `Win + Alt + R` to start immediately).
4. Refresh the teaser page so it auto-plays from 0:00 with audio.
5. Wait 115 seconds (the full 1:53 plus a 2-second pad), then stop.
6. Output saved to `Videos/Captures/`. Mp4 includes audio — done.

### Path B — OBS Studio (better quality, more control)

1. Install OBS (free, https://obsproject.com).
2. Add Display Capture or Window Capture (target the Chrome window).
3. Output settings: 1920×1080, 60 fps, mp4. CBR ~8 Mbps.
4. Start recording → refresh teaser → wait → stop.
5. Result: clean mp4 with crisp text. ~50 MB for 60 seconds.

### Path C — Loom (best for "send a link" delivery)

1. Loom Chrome extension → record current tab.
2. Microphone on if recording voiceover live; off if doing audio post.
3. Record → auto-share link.
4. Loom hosts the video and gives you a URL ready to send.

### Voiceover options

- **Live narration** while recording: practice once, hit record, narrate the
  scenes as they play. Hardest, most natural.
- **Post-production:** record the silent video, then drop into Clipchamp or
  iMovie and add a separate voice track. Easier to retake.
- **AI voice (last resort):** ElevenLabs or similar can produce a competent
  read of the script in ~5 minutes if you don't want to be on the recording.

---

## Sending to leadership

### If they have hub access (internal audience)

Send the URL: `http://<hub-host>/teaser.html`

Pro: always current — if you tweak the teaser, they get the new version.
Con: requires VPN / hub access; not great for board members or owners on
the road.

### If you want a file they can open without the hub

1. Open `public/teaser.html` in a browser.
2. Save Page As → "Web Page, Complete" → bundles HTML + assets into a folder.
3. Or: record the mp4 (Path A/B above) and attach.

**Recommendation for owner / board / lender audiences:** record the mp4 with
voiceover. It's lower friction (Outlook plays it inline, no clicks), more
controlled (timing, pacing, narration locked), and travels cleanly through
corporate firewalls.

---

## Editing the content

The reel is hand-coded HTML/CSS/JS in `public/teaser.html`. The 8-second
cadence is enforced by a single constant — change it in one place if you
ever want a different pace. To edit content:

| What | Where |
|---|---|
| Headline / sub copy (scenes 2-11) | `<h2 class="head">` and `<div class="sub">` inside each `<section class="scene-N">` |
| Splash bookend overlay text (scenes 1 + 12) | `.splash-overlay .overlay-text` in those scenes — uses iframe `/splash.html?clip` for the animated background |
| KPI numbers | `data-counter` / `data-prefix` / `data-suffix` on `.kpi-value` divs in scene 2 |
| Daily Flash table cells | `<div class="flash-row">` blocks in scene 3 |
| Drift chips (metric / value / color class) | `<div class="drift-chip green\|warn\|red">` blocks in scene 4 |
| Daily forecast heatmap shape | `buildHeatmap()` in the `<script>` block — adjust which days are `fill1`/`fill2`/`fill3`/`fillwarn`/`future` |
| STR Comp Set rows | `<div class="str-row">` blocks in scene 6 (RGI tier classes: `up` / `warn` / `down`) |
| Weekly STR Commentary cards | `<div class="wstr-card">` blocks in scene 7 |
| Council personas (initials + label) | `<div class="persona">` blocks in scene 8 |
| Synthesis card body | `#synthesis .synth-body` |
| Skill cards (icon, name, desc) | `<div class="skill-card">` blocks in scene 9 |
| PSC tile values + tier color | `<div class="psc-tile">` blocks in scene 10 (tier classes: `tier-a` / `tier-b` / `tier-c` / `tier-d`) |
| Owner letter content | `<div class="letter">` block in scene 11 |
| Closing line | scene 12 `.head` and `.sub` |
| Per-scene start time (audio sync) | `SCENE_STARTS` array at the top of the `<script>` block — one entry per scene, in audio-seconds |
| Total scene count | derived from `SCENE_STARTS.length` — add/remove `<section>` blocks to match |
| Voiceover audio file | `public/teaser-vo.mp3` — replace this file to swap the VO; update `SCENE_STARTS` to match the new pacing |
| Total runtime ceiling | `TOTAL` constant — set to the voiceover's duration in seconds |

Any changes are live the moment you save — refresh the browser, no rebuild.

---

## Why this design

The teaser bends the SHAI design system in one place: motion. The day-to-day
cockpit is calm SaaS; this is a 96-second hook for an audience that hasn't
seen the product yet. Constraints honored:

- Brand palette (navy / pink / blue / slate) — no new colors
- Inter + JetBrains Mono only — no third font
- Pink and blue as accents — not on large surfaces
- Status colors (green / amber / red) only on status indicators
- The brand mark is the SHAI logo, not a custom variant
- The cold open and closer reuse the actual production splash page
  (`splash.html?clip`) full-bleed — same Aurora Drift shader, same SHAI
  mark, same brand moment ownership already sees on every hub launch

Constraints relaxed for video format:
- Fade-in/out scene transitions (.7s) — exceeds the day-to-day .32s --t-base
- Counter animations — not used in the cockpit
- Persona avatars light up sequentially — not a live cockpit pattern

These are scene-only flourishes. They don't propagate back to the dashboard.

## Clip mode on splash.html

The splash page honors a `?clip` query parameter that suppresses the
auto-redirect, the topbar, the "Enter Dashboard" launch button, and the
progress bar. The aurora WebGL canvas, the SHAI logo, and the tagline bars
remain. This is what scenes 1 and 12 iframe in. Production splash behavior
is unchanged when `?clip` is absent.
