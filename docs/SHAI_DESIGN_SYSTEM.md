# SHAI Design System

**Version:** 1.0
**Source of truth:** [`public/styles/shai-theme.css`](../public/styles/shai-theme.css)
**Brand assets:** [`public/brand/`](../public/brand/) and [`public/brand/individual/`](../public/brand/individual/)

SHAI is the visual identity for an internal hospitality intelligence platform — used across dashboards, owner reporting, and presentations. This document is the contract: any new page or component MUST consume these tokens; new colors, fonts, or spacing values are not added without an update here.

---

## How to use it

Add this single line to any new HTML page in `public/`:

```html
<link rel="stylesheet" href="/styles/shai-theme.css" />
```

For dark operator pages (cockpit / internal-tools feel), also add:

```html
<link rel="stylesheet" href="/styles/shai-cockpit-overrides.css" />
<body class="shai-cockpit"> ...
```

That's it. All tokens, primitives, and components are then available.

---

## Color tokens

```css
--shai-navy:  #0B1F3A   /* primary surface, header background */
--shai-pink:  #FF2DB2   /* accent — highlights, KPI deltas, brand pop */
--shai-blue:  #1A6BFF   /* primary action, links */
--shai-slate: #6B7A90   /* secondary text */
--shai-light: #F2F4F7   /* page background, subtle surface */
```

**Usage rule:** pink and blue are the SHAI brand voice. Use them visibly,
repeatedly, and confidently — but always in service of hierarchy, never as
flat fills on body-copy backgrounds. The right placements are: primary
buttons (gradient), section eyebrows (gradient text), header bottom rule,
sidebar active state (gradient left bar), KPI tile hover glow, focus rings,
loading bars, brand marks. Body text stays navy on light / light on navy —
brand colors live in the **accent layer**.

**Pink and blue are not status.** Green / red / amber are the only colors
that communicate operational signal (favorable / unfavorable / watch).
A KPI delta uses green or red, not pink. A gradient on a number would lie
about whether the number is good. Brand colors live in the *brand layer*;
status colors live in the *data layer*; never mix them.

Semantic status colors are separate and stay consistent everywhere:

```css
--status-up:    #16A34A   (favorable)
--status-down:  #DC2626   (unfavorable)
--status-warn:  #D97706   (watch)
```

---

## Brand gradient + glow vocabulary

The SHAI signature is the pink↔blue gradient. Use these tokens anywhere
you'd otherwise reach for a flat brand color — primary buttons, accent
rules, eyebrow text, loading bars, hero CTAs. Adjust once in
`shai-theme.css`, every surface follows.

```css
--brand-gradient:        linear-gradient(90deg, #FF2DB2 0%, #1A6BFF 100%);
--brand-gradient-135:    linear-gradient(135deg, #FF2DB2 0%, #1A6BFF 100%);  /* logo marks, avatars */
--brand-gradient-soft:   linear-gradient(90deg, rgba(255,45,178,.18) 0%, rgba(26,107,255,.18) 100%);  /* hover tints */
--brand-gradient-faint:  linear-gradient(90deg, rgba(255,45,178,.06) 0%, rgba(26,107,255,.06) 100%); /* card backgrounds */

--brand-glow-pink:   0 0 24px rgba(255,45,178,0.28);
--brand-glow-blue:   0 0 24px rgba(26,107,255,0.28);
--brand-glow-mix:    0 0 24px rgba(255,45,178,0.18), 0 0 36px rgba(26,107,255,0.14);
--brand-glow-strong: 0 0 32px rgba(255,45,178,0.40), 0 0 48px rgba(26,107,255,0.30);
--brand-ring:        0 0 0 3px rgba(255,45,178,0.18), 0 0 0 6px rgba(26,107,255,0.10);

--brand-rule:        gradient hairline (transparent → pink → blue → transparent)
--brand-rule-strong: solid pink-blue gradient bar (no fade)
```

Drop-in utility classes (defined in `shai-theme.css`):

```html
<!-- Primary CTAs — gradient pill -->
<button class="shai-btn shai-brand-gradient">Generate Report</button>

<!-- Section eyebrow — pink/blue gradient text in mono caps -->
<div class="shai-brand-eyebrow">Live Portfolio Intelligence</div>

<!-- Headline gradient text -->
<h1 class="shai-brand-gradient-text">Q2 Performance</h1>

<!-- Brand divider rules -->
<hr class="shai-brand-rule" />          <!-- soft fade rule -->
<hr class="shai-brand-rule-strong" />   <!-- solid gradient bar with glow -->

<!-- Brand glow on cards -->
<div class="shai-card shai-brand-glow">…</div>

<!-- Animated shimmer (loading bars, hero CTAs) -->
<div class="shai-brand-shimmer"></div>
```

### Where the brand shows up automatically (cockpit body class)

When a page sets `body.shai-saas`, the cockpit overrides apply brand
presence everywhere without inline CSS:

| Surface | Treatment |
|---|---|
| Header bottom edge | Gradient hairline (`--brand-rule`) |
| Primary `.hdr-btn` (Hub, Refresh, Export) | Gradient fill + glow on hover |
| Sidebar active item | Gradient left rail + soft pink-blue tint |
| `.kpi-card`, `.shai-card` hover | Pink border + brand glow |
| Inputs / buttons on focus | Pink + blue ring stack (`--brand-ring`) |
| `.sb-label`, `.ql-cat-title`, eyebrows | Gradient text (mono caps) |
| `.progress-bar`, scan progress | Animated pink↔blue↔pink shimmer |
| `::selection` | Pink highlight |
| `.send`, `.scan-run`, `.cmd-send`, `.item-btn` | Gradient pill + glow |
| `.badge.live`, `.skill-icon` | Gradient fill |

This is the single biggest payoff of the cockpit body class — no per-page
brand styling is needed. Just write semantic markup; the brand surface
follows.

---

## Typography

**Family:** Inter, with JetBrains Mono for tabular numerics and eyebrows.

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Type scale uses CSS variables `--fs-xs` (11px) through `--fs-5xl` (48px). Use semantic classes:

```html
<h1 class="shai-h1">Owner Report</h1>     <!-- 36px extrabold -->
<h2 class="shai-h2">Portfolio Overview</h2><!-- 28px extrabold -->
<h3 class="shai-h3">This Period</h3>      <!-- 22px bold -->
<h4 class="shai-h4">Section heading</h4>  <!-- 18px semibold -->
<div class="shai-eyebrow">May 2025</div>  <!-- 11px mono pink uppercase -->
<p class="shai-tagline">Subdued helper text.</p>
```

---

## Spacing scale

4px base. Use the variables — never magic numbers:

```css
--space-1: 4px    --space-2: 8px    --space-3: 12px
--space-4: 16px   --space-5: 20px   --space-6: 24px
--space-8: 32px   --space-10: 40px  --space-12: 48px
```

Default rhythm: components separated by `--space-4`, sections by `--space-8`.

---

## Layout primitives

```html
<!-- Page container — max 1280px, gutters built in -->
<div class="shai-container"> ... </div>

<!-- Vertical stacks with consistent gap -->
<div class="shai-stack">    <!-- 16px gap -->
<div class="shai-stack-lg"> <!-- 32px gap -->

<!-- Standard KPI grids -->
<div class="shai-grid-4">   <!-- 4 cols, collapses to 2 then 1 -->
<div class="shai-grid-3">
<div class="shai-grid-2">
<div class="shai-grid">     <!-- responsive auto-fill, min 220px -->
```

---

## SHAI Header (top navigation)

The unified top nav. Drop this on every page:

```html
<header class="shai-header">
  <div class="shai-header-inner">
    <a class="shai-brand" href="/">
      <img class="shai-brand-logo" src="/brand/shai-banner.png" alt="SHAI — Superhost Hospitality AI" />
      <span class="shai-brand-sub">Superhost Hospitality AI</span>
    </a>
    <nav class="shai-nav">
      <a class="shai-nav-item active" href="/dashboard.html">Overview</a>
      <a class="shai-nav-item" href="/team.html">Executive Team</a>
      <a class="shai-nav-item" href="/owner.html">Owner Portal</a>
    </nav>
    <div class="shai-header-actions">
      <button class="shai-btn shai-btn-outline shai-btn-sm">Export</button>
    </div>
  </div>
</header>
```

Active tab gets pink underline (built into `.shai-nav-item.active`).

---

## Cards

```html
<div class="shai-card">…</div>          <!-- default — 20px pad, subtle shadow -->
<div class="shai-card shai-card-tight">  <!-- 16px pad -->
<div class="shai-card shai-card-loose">  <!-- 24px pad -->
<div class="shai-card shai-card-flat">   <!-- no shadow, just border -->
```

---

## KPI Tile (Total Revenue, NOI, Occupancy, RevPAR, etc.)

```html
<div class="shai-kpi">
  <div class="shai-kpi-label">Total Revenue</div>
  <div class="shai-kpi-value">$126.8M</div>
  <div class="shai-kpi-delta up">8.4% vs LY</div>
</div>
```

`up | down | warn` on `.shai-kpi-delta` toggles color and arrow.

The 4-tile dashboard pattern:

```html
<div class="shai-grid-4">
  <div class="shai-kpi">…Total Revenue…</div>
  <div class="shai-kpi">…Total NOI…</div>
  <div class="shai-kpi">…Occupancy…</div>
  <div class="shai-kpi">…RevPAR…</div>
</div>
```

---

## Buttons

```html
<button class="shai-btn shai-btn-primary">Run Scan</button>
<button class="shai-btn shai-btn-accent">Generate Report</button>
<button class="shai-btn shai-btn-outline">Export</button>
<button class="shai-btn shai-btn-ghost">Cancel</button>
```

Sizes: `shai-btn-sm` and `shai-btn-lg` modifiers.

**Usage rule:** one primary action per view. Use accent (pink) only for the single most important "publish/send/generate" action. Outline for secondary, ghost for tertiary.

---

## Badges / pills

```html
<span class="shai-badge">Status</span>
<span class="shai-badge pink">Live</span>
<span class="shai-badge blue">New</span>
<span class="shai-badge up">Beat plan</span>
<span class="shai-badge down">Off plan</span>
<span class="shai-badge warn">Watch</span>
```

---

## Owner Report Cover

```html
<div class="shai-report-cover">
  <img class="brand-mark" src="/brand/shai-logo-primary-dark.svg" alt="SHAI" />
  <h1 class="report-title">Owner Report</h1>
  <div class="report-period">May 2025</div>
  <p class="report-tagline">Performance. Insight. Intelligence.</p>
</div>
```

---

## Presentation Title Slide

```html
<section class="shai-title-slide">
  <img class="brand-mark" src="/brand/shai-logo-primary-dark.svg" alt="SHAI" style="height:36px" />
  <h1 class="title-text">Intelligence.<br>Performance.<br>Results.</h1>
  <div class="title-subtitle">AI-Powered Hospitality Intelligence Platform</div>
  <div class="title-footer">Proprietary. Private. Powerful.</div>
</section>
```

---

## Brand assets

| Asset | Path | When |
|---|---|---|
| Primary logo (dark bg) | `/brand/shai-logo-primary-dark.svg` | Headers on navy, dark cockpits |
| Logo (light bg) | `/brand/shai-logo-light-background.svg` | Light surfaces, light theme |
| Icon monogram (A) | `/brand/shai-icon-monogram.svg` | Favicons, avatars, small slots |
| Favicon ICO | `/brand/shai-icon-monogram.ico` | `<link rel="icon">` for desktop shortcuts |
| Reference mockups | `/brand/individual/` | Numbered PNGs — design reference, do not embed |

Use SVG everywhere a vector is acceptable. PNG only if the renderer can't handle SVG.

---

## What NOT to do

- ✗ Don't introduce new colors. If a need arises, propose adding a token here first.
- ✗ Don't use pink or blue as a flat fill on large surfaces (full-width
  background, body wallpaper). Accent layer only — use the brand gradient
  for buttons, rails, glows, and eyebrows. The Aurora shader on splash /
  teaser bookends is the *one* exception, and it's a controlled animated
  surface, not a flat fill.
- ✗ Don't use brand colors to mean "good" or "bad" on a number. Status
  colors (green / red / amber) own the data layer; pink + blue own the
  brand layer. Mixing them means a KPI is lying about whether it beat plan.
- ✗ Don't override `--shai-*` tokens — these are brand-locked.
- ✗ Don't reach for a custom gradient. Use `--brand-gradient` (90deg) or
  `--brand-gradient-135` (diagonal). New angles or stops introduce drift
  across surfaces — keep the gradient consistent so it reads as "the brand"
  not "a designer's choice."
- ✗ Don't add bespoke animations beyond `--t-fast` / `--t-base`. SHAI is
  calm SaaS, not a marketing landing. The brand shimmer (`shaiBrandShimmer`)
  is the one approved animation; reserve it for loading bars and the
  occasional hero CTA — never on body content.
- ✗ Don't introduce a third font. Inter + JetBrains Mono.
- ✗ Don't put more than one primary button on a page.

---

## Versioning

When the design system changes:
1. Bump the version comment in `shai-theme.css`
2. Update the relevant section here
3. Note breaking changes in a `Migration` section at the top

Breaking changes that require migration: removing a token, removing a class, changing a class semantically. Adding tokens or new classes is non-breaking.
