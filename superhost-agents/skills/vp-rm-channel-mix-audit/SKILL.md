---
name: vp-rm-channel-mix-audit
description: >
  Use this skill when the VP of Revenue Management needs to audit channel mix across the portfolio (or a single property) and surface the OTA dependency, direct-share gaps, GDS/CRO performance, and corrective rate strategy. Trigger on: "channel mix audit", "OTA dependency", "we're too OTA-heavy", "shift to direct", "GDS check", "channel review for [property]". Output is a tight diagnostic with property-level recommendations and the rate moves to make this week.
---

# VP RM Skill — Channel Mix Audit

OTA dependency creeps. By the time anyone notices, OTA is 32% and we're paying $1.4M/year in commission on revenue we should own. This skill audits channel mix, flags the property-level outliers, and prescribes the rate-tactic moves to start reclaiming direct.

**Hard rule:** OTA isn't bad — *unmanaged* OTA is. The diagnostic separates "intentional OTA" (filling shoulder periods at compressed rate) from "lazy OTA" (paying 18% commission on rate-parity transient that would have come direct).

---

## Inputs

User provides (or pastes):
- Channel mix by property (Direct / Brand.com / OTA / GDS / CRO / Group / Wholesale) — last 90 days
- Booking pace by channel for the next 60 days
- Comp-set rate-parity status if known
- Any recent OTA / brand-CRS contract changes (commission steps, opaque rates, etc.)

Pulled automatically:
- Portfolio snapshot (current period RevPAR, ADR, occupancy)
- Property-level info (brand, owner, comp set positioning if loaded)
- Open watchlist entries

---

## Voice rules

- VP RM voice: granular, data-anchored, willing to pull rate strategy lever this week.
- Always quantify in basis points of GOP impact, not just channel %.
- Distinguish where OTA is doing real work (compression nights, distressed inventory) from where it's parity-cannibalizing direct.
- Brand-mandated CRS isn't optional — but the volume sent through it IS optimizable.
- "Lower BAR floor" is almost never the answer. Identify what to do INSTEAD.

---

## Output structure

### Section 1 — Headline read

One paragraph. Portfolio-level channel mix vs. target bands (or single-property if scoped). Direct % is rising / stable / falling. OTA % is acceptable / creeping / problematic. The single biggest leakage source.

**Target bands (select-service, calibrate for full-service):**
- Direct (Brand.com + property direct): 38–48%
- OTA (Expedia, Booking.com, etc.): 18–25%
- GDS / CRO: 8–14%
- Group: 18–28%
- Wholesale / FIT: < 5%

### Section 2 — Property-level table

| Property | Direct % | OTA % | OTA $ Contrib | OTA Comm $ | Status | Action this week |
|---|---|---|---|---|---|---|

Status options: **HEALTHY** (within bands), **CREEPING** (1 channel out of band), **LEAKING** (2+ out of band, real money at stake).

### Section 3 — Per-property block (LEAKING properties only)

For each LEAKING property:

```
[Property name] — LEAKING
Channel mix: Direct X% · OTA Y% · GDS Z% · Group W%
Last-90-day OTA revenue: $X · Commission paid: $Y (Z% effective)
The pattern: [what's happening — e.g., "OTA is winning weekday transient that books 7-day window at parity rates"]
Diagnosis: [one of: rate-parity-broken / brand.com underconverting / direct-channel-marketing-absent / GDS-shop-failure / promotion-leakage]

Moves this week:
1. [Specific rate / restriction / channel move with day-of-week / arrival-window scope]
2. [Specific direct-channel push — e.g., "Hotel-tonight rate raised; reactivate brand.com mobile promo"]
3. [Measurement — what we'll watch in the next 14 days to know it worked]
```

### Section 4 — Brand.com vs. property-direct read

For each property, are we converting on brand.com or losing to OTA at the search level? Two questions:
- **Look-to-book on brand.com:** known? if not, this is the first thing to instrument.
- **Rate parity vs. OTA:** any property where brand.com is showing higher than OTA? That's a contract-violation flag the brand will help close.

### Section 5 — Group vs. transient displacement

If group is < target band (18–28%), what's the displacement story? If we're below band on group, transient could absorb — but only if RM is opening LOS / removing length-of-stay restrictions on weak weekday arrival days.

If we're above band on group, are we taking $89 group rate that displaces $124 transient? Run the math on top 3 group blocks per property if data is available.

### Section 6 — GDS / CRO performance

Quick read: GDS share by property. Properties with < 6% GDS in BT-heavy markets are leaving corporate-negotiated revenue on the table. Specific check: do we have current corporate-negotiated rate codes loaded?

### Section 7 — Wholesale / FIT cleanup

Any property with > 5% wholesale should be examined. Often wholesale rate codes are old and rate-discipline-breaking. List properties over band; flag for cleanup.

### Section 8 — Track block

```track
{
  "actions": [
    { "title": "Rate move: <specific>", "owner": "DRM <name>", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "decisions": [
    { "title": "OTA exposure cap at <property>", "rationale": "OTA at <X>%, target <Y>%", "recommendedOwner": "VP RM", "dueDate": "YYYY-MM-DD", "propertyId": <id> }
  ],
  "watchlist": [
    { "propertyId": <id>, "reason": "Channel-mix leakage", "metric": "OTA %", "current": "<X>%", "exitCriteria": "OTA back within 18-25% band for 2 consecutive periods" }
  ]
}
```

---

## Hard NOT-to-do list

- Do NOT recommend lowering BAR floor as a fix. It almost never solves channel mix.
- Do NOT recommend disabling an OTA outright. The volume of inquiries we'd lose on visibility-search alone makes that a bad trade.
- Do NOT propose a direct-channel marketing push without naming the cost vs. the saved commission.
- Do NOT name a property as LEAKING without a quantified commission-dollar leakage figure.
- Do NOT confuse "OTA is too high" with "we have a rate-parity problem." They have different fixes.

---

## Anchoring numbers

| Metric | Healthy | Creeping | Leaking |
|---|---|---|---|
| Direct + Brand.com share | 38–48% | 32–37% | < 32% |
| OTA share (select-service) | 18–25% | 26–30% | > 30% |
| OTA share (full-service) | 14–20% | 21–25% | > 25% |
| Effective OTA commission | 14–17% | 18–20% | > 20% |
| Brand.com mobile share | > 25% of brand.com | 18–25% | < 18% |
| GDS share (BT-heavy markets) | 8–14% | 5–7% | < 5% |
| Wholesale | < 4% | 4–6% | > 6% |
