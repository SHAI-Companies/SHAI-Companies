# Executive Operations Hub — architecture brief

How the Hub works, what it exposes, and how the `superhost-agents` Python connector should talk to it.

The Hub lives at `C:\Users\Owner\Superhost Hub\` (the parent of this project). It predates the agent platform and is the system of record for property metadata, financial pulls from ProfitSage, and AI-driven scorecard drafting.

## Server

`server.js` is the active entrypoint. `package.json` declares `"main": "server.js"` and `"start": "node server.js"`. Stack: Node.js / Express 4, with `cors`, `dotenv`, `multer`, `node-fetch`, and `pdf-parse`.

`server_final.js` also exists but is a smaller, older draft (42 KB vs 61 KB) with fewer routes. Treat it as stale — it is not the entrypoint and does not get the env-var fallback added in this migration. See the open item at the end of this doc.

The Hub listens on `process.env.PORT || 3000`. There is no separate proxy process on 3001. Any prior reference to `http://localhost:3001/profitsword` is obsolete.

## Data flow

The Hub proxies ProfitSage (ProfitSword's PMS product) directly over HTTPS to `https://superhost.profitsage.net`. Two upstream endpoints are used:

- `POST /PS-Handlers/token` — auth token exchange
- `GET  /PS-Handlers/api/DataPortalv3/*` — monthly actuals, budget, forecast, sites, datasets

There is no database. Runtime state persists to `data.json` (file-backed). Credentials and non-secret structural config live in `config.json`.

Browsers hit Hub routes like `/api/ps/monthly/:siteTag`; `server.js` fans out to ProfitSage, merges `actuals`/`budget`/`forecast`, and returns JSON. The Hub is itself the "proxy" from the browser's point of view.

## Authentication

Two distinct layers:

**Hub → ProfitSage (upstream):** OAuth2 password grant.

- `psGetToken()` (`server.js:98`) POSTs `grant_type=password&username=…&password=…` to `/PS-Handlers/token`.
- Returned `access_token` is cached in memory with `expires_in` (60-second safety buffer).
- Every downstream call appends `?access_token=…` as a query param (`psRequest()`, `server.js:141`).
- Credentials read from `config.profitsword.username/password` with `process.env.PROFITSAGE_USERNAME/PASSWORD` as fallback (added in this session's credential migration — see `SESSION_NOTES.md`).

**Browser → Hub (downstream):** Optional PIN, via middleware `checkAuth` (`server.js:33`).

- If `process.env.HUB_PIN` is unset, auth is disabled and every `/api/*` route passes through.
- If set, the browser posts the PIN as `x-hub-pin` to `/api/auth`, receives a base64-encoded token back, and sends it on every subsequent request as `x-hub-token`.
- Server compares `req.headers['x-hub-token'] === Buffer.from(pin).toString('base64')`.

No bearer tokens, no API keys. A server-side client (like the Python connector) does not need to call `/api/auth` — it can compute `base64(HUB_PIN)` directly from its own env and set the `x-hub-token` header.

## Property mapping

The 17 managed properties live across two files:

- **`config.json → tagMap`** — maps internal numeric property IDs (1–18, skipping 7 and 19 which are pre-opening) to 3-digit ProfitSage site codes. This is the join table that lets the Hub translate a UI selection into the right ProfitSage lookup. Editable at runtime via `POST /api/config`.
- **`index.html` → hardcoded `properties` array** (~line 857) — authoritative property metadata: name, brand, brand family, state, RDO, RSM, owner, active/comingSoon flags. 19 entries; 17 active.

The agent platform's `.env` has a `PORTFOLIO_SITETAGS` variable meant to hold the 17 3-digit codes as a comma-separated list, sourced from the Hub's `tagMap`.

## Key HTTP routes (server.js)

All under `/api/*`; all pass through `checkAuth` (PIN if configured, pass-through otherwise).

| Route | Method | Purpose |
|---|---|---|
| `/api/auth` | GET | PIN handshake (no auth required) |
| `/api/ps/test` | GET | Upstream ProfitSage connectivity check |
| `/api/ps/sites` | GET | List all sites known to ProfitSage |
| `/api/ps/datasets` | GET | List available data set IDs |
| `/api/ps/monthly/:siteTag` | GET | Pull actuals + budget + forecast for one property |
| `/api/ps/refresh-all` | POST | Pull monthly for every active property |
| `/api/config` | GET/POST | Read / update Hub config (including tagMap) |
| `/api/properties` | GET | Full property list with metadata |
| `/api/periods` | GET | Available reporting periods |

The monthly endpoint is the primary data path for the Python connector.

## Monthly endpoint signature

```
GET /api/ps/monthly/:siteTag
     ?period=YYYY-MM          (optional — defaults to config.activePeriod)
     &dataSetId=…             (optional — overrides actuals dataset)

Response: {
  actuals:  { …MonthlyExtended… },
  budget:   { …MonthlyExtended… },
  forecast: { …MonthlyExtended… }  // may be null
}
```

## Python connector alignment (Path A)

The agent platform's original `shared/connectors/profitsword.py` assumed a standalone proxy design that did not match reality. Three mismatches with the actual Hub:

1. **Port.** Original connector used `http://localhost:3001/profitsword`. The Hub runs on port 3000 and has no proxy on 3001.
2. **Auth shape.** Original connector sent `Authorization: Bearer <PROFITSWORD_API_KEY>`. The Hub has no bearer-token auth; it uses the optional PIN-derived `x-hub-token` header described above.
3. **Endpoint.** Original connector called `GET /daily?siteTag=…&date=…`. The Hub exposes `GET /api/ps/monthly/:siteTag?period=YYYY-MM` — monthly granularity, siteTag as path parameter, period as query.

Path A resolves these by pointing the connector at the Hub rather than building a parallel pipeline. The connector now reads:

- `HUB_BASE_URL` (default `http://localhost:3000`)
- `HUB_PIN` (optional; only sets `x-hub-token` header when non-empty)
- `PORTFOLIO_SITETAGS` (comma-separated 3-digit site codes)

and exposes `get_monthly_performance(site_tag, period=None, data_set_id=None)`, `get_portfolio_monthly(period=None)`, and `health_check()`. See `shared/connectors/profitsword.py`.

## Open item: server_final.js

`server_final.js` is not the declared entrypoint and appears to be an older draft, but it still contains a `psGetToken()` at line 82 that reads `config.profitsword.username/password` directly with no env fallback. With `config.json` credentials now blanked in favor of `.env`, anyone who runs `node server_final.js` will hit `"ProfitSword credentials not configured"` on the first upstream call.

Three resolution options: patch it the same way `server.js:99-100` was patched, delete it, or leave it (it is superseded and nobody should be running it). No decision taken yet.
