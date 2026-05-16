# Vendor API Integration Requests

Brief that accompanies API access requests sent to STR and Hotel Effectiveness. Update as we iterate. The goal is to replace manual data entry with vendor API pulls into the SHAI Hub.

---

## Background

Superhost Hospitality operates an internal hospitality intelligence platform (SHAI Hub) that pulls financial data from ProfitSword, normalizes it across 17 active branded properties, and feeds it to executive cockpits, agent skills, and the Property Score Card (PSC) used for portfolio review and owner reporting.

Currently STR comp-set data and Hotel Effectiveness labor data are entered manually or imported via CSV. Both are bottlenecks. We want to automate.

**Architecture:** SHAI Hub is a Node.js server, runs on internal infrastructure, polls vendor APIs on a fixed schedule (similar to how it currently polls ProfitSword every 4 hours). All data normalizes into a JSON store and is served to internal dashboards. Server-side only — no client-side calls to vendor APIs, no exposed keys.

**Auth preference:** API key over service-account credentials, scoped to read-only access for our portfolio.

**Output preference:** JSON. We normalize internally, so format isn't critical, but JSON is the cleanest fit.

**Scale:** 17 active properties. Polling 1× daily is sufficient. Weekly is acceptable for STR.

---

## STR — Required Fields

Per property, per period (monthly minimum, weekly preferred):

| Field | Notes |
|---|---|
| `revparIndex` (RGI) | Standard STAR Report metric |
| `occIndex` | |
| `adrIndex` | |
| `compSetOccPct` | Comp set occupancy |
| `compSetADR` | Comp set ADR |
| `compSetRevPAR` | Comp set RevPAR |
| `myRank` | Property's rank within comp set |
| `compSetSize` | Number of properties in comp set |
| `period` | YYYY-MM (and YYYY-WW for weekly) |
| `propertyId` | STR ChainID / HotelID |

**Historical depth requested:** 24 months (so we can compute YoY index changes for the PSC).

**Properties:** 17 total. List with brand, location, and our internal ID will be provided. STR ChainID/HotelID for each will need to be confirmed with STR's account team.

---

## M3 (Accounting / GL) — Required Fields

**Why:** SHAI Hub Tier 2 (Balance Sheet) and Tier 3 (General Ledger) require General Ledger data, which lives in M3 — not ProfitSword. Without M3 API access, those tabs fall back to manual entry per property × period, which doesn't scale.

**What we want:** Balance Sheet and Trial Balance API access for our 17 properties. Tier 3 (full GL transaction detail) is a follow-up — Tier 2 gets us 80% of value.

| Field | Tier 2 (BS) | Tier 3 (GL) | Notes |
|---|---|---|---|
| `entityId` (property) | ✓ | ✓ | M3 entity ID per hotel |
| `asOfDate` | ✓ | | End-of-period balance sheet date |
| Account-level balances | ✓ | ✓ | Mapped to USGL chart of accounts |
| Cash & Equivalents | ✓ | | |
| AR / AP | ✓ | | Aging optional but valuable |
| Property & Equipment (net) | ✓ | | Including accumulated depreciation |
| Long-term debt | ✓ | | Current portion + LTD split |
| Owner Capital / Retained Earnings / Current Year Income | ✓ | | |
| Trial Balance by account | | ✓ | |
| Journal entry detail | | ✓ | Date, account, description, debit/credit, source |
| `propertyId` mapping | ✓ | ✓ | We need M3 entity IDs for our 17 properties |

**Historical depth:** 24 months for trend analysis.

**Polling:** Once daily is sufficient for BS (point-in-time at period close). GL detail likely on-demand only.

**Integration architecture:** SHAI Hub server-side polling, read-only API key auth, JSON output, no client-side credential exposure. Connector module already scaffolded at [`shared/connectors/m3.js`](../shared/connectors/m3.js) — once API access is provisioned, fill in the three placeholder functions.

**Acceptance criteria:**
1. Confirm M3 API access is available for our subscription tier and provide pricing
2. Sandbox endpoint to validate field mappings before production
3. List of M3 entity IDs for our 17 properties so we can map them to our internal IDs
4. Documentation for the Balance Sheet and Trial Balance endpoints
5. Auth method (API key vs OAuth client_id/secret) and rate limit confirmed

---

## Hotel Effectiveness — Required Fields

Per property, per day or per week (whichever is the native granularity):

| Field | Notes |
|---|---|
| `totalHours` | Total labor hours worked |
| `totalLaborCost` | Total labor $ |
| `cpor` | Cost per occupied room |
| `hpor` | Hours per occupied room |
| `roomsCPOR` | CPOR for Rooms department |
| `fbCPOR` | CPOR for F&B department |
| `agCPOR` | CPOR for A&G department |
| `otPct` | Overtime % of total hours |
| `otCost` | Overtime $ |
| `fteCount` | FTE headcount |
| `laborPctOfRev` | Labor as % of revenue |
| `forecastSchedule` | Forward-week schedule hours, if available |
| `period` | Date or week-ending date |
| `propertyId` | HE site identifier |

**Historical depth requested:** 13 months (current + prior year for trend).

**Properties:** 17 total. HE site identifiers will be confirmed with our HE CSM.

---

## Acceptance Criteria

We are ready to integrate when we have:

1. API base URL + auth method + sandbox or test endpoint
2. API key issued and scoped to our portfolio (read-only)
3. Documentation for the endpoints covering the fields above
4. Rate limit confirmed (we expect to call once per day per property; well below any commercial threshold)
5. Pricing confirmed in writing (STR — assume this is a paid add-on)
6. ETA on access provisioning

---

## Contacts

- **Internal lead:** Chris Chatfield, Superhost Hospitality (chatfield@superhosthospitality.com)
- **STR account contact:** _TBD — fill in when known_
- **Hotel Effectiveness CSM:** _TBD — fill in when known_
