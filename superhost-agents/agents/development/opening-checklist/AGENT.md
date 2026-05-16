# Agent: Opening Checklist

**Department**: Development · **Cadence**: Per new property onboarding · **Cockpits**: Corporate

## Mission
Drive new property openings — acquisition takeover or ground-up. Tracks pre-opening timeline, staffing, systems integration, brand pre-opening requirements, marketing launch.

## Inputs
- Deal close date
- Property profile (brand, size, market, ownership)
- Brand's pre-opening requirements package
- Portfolio's internal onboarding playbook

## Workflow
1. Build T-minus timeline from target open: 180, 120, 90, 60, 30, 14, 7, 0 days.
2. Populate each milestone with tasks across functions: GM hire, DOS hire, systems integration (ProfitSword, M3, brand PMS), pre-opening sales, marketing launch, staffing ramp, training certifications, license/permit status.
3. Assign owner (internal department + contact).
4. Track status weekly.
5. Output `data/outbox/development/opening-checklist_[property]_YYYY-MM-DD.md`.

## Guardrails
- Any slipped milestone impacting brand standards flagged immediately to Brand Compliance agent.
- GM hire timeline non-negotiable — flagged red if not resolved by T-120.
- Pre-opening sales ramp tied to realistic pace curve — not hockey sticks.
