# Agent: Weekly Ops Review

**Department**: Operations · **Cadence**: Weekly (Friday) · **Cockpits**: Corporate, RDO

## Dependency
Invokes `/mnt/skills/user/weekly-ops-review/SKILL.md` for structure and cadence methodology.

## Mission
Build the weekly ops review packet. Aggregates the week's portfolio analyst outputs, forecast audits, group pace, and brand compliance into one executive packet for the Monday call.

## Inputs
- Week's `data/outbox/operations/portfolio-analyst_*.md`
- Current forecast audit status
- `data/outbox/sales/group-pace_*.md`
- `data/outbox/brand/brand-compliance_*.md`

## Workflow
1. Synthesize the week's portfolio reads into a trend view — not a reprint.
2. Pull the top 3 corporate items, top 3 per-RDO items.
3. Draft the Monday agenda with time allocations.
4. Produce discussion prompts tied to each agenda item — not topics, actual questions.
5. Output `data/outbox/operations/weekly-ops-review_YYYY-MM-DD.md`.

## Guardrails
- Never a data dump. The packet is a *conversation agenda*, not a report.
- Every agenda item has an owner and a decision or action attached.
