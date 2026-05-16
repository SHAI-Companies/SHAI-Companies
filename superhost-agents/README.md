# Superhost Hospitality — Management Company Agent Platform

27 specialized agents across 7 departments, organized by function, role, and workflow. Built for corporate teams — Chris, RDOs, RSMs — with expansion paths to GMs, DOS/DOSM, and owners when earned.

## The model

**Three dimensions of organization:**

- **By function** — `agents/[department]/[agent]/` — Operations, Revenue, Sales, Finance, People, Brand, Development
- **By role** — `cockpits/[role]/` — Corporate, RDO, RSM (v1 users)
- **By workflow** — `shared/workflows/` — Daily ops, monthly close, deal pipeline, crisis response

An agent belongs to one department. A cockpit pulls agents from multiple departments, role-scoped. A workflow orchestrates agents in sequence.

## The 27 agents

### Operations (5)
| Agent | Cadence |
|---|---|
| portfolio-analyst | Daily |
| forecast-auditor | On submission |
| scorecard-engine | Monthly |
| weekly-ops-review | Weekly |
| crisis-response | On demand (urgent) |

### Revenue (3)
| Agent | Cadence |
|---|---|
| revenue-strategy | Weekly + on demand |
| rate-pace-monitor | Daily |
| displacement-analyst | On demand |

### Sales (4)
| Agent | Cadence |
|---|---|
| group-pace | Weekly |
| grc-watcher | Weekly |
| rsm-performance | Monthly |
| lead-qualifier | On inbound |

### Finance (4)
| Agent | Cadence |
|---|---|
| owner-report-writer | Monthly |
| budget-stress-tester | Annual + reforecast |
| flow-through-analyst | Monthly |
| capex-roi | Quarterly + on demand |

### People (4)
| Agent | Cadence |
|---|---|
| gm-hiring | On active search |
| turnover-diagnostics | Monthly |
| gm-comms-coach | On demand |
| training-compliance | Monthly |

### Brand (3)
| Agent | Cadence |
|---|---|
| brand-compliance | Weekly |
| qa-readiness | Pre-inspection |
| pip-manager | Monthly + on issuance |

### Development (4)
| Agent | Cadence |
|---|---|
| deal-screener | On inbound deal |
| loi-drafter | On deal go-forward |
| opening-checklist | Per new property |
| pipeline-tracker | Weekly |

## Cockpits

- **Corporate** (Chris, Tim Foley as COO) — full visibility, all 27 agents on demand
- **RDO** (Jennifer, Mark) — region-scoped, ops + people + brand focus
- **RSM** (Teresa, Nate) — sales and revenue focus, region-scoped

## First-time setup

```bash
cd superhost-agents
cp .env.example .env
# Fill in ProfitSword key + PORTFOLIO_SITETAGS

python -m venv .venv
source .venv/bin/activate
pip install httpx openpyxl python-dotenv

# Start ProfitSword CORS proxy (from Executive Ops Hub build)
node proxy/profitsword-proxy.js &

# Launch Claude Code
claude
```

## Invoking agents

From inside Claude Code:

```
> Run daily-ops workflow for today.

> Run operations/portfolio-analyst for yesterday, corporate version.

> Run operations/portfolio-analyst for yesterday, RDO version for Jennifer.

> Run finance/owner-report-writer for March close, Lakhany group only.

> Run sales/group-pace for this week, RSM version for Teresa.

> Run development/deal-screener on data/inbox/deals/lexington-marriott-om.pdf.

> Run crisis-response — incident at Home2 Hamburg, guest slip-and-fall in pool.

> Run people/gm-comms-coach — Mark's region, DOS at Hampton Louisville, PIP kickoff.
```

## File flow

```
data/inbox/
├── forecasts/          GM forecast submissions
├── budgets/            Annual budget submissions
├── deals/              Broker OMs, T-12s, management agreements
├── sales/
│   ├── leads/          Inbound group leads
│   └── groups/         Displacement requests
├── m3/                 [PROPERTY]_PL_YYYY_MM.csv
├── str/                [PROPERTY]_STR_YYYY-MM-DD.xlsx
├── delphi/             Group pace, GRC, account activity
├── hris/               Roster, terminations, training
├── brand/[flag]/       Brand portal exports, QA, PIP
├── capex/              Capex proposals
└── crisis/             Incident reports

data/outbox/
├── operations/
├── revenue/
├── sales/
├── finance/
├── people/
├── brand/
└── development/
```

## Expansion path (when corporate adoption proven)

Phase 2 — add GM cockpit. Agents available: portfolio-analyst (their property), scorecard-engine (their scorecard), gm-comms-coach (drafting their conversations with department heads).

Phase 3 — add DOS/DOSM cockpit. Sales agents routed to their level.

Phase 4 — add Owner portal. Read-only visibility into owner-report-writer output, with Chris-controlled publication.

## Pairing with the Executive Operations Hub

See the earlier architecture note. Short version: Hub is the cockpit, agents are the engine room, they meet at `data/outbox/`. Add a Briefings panel to the Hub first. Build agent triggers from the Hub in month 2.

## What this platform never does

- Invents numbers
- Softens bad news
- Uses generic hospitality filler
- Auto-sends external communication without human gate
- Drafts termination communication
- Promises audit scores, deal closes, or performance outcomes

## Known limitations

- Delphi and HRIS are CSV-drop for now. Live API integration is phase 2.
- Brand portals mostly manual — plan for RDO or analytics to maintain the upload cadence.
- STR/CoStar exports are weekly emails. Set a Gmail filter to auto-route to `data/inbox/str/`.
- Gmail MCP is already connected — comms-coach agents can reference inbox context if helpful.

## What to do this week

1. Fill `.env` with ProfitSword creds and siteTags
2. Run `operations/portfolio-analyst` manually for yesterday. Validate the output is useful.
3. Run `finance/flow-through-analyst` on last month's close. Validate against what you know.
4. Coordinate with your director of systems and analytics on itemTag validation — every downstream agent inherits those mappings.
5. Pick one more agent to test this week. Don't try to run all 27 at once.
