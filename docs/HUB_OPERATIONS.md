# SHAI Hub — Operations & Runtime Notes

Living document. When something operational has tripped us up and we figured it out, write it here so we don't rediscover it next time.

---

## Platform opening sequence — splash → dashboard → executive team

Visiting `/` serves `public/splash.html`, which runs a three-stage opening
sequence over 12 seconds and then auto-redirects to `/dashboard.html`.

| Stage | Time | What renders |
|---|---|---|
| 1 — Brand reveal | 0 – 4 s | SHAI logo + "SUPERHOST HOSPITALITY AI" tagline (centered) over the Aurora Drift WebGL shader |
| 2 — Dashboard preview | 4 – 8 s | Logo demotes to top-center; 4 KPI tiles render with eyebrow "Portfolio Intelligence" + tagline "Live operating numbers · 17 hotels · One pane" |
| 3 — Executive team preview | 8 – 12 s | Same demoted logo; 7 persona avatars (CEO / COO Tim Foley / CFO / Chief Development / Chief Investment / VP RM / GC) with eyebrow "Your Executive Team" + tagline "Strategic deliberation · Owner-grade output" |
| Redirect | 12 s | `/dashboard.html` |

Skip controls (always available):
- **Esc** — abort the auto-redirect; the user stays on the splash
- **Enter** or click "Enter Dashboard" button — skip remaining stages, redirect immediately
- The progress bar at the bottom tracks total elapsed across all three stages
- The "launching" status text updates per stage: Initializing →
  Loading portfolio → Loading executive team → Launching dashboard

Stage timing is hard-coded as constants near the top of the splash IIFE:

```js
const STAGE1_END_MS = 4000;
const STAGE2_END_MS = 8000;
const STAGE3_END_MS = 12000;
```

To extend or shorten the opening, edit those three numbers. Each stage's
content lives in a `<div class="stage-N">` block; toggling `body.stage-2` /
`body.stage-3` cross-fades them on top of the persistent Aurora canvas.

**Clip mode (`?clip`)** — used by the teaser at `public/teaser.html` to
embed the splash as a full-bleed bookend scene — explicitly skips ALL
stage progression and the auto-redirect. The CSS hides `.stage-2` and
`.stage-3` outright and JS doesn't call `startProgress()`. Stage 1 (the
brand reveal) holds indefinitely. This is what makes the teaser's cold
open and closer scenes work without breaking either the splash or the
teaser when one is edited.

---

## Auto-start on logon — Windows scheduled task

**Task name:** `SHAI-Hub-AutoStart`
**Trigger:** at user logon for `CHATFIELD\Owner`
**Wrapper:** `C:\Users\Owner\Superhost Hub\tools-start-hub.ps1`
**Install/uninstall:** `tools-install-autostart.ps1`
**Log:** `C:\Users\Owner\Superhost Hub\hub.log` (rolling, append-only)

### CRITICAL: the wrapper must spawn node DETACHED

**Symptom:** `LastTaskResult: 0` (success), boot banner appears in `hub.log`, then nothing. `Get-Process node` returns empty. Port 3000 isn't listening. The dashboard won't load.

**Cause:** Windows scheduled tasks create a job object containing all child processes. When the wrapper PowerShell script exits — even cleanly — Windows terminates EVERY process in that job, including the node server. The original wrapper used `& npm start *>> 'hub.log'` which kept the wrapper alive while npm ran, but for reasons that aren't fully clear, npm/cmd would sometimes return early on Windows, the wrapper would exit, and Windows would reap the node child.

**Fix:** Use WMI `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` to spawn node. WMI launches the new process under `svchost` as parent — orphaning it from the task's job object. The wrapper exits cleanly, `LastTaskResult: 0`, but node keeps running in the background.

**The wrapper that works (`tools-start-hub.ps1`):**

```powershell
$HubDir  = 'C:\Users\Owner\Superhost Hub'
$LogPath = Join-Path $HubDir 'hub.log'
Set-Location -Path $HubDir
$ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
Add-Content -Path $LogPath -Value "`n[$ts] === SHAI Hub auto-start ==="

# Skip if already running
$inUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    Add-Content -Path $LogPath -Value "[$ts] Port 3000 already in use - skipping."
    exit 0
}

# Spawn detached via WMI
$cmdLine = 'cmd.exe /c node server.js >> "' + $LogPath + '" 2>&1'
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine      = $cmdLine
    CurrentDirectory = $HubDir
}

if ($result.ReturnValue -eq 0) {
    Add-Content -Path $LogPath -Value "[$ts] Spawned hub PID $($result.ProcessId) (detached). Wrapper exiting cleanly."
} else {
    Add-Content -Path $LogPath -Value "[$ts] FAILED to spawn hub. Code $($result.ReturnValue)."
}
exit 0
```

**Anti-patterns that fail in scheduled tasks:**
- `& npm start *>> 'hub.log'` — gets killed when wrapper's job is reaped
- `Start-Process npm -ArgumentList 'start'` — same problem; child still in task's job
- `cmd /c start /B node server.js` — `/B` doesn't reliably escape the job object

**The pattern that works:**
- `Invoke-CimMethod Win32_Process Create` — WMI launches via svchost, fully detaches
- `Start-Process node -ArgumentList 'server.js' -WindowStyle Hidden` *might* work but unverified — WMI is the proven path

---

## Auto-refresh schedule (ProfitSword)

Daily at fixed local-time slots, anchored to 6:30 AM:
**02:30, 06:30, 10:30, 14:30, 18:30, 22:30** — every 4 hours.

Logic in `server.js` under "AUTO-REFRESH" section:
- `nextRefreshAt()` finds the earliest future slot
- After each refresh fires, the next one is rescheduled — no drift
- If the server is stopped between slots, refreshes resume at the next future slot (no make-up runs)

**Where this fires:** `setTimeout` inside the running node process. If node dies, the schedule dies. The auto-start task brings node back at next logon.

**Force a manual refresh** (between scheduled slots): hit the **Refresh** button on the dashboard or `POST /api/ps/refresh-all`.

---

## Restart procedures

### Clean restart (after `server.js` edits, persona changes, etc.)

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-ScheduledTask -TaskName SHAI-Hub-AutoStart
```

The wrapper sees port 3000 free, spawns a fresh detached node. Hub is back in ~5 seconds.

### Hub is unresponsive

```powershell
Stop-ScheduledTask -TaskName SHAI-Hub-AutoStart -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName SHAI-Hub-AutoStart
Start-Sleep -Seconds 6
Invoke-WebRequest -Uri http://localhost:3000/dashboard.html -UseBasicParsing | Select-Object StatusCode
```

Should return `200`.

### Reinstall the auto-start task (if the wrapper itself needs updating)

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Owner\Superhost Hub\tools-install-autostart.ps1"
```

Re-runnable. Replaces the existing task safely. To uninstall:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Owner\Superhost Hub\tools-install-autostart.ps1" -Uninstall
```

---

## Diagnostic commands

### Is the hub up?
```powershell
Invoke-WebRequest -Uri http://localhost:3000/dashboard.html -UseBasicParsing | Select-Object StatusCode
```
- `200` → up
- "Unable to connect" → down

### What's running?
```powershell
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, StartTime, CPU
```

Healthy state: 1 node process. Multiple = either V8 workers (normal) or zombies from prior sessions (cleanup with `Stop-Process -Force`).

### When did the task last run? Did it succeed?
```powershell
Get-ScheduledTaskInfo -TaskName SHAI-Hub-AutoStart | Select-Object LastRunTime, LastTaskResult, NextRunTime
```

`LastTaskResult: 0` = wrapper exited cleanly. **This does NOT mean node is still running** — only that the wrapper finished. Always cross-check with `Get-Process node` and `Invoke-WebRequest`.

### Watch the log live
```powershell
Get-Content "C:\Users\Owner\Superhost Hub\hub.log" -Wait -Tail 30
```

Shows last 30 lines + tails new ones as they arrive. Ctrl+C to exit.

### Tail just the latest run
```powershell
Get-Content "C:\Users\Owner\Superhost Hub\hub.log" -Tail 30
```

### Port collision check
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess
```

Empty result = port free. One row = something is listening (the OwningProcess PID tells you what — cross-reference with `Get-Process -Id <PID>`).

**Note:** `Get-NetTCPConnection` errors with "No matching MSFT_NetTCPConnection objects found" when there's nothing on the port. That's the documented behavior; the `-ErrorAction SilentlyContinue` flag suppresses the noisy error message. Use `Invoke-WebRequest` as the truer "is the hub reachable" test.

---

## PowerShell paste gotcha

When pasting multiple commands into PowerShell, **each command must be on its own line OR separated by `;`**. Pasting two commands on the same line concatenates them and PowerShell interprets the result as a malformed single command:

```
Stop-ScheduledTask -TaskName XStart-ScheduledTask -TaskName Y
                            ^^ commands jammed → "TaskName specified twice" error
```

Safe one-liner pattern:
```powershell
Stop-ScheduledTask -TaskName SHAI-Hub-AutoStart -ErrorAction SilentlyContinue; Start-ScheduledTask -TaskName SHAI-Hub-AutoStart
```

---

## File map (what lives where)

| Path | Purpose |
|---|---|
| `C:\Users\Owner\Superhost Hub\` | Hub root |
| `…\server.js` | Node server entrypoint |
| `…\data.json` | Runtime store (decisions, actions, watchlist, owner profiles, GM bench, scans, councils, persona memory references) |
| `…\config.json` | ProfitSword creds, AI key, active period, tag map |
| `…\hub.log` | Server stdout/stderr (append-only, all auto-refresh activity here) |
| `…\public\` | Static web assets — dashboard.html, team.html, owner.html, splash.html, brand assets |
| `…\public\styles\shai-theme.css` | SHAI design system tokens, components |
| `…\public\styles\shai-cockpit-overrides.css` | Dark/light theme overrides for cockpit pages |
| `…\public\brand\` | SHAI logo SVGs, ICO, banner PNG, individual reference assets |
| `…\superhost-agents\personas\` | 24 persona MD files (system prompts) |
| `…\superhost-agents\skills\` | Per-skill SKILL.md (loaded on `[SKILL: id]` tag) |
| `…\superhost-agents\memory\` | Per-persona memory JSON files (auto-managed) |
| `…\tools-start-hub.ps1` | Auto-start wrapper (uses WMI for detached spawn) |
| `…\tools-install-autostart.ps1` | Re-runnable installer for the scheduled task |
| `…\tools-create-shortcuts.ps1` | Re-runnable creator for desktop `.url` shortcuts |
| `…\docs\` | Docs (this file, design system, etc.) |

---

## Primary Forecast GOP $ — auto-snapshot on 1st of month

The PSC's Forecast Accuracy row benchmarks actual GOP against a **locked-in Primary Forecast GOP $** captured at the start of the month. The variance band is ±5%.

**How the snapshot fires:**
- On every PS refresh, `refreshAllProperties` (server.js) checks each property's `manual.primaryFcGopAmt` for the active period.
- If empty AND the live forecast has a `gopAmt`, it gets locked in. The fields `_primaryFcSnapAt` and `_primaryFcSnapAuto: true` are also written so we can tell auto vs manual snapshots apart.
- Once set, no future refresh overwrites it. The user can override via the Data Entry form (the manual save goes through a merge handler that respects existing keys).

**Practical timing:** the auto-refresh task (`SHAI-Hub-AutoStart`) runs at 02:30 on day 1 of every month. That's the first refresh after the new period rolls over, so the snapshot reflects the "first day of the month" forecast.

**Gotcha — retroactive capture is impossible.** ProfitSword does not version forecasts. If the snapshot logic ships mid-month (or if a property is added mid-month with no prior snapshot), the captured value is "live forecast at the moment of first refresh" — NOT what the forecast actually said on the 1st. There is no way to retrieve the day-1 forecast retroactively. To correct: edit `primaryFcGopAmt` per property manually in the Data Entry tab. That manual entry takes precedence over the auto-snapshot.

**PSC manual fields that survive PS refresh** (defined in `refreshAllProperties` as `PSC_MANUAL_KEYS`):
- Day-1 Primary Forecast snapshot (8 fields): `primaryFcGopAmt` · `primaryFcRevenue` · `primaryFcRoomRev` · `primaryFcOcc` · `primaryFcAdr` · `primaryFcRevpar` · `primaryFcFbRev` · `primaryFcOiRev`
- YTD aggregate: `ytdPrimaryFcGopAmt`
- STR / index: `revparIdx` · `ytdRevparIdx` · `revparIdxBud`
- PSC inputs: `guestScore` · `googleScore` · `aosScore` · `turnover` · `qaPass` · `communityEngagement`

The 8 Day-1 forecast fields feed both PSC Forecast Accuracy AND the Daily Flash dashboard. They auto-snapshot on the first PS refresh of the month where the field is empty; once locked, subsequent refreshes never overwrite. Same retroactive-capture caveat applies to all 8 — if the snapshot logic ships mid-month, captured values are "live forecast at moment of first refresh" not actual day-1 forecast.

If the user enters any of these in the Data Entry form, PS refreshes will not overwrite them. PS-derived defaults are used only when the user has not entered a value.

**Don't replace `manual` on save — merge it.** Both `PUT /api/properties/:id/data` and `POST /api/properties/bulk-save` were originally replacing `manual` with the request body. That nukes any field not in the partial form save (including the auto-snapshotted Primary Fc). Both handlers now merge: `manual: { ...existing.manual, ...incoming }`. Don't regress this.

---

## Auto-refresh always uses the actual calendar month (not config.activePeriod)

**The bug:** `autoRefresh()` in server.js originally read `config.activePeriod` to choose which month to pull. Because `config.json` had a static value (`"2026-04"`), the auto-refresh kept hitting April even after May 1 arrived. May data was orphaned — nothing refreshed it until a user manually selected May in the dashboard, at which point the client-side period switch triggered a background pull.

**Symptom:** dashboard shows yesterday's numbers despite the auto-refresh task running on schedule (`Get-ScheduledTaskInfo` shows `LastTaskResult: 0`). The task IS running, but it's refreshing the wrong period.

**Fix (already in place):** two layers of defense.
1. `loadConfig()` (server.js) now dynamically overrides `cfg.activePeriod = currentPeriod()` on every read — so any code path that relies on `config.activePeriod` gets today's month, not whatever's in the file.
2. `autoRefresh()` (server.js) now calls `currentPeriod()` directly instead of reading from config — explicit, no fallback ambiguity.

**Operational rule:** never hardcode period values in code or config that are expected to "roll forward." Always derive from `currentPeriod()` or pass period explicitly via API request body.

**Detection:** if the dashboard data feels stale, hit `Get-ScheduledTaskInfo -TaskName SHAI-Hub-AutoStart` and `Get-Content "C:\Users\Owner\Superhost Hub\hub.log" -Tail 50 | Select-String "Auto-Refresh"`. The log lines show what period each scheduled run targeted. If they all say `2026-04` while it's May, this regression is back.

---

## STR Comp Set data — auto-derived from ProfitSword

STR pipes comp set data into ProfitSword. We pull it from PS, no separate STR API integration needed. Saves $200-500/property/year in STR API access fees.

**PS tags consumed** (in actuals dataset):
- `COMPPRP` (Competitive Set – Property Data) — `stat` = STR-reported occupied rooms for my property; `amt` = STR-reported room revenue
- `COMPSET` (Competitive Set) — `stat` = comp set average occupied rooms (per-property normalized); `amt` = comp set average room revenue
- `RMAVL` — my available rooms (used as the denominator for both my rates and comp rates per STR's share methodology)

**Derivation in `extractMetrics`** (server.js):
```
my_occ%     = COMPPRP.stat / RMAVL × 100
my_adr      = COMPPRP.amt / COMPPRP.stat
my_revpar   = COMPPRP.amt / RMAVL
comp_occ%   = COMPSET.stat / RMAVL × 100
comp_adr    = COMPSET.amt / COMPSET.stat
comp_revpar = COMPSET.amt / RMAVL
MPI = my_occ / comp_occ × 100
ARI = my_adr / comp_adr × 100
RGI = my_revpar / comp_revpar × 100
```

Output written to `data.byPeriod[period][propId].str` with fields: `occIdx`, `adrIdx`, `revparIdx`, `myOcc`, `myAdr`, `myRevpar`, `compOcc`, `compAdr`, `compRevpar`, plus `source: 'profitsword'` and `pulledAt` timestamp. Existing dashboard STR Comp Set table and PSC RevPAR Index row pick this up automatically.

**Manual override:** if a user enters STR data via the dashboard's STR import flow (CSV paste or per-property modal), the entry is flagged `source: 'manual'` or `'csv'`. PS-derived auto-fill never overwrites manual entries. To re-enable auto-derive on a property/period, clear the manual STR record.

**Publication lag:** STR publishes data 2-3 weeks after month-end. Current month's STR data won't be available in PS until mid-following-month. Empty `str` records on recent months are expected — they'll auto-populate on the next refresh once STR posts.

**Outlier sanity check:** if a property's RGI is wildly out of normal bounds (above ~125 or below ~75 for select-service), that usually means the comp set assignment in STR is wrong (e.g., a full-service hotel benchmarked against a select-service comp set). Verify the comp set with STR rather than treating the index as a real performance signal.

---

## RevPAR Index targets — bulk import from yearly target sheet

ProfitSword does not feed RevPAR Index targets — they're set by ownership/asset management at the start of each year. We accept them as a pre-built spreadsheet and bulk-import.

**Source format:** the user's "YYYY RevPAR Targets.xlsx" file, sheet named after the year (e.g., `2026`). The "RevPAR INDEX TARGET" section starts at row 2 with property names in column A. Monthly Budget columns are: Jan=3, Feb=5, Mar=7, Apr=11, May=13, Jun=15, Jul=19, Aug=21, Sep=23, Oct=27, Nov=29, Dec=31. Year End Budget = col 35 (the annual avg).

**Importer:** `tools-import-revpar-targets.py` at the hub root. Re-runnable. Reads the xlsx, maps sheet property names to hub IDs via the `NAME_TO_ID` dict, posts each (property × month) to `/api/properties/bulk-save?period=YYYY-MM` with `manual: { revparIdxBud: <value> }`. Server's bulk-save endpoint merges into existing manual data — no other fields touched.

**To run:**
```bash
cd "C:\Users\Owner\Superhost Hub"
python tools-import-revpar-targets.py
```

Confirms `Loaded targets for 17/17 properties` and `204 (property × month) targets imported`.

**For a new year:** edit `XLSX_PATH` in the script (point at the new file) and verify the `NAME_TO_ID` mapping — if you add or rename properties, update the dict. The sheet's first column is the lookup key.

**The PSC consumes these as:**
- MTD: `m.revparIdxBud` (current month's target, picked up automatically by `revIdxTarget`)
- YTD: average of `revparIdxBud` across YTD periods (`revIdxYTDTarget` — computed in `loadMultiPeriodData` via `revparIdxBudSum/revparIdxBudCount`)

**Surviving PS refreshes:** `revparIdxBud` is in `PSC_MANUAL_KEYS` (server.js, `refreshAllProperties`). PS refreshes will not overwrite imported targets. If you need to wipe and re-import for a year, run `tools-import-revpar-targets.py` again — bulk-save merges and the new value wins.

---

## Hotel contact roster — re-runnable xlsx import

Per-property leadership (GM / AGM / DOS), corporate support assignments
(Controller / RDO / RSM / Revenue / Area Ops), ownership (group / contact /
EIN / DBA), property meta (address / phone / website / M3 codes / STR code /
AP email / OTA IDs), and the corporate roster (Tim Foley, Kori Eller, etc.)
all live under `data.contacts` in `data.json`.

**Source of truth:** the live Drive sheet "Hotel Contact List". When that
sheet changes meaningfully, export to xlsx and re-run the importer:

```powershell
# Drop a fresh xlsx in Downloads (default path), then:
cd "C:\Users\Owner\Superhost Hub"
python tools-import-contacts.py            # dry-run — shows the join mapping
python tools-import-contacts.py --apply    # writes data.contacts to data.json
```

The importer joins each sheet row to a hub property by hotel name (with
fuzzy normalization for `&` ↔ `and`, parens like " (1st Floor)", and
ampersand variations). Subset matching is strict — sheet tokens must be
a subset of hub tokens, so "Hampton Inn Denison TX" never gets confused
for "Hampton Inn Suites Schaumburg".

**Sheet rows that don't match a hub property** (other-portfolio hotels,
"Coming Soon" placeholders, "Former Hotels", transitions) get parked in
`data.contacts.unmapped` for visibility — they don't reach the AI snapshot
or the dashboard UI.

**What surfaces where:**
- `/contacts.html` — full browseable page: per-property cards (leadership /
  support / owner / ops handles) + corporate roster table + search filter.
  Reachable from the dashboard header (☎ Contacts button).
- AI snapshot — every persona now sees per-property GM + Owner contact +
  RDO + RSM names in the active-period detail. Full mode adds AGM + DOS +
  Controller + Revenue + AP email per property, plus a `CORPORATE ROSTER`
  section grouped by department.
- API endpoints (read-only):
  `GET /api/contacts` (top-level meta + counts)
  `GET /api/contacts/property/:id` (one property, with support/owner names
   resolved against the corporate roster)
  `GET /api/contacts/all-properties` (bulk for the contacts page)
  `GET /api/contacts/corporate` (flat sorted list)
  `GET /api/contacts/lookup/:nameSlug` (single corporate person by slug)

**Adding a new hub property?** Edit `HUB_PROPERTIES` in
`tools-import-contacts.py` to mirror `getPropertyList()` in `server.js`,
then re-run the importer. The fuzzy matcher will pick up the new row from
the sheet on its next export.

**Edge-case overrides.** If the fuzzy matcher ever maps a sheet row wrong,
edit `MANUAL_CODE_OVERRIDES` in `tools-import-contacts.py` — a one-line
mapping from the sheet's 5-letter CODE to the hub propId. The override
beats the fuzzy match.

**Don't put data.json in git.** It's >90 MB. The importer's atomic write
mirrors the hub's saveData pattern (write `data.json.tmp`, fsync, rename),
so re-running doesn't corrupt mid-write — but you should still avoid
running it during heavy live editing in the dashboard.

---

## YTD aggregation requires all months refreshed

The PSC's YTD columns (and any YTD-aware aggregator) sum `m.revBud`, `m.revenue`, `m.gopAmt`, `m.gopBudAmt`, `m.noiAmt`, `m.noiBudAmt`, etc. across each month of the year. **If a prior month was never refreshed from PS, that month's contribution is zero — silently understating YTD totals.**

**Symptom:** PSC shows a YTD budget that's far less than expected for a property. Spot-check by hitting `/api/properties?period=YYYY-MM` for each YTD month and confirming `manual.revBud` is populated for all of them.

**Cause:** `refreshAllProperties` (and the auto-refresh task) only fetch the **active period**. Prior months remain whatever was last stored — which may be empty if the property was added after that month, or if the active period rolled over before someone hit refresh on the new month.

**Fix — Refresh YTD button** (Admin tab → "⟳ Refresh YTD (all months)"). Hits `POST /api/ps/refresh-ytd?period=YYYY-MM` which iterates Jan through the active month, refreshing every property for every period. 17 properties × 4 months = ~68 PS API calls; completes in 30-60 seconds. Rerun any time you suspect prior-month data is stale.

**Don't auto-fire on every page load** — that's 12× the API traffic at year end. Run YTD refresh manually after onboarding mid-year, after long outages, or as part of a monthly rollover routine.

---

## Daily PTD snapshot collection — feeds the Demand AI daily forecast actuals overlay

`refreshAllProperties` (server.js) writes a per-day cumulative-MTD snapshot to `data.dailyPtd[propId][period][YYYY-MM-DD]` whenever the refresh hits the actual current calendar month. First refresh of a given date wins; later same-day refreshes don't overwrite. Snapshots only capture for `currentPeriod()` — prior-month catch-up refreshes (which fire on day 1-5 of a new month) are skipped, since their `manual.revenue` etc. is the closing total of last month, not today's MTD.

**What's stored per snapshot:**
```
{ revenue, roomRev, roomsSold, roomsAvail, snappedAt }
```
All four metrics are **cumulative MTD** as of the moment the refresh ran. Per-day actual = `snapshot[D+1] - snapshot[D]`. Day 1 special case: no morning-of-day-1 snapshot needed; treat the start as 0.

**Where it's consumed:** the `/api/forecast/demand/:propId/daily` endpoint reads `data.dailyPtd[propId][period]` and overlays per-day actuals onto the past-day rows of Claude's daily forecast. Days with both bracketing snapshots get exact actuals (`actualSource: 'snapshot'`, green ● badge in UI). Days without snapshot pairs get a PTD-scaled back-cast (`actualSource: 'backcast'`, gold ○ badge) — preserves MTD reconciliation but distributes by Claude's day-of-week shape.

**Operational rule:** the auto-refresh task at 02:30 / 06:30 / 10:30 / 14:30 / 18:30 / 22:30 each fires `refreshAllProperties` on the current period. Whichever fires first on a new calendar date seeds that date's snapshot. The 02:30 run is the canonical one. **Don't run a manual refresh in the middle of the night** — you'd seed a bad snapshot for tomorrow with last-night's partial data. (In practice this is hard to do accidentally, but worth noting.)

**Resetting / corruption:** snapshots live under `data.dailyPtd` in `data.json`. To reset for a property+period: delete that subkey in `data.json` (with hub stopped), restart hub. Next refresh re-seeds with current MTD as today's snapshot.

---

## Daily forecast — Claude (Haiku 4.5) endpoint, 4-hour cache, actuals overlay

`POST /api/forecast/demand/:propId/daily` body `{ period, force? }` returns a 28-31 day projection with day-of-week shape, monthly totals, rationale, risks, confidence. Uses `claude-haiku-4-5-20251001` (override `CLAUDE_MODEL_FAST` env var). ~$0.01 per call, ~10–25s wall-clock.

**Cache** (`dailyForecastCache` Map in-process): keyed by `${propId}:${period}`, TTL 4 hours. **Stores RAW Claude output** (no actuals overlay). The actuals overlay re-runs on every request — that way fresh PTD snapshots show through immediately without waiting for cache expiry. Pass `force: true` in the body to bypass the cache entirely (forces a new Claude call, which re-stores).

**Cache lifetime considerations:** node-process memory only. A hub restart clears all daily-forecast cache. That's fine — 17 properties × 12 months = $2 to fully repopulate.

**Back-cast scale guard:** if Claude's forecast for past days is more than 2× off from actual MTD, the back-cast bails (won't distort) and surfaces `backcastWarning` to the UI. Common cause: the model wasn't given fresh enough pace data (auto-refresh hadn't run before the daily forecast was generated). Fix: run a manual `/api/ps/refresh-all` then regenerate the daily forecast.

**JSON output format** — strict schema enforced via the system prompt. If Claude returns non-JSON or wrong day count, the endpoint returns 502 with the raw output preview. Most failures from this come from prompt-injection-y data slipping in or model upgrades changing output style.

---

## Demand AI segment data — ProfitSword pace tags

Forward-period segment $ (Trn / Grp) on the monthly forecast table is **estimated**, not pulled. We use the LY same-month's `forecast.pace.transient` and `forecast.pace.group` to derive a transient % / group % mix, then apply that mix to forecasted revenue (revpar × roomsAvail) to estimate segment $. Tagged `mixSource: 'ly-mix'` per row.

**Fallback** when no LY same-month pace exists (e.g., new property, period gap): use this property's 6 most recent periods with pace data — average mix. Tagged `mixSource: 'recent-avg'`.

**Currentmix KPI card** uses the most-recent stored period with non-zero pace (forecast.pace preferred over manual.pace). Falls back gracefully when neither exists.

**Pace tags pulled by `extractMetrics`** (already in place):
- `TOTPACETRN` → transient pace $
- `TOTPACEGP` → group pace $
- `TOTPACECT` → total confirmed pace $
- `TOTPACECTB` → total pace vs budget
- `TTRPACE` → total revenue pace $
- `PACETRNCON` → transient confirmed rooms count

Stored as `forecast.pace` (when extractMetrics runs against the forecast dataset) and `manual.pace` (when run against actuals).

---

## When in doubt

1. Check `hub.log` first — it almost always tells you what happened
2. Check `Get-Process node` — empty = server is dead
3. Check `Invoke-WebRequest` — that's the real test
4. If anything looks off, the clean restart sequence above usually fixes it

If you find a new operational gotcha, document it here.
