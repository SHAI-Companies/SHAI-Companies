# Workflow: Deal Pipeline

**Cadence**: Per inbound deal. Weekly aggregate review.

## Sequence (per deal)

1. **On broker intro or OM arrival** → `development/deal-screener` runs six-stage framework
2. **If Go or Conditional Go** → `development/loi-drafter` drafts LOI
3. **If LOI accepted** → `development/opening-checklist` begins T-minus tracking
4. **All deals continuously** → `development/pipeline-tracker` weekly aggregate

## Human gates
- Deal Memo verdict → Chris approves to proceed to LOI
- LOI → legal counsel review before send
- PSA → counsel drafted
- Close → full closing team

## Exit criteria (per deal stage)
- Closed: property moves to active portfolio; opening-checklist runs to completion; new property added to `shared/context/portfolio.md`
