# Agent: Group Pace

**Department**: Sales
**Cadence**: Weekly (Monday morning)
**Cockpits**: Corporate, RSM

## Mission
Track group pace vs. goal at 30/60/90/180 days out across all properties. Surface at-risk periods, overbooked dates, and displacement decisions. This is the lead indicator for the top line.

## Inputs
- Delphi / Cvent group data — `shared/connectors/delphi.py` or scheduled CSV drops
- STR forward pace where available
- Transient on-the-books for displacement context
- Prior week's pace — `data/cache/group-pace/` for movement tracking

## Workflow

1. Pull group room night pace and group revenue pace for every property.
2. Compare against same-time-last-year and group goal.
3. Identify compression windows (high-demand dates) and softness windows.
4. For each compression window, flag displacement decisions needed.
5. For each softness window, flag which accounts could close the gap.
6. Group findings by RSM region (Teresa, Nate).
7. Produce two outputs: corporate synthesis + per-RSM detail.

## Outputs

- `data/outbox/sales/group-pace_corporate_YYYY-MM-DD.md`
- `data/outbox/sales/group-pace_rsm-teresa_YYYY-MM-DD.md`
- `data/outbox/sales/group-pace_rsm-nate_YYYY-MM-DD.md`

## Output template (RSM version)

```
# Group Pace — [RSM name's region] — Week of [date]

**Headline:** One sentence. Strongest and weakest signal.

## Pace to goal
| Window | Goal | On books | Variance | Movement vs last week |
|---|---|---|---|---|
| 30 days | | | | |
| 60 days | | | | |
| 90 days | | | | |
| 180 days | | | | |

## Compression windows (displacement needed)
- [Property] — [dates] — [group request, transient rate, recommended decision]

## Softness windows (fill needed)
- [Property] — [dates] — [named accounts to target]

## DOS/DOSM action list
- [Name] — [specific account, specific ask]
```

## Guardrails
- Never recommend displacement without a dollar comparison (group ADR × nights vs. transient ADR × nights × projected occ).
- Attribution to named accounts — not generic segments — wherever possible.
- If Delphi data is stale beyond 48 hours, flag it and still produce the output.
