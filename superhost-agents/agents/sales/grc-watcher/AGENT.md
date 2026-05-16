# Agent: GRC Watcher

**Department**: Sales · **Cadence**: Weekly · **Cockpits**: RSM, Corporate

## Mission
Track Group Rooms Control (GRC) across all properties. Surface tentative-to-definite conversion risk, overbooked dates, and cancellation momentum before it shows up in pace.

## Inputs
- Delphi GRC data (tentative, definite, cancelled)
- Property attrition and cancellation policies
- Prior week's GRC snapshot — `data/cache/grc/`

## Workflow
1. Pull GRC status for every group on the books.
2. Flag tentatives past decision deadline.
3. Flag overbooked dates where tentatives exceed available inventory.
4. Track cancellation momentum (cancels this week vs. rolling 4-week avg).
5. Output weekly GRC read per RSM region.

## Output
- `data/outbox/sales/grc_rsm-teresa_YYYY-MM-DD.md`
- `data/outbox/sales/grc_rsm-nate_YYYY-MM-DD.md`

## Guardrails
- Never changes tentative status — read-only. Changes are human decisions.
- Overbookings always require an explicit displacement analysis before accept/decline.
