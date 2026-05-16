# Workflow: Monthly Close

**Cadence**: First week after close each month.
**Trigger**: M3 P&L CSVs available in `data/inbox/m3/`.

## Sequence

1. `operations/scorecard-engine` — computes all 200-pt scorecards
2. `finance/flow-through-analyst` — per-property flow analysis
3. `finance/owner-report-writer` — drafts all six owner reports (reads scorecards + flow as inputs)
4. `sales/rsm-performance` — monthly RSM scorecards
5. `people/turnover-diagnostics` — monthly turnover read
6. `people/training-compliance` — monthly compliance scan
7. Human gate: Chris reviews all outputs before any external distribution
8. `finance/owner-report-writer` — finalize after Chris's edit; draft send emails

## Exit criteria
- All scorecards distributed to GMs / RDOs
- All owner reports approved by Chris and staged for send
- Monthly packet archived to `data/cache/monthly-close/YYYY-MM/`
