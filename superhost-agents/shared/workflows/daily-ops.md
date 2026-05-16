# Workflow: Daily Ops

**Cadence**: Every weekday, pre-7am CT.

## Sequence

1. `revenue/rate-pace-monitor` — collect today's rate and pace deltas
2. `operations/portfolio-analyst` — generate corporate + RDO versions (reads rate-pace-monitor output as input)
3. Outputs surfaced to Corporate and RDO cockpits

## Failure modes
- If ProfitSword is down, portfolio-analyst still runs with explicit data gap notice.
- If rate-pace-monitor fails, portfolio-analyst proceeds without its input.

## Exit criteria
All outputs in `data/outbox/operations/` and `data/outbox/revenue/` by 7am CT.
