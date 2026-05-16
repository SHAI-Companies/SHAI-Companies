/**
 * Superhost Executive Hub — Server v3.0
 * New: property notes, STR data, pipeline tracker, period comparison,
 *      brand compliance, generated narratives, PIN auth, email mailto
 */

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const https   = require('https');
const fs      = require('fs');
const fsp     = require('fs/promises');
const path    = require('path');
const multer  = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config();

// ─── DNS: prefer IPv4 (belt-and-suspenders) ────────────────────────────────
// Anthropic (api.anthropic.com) and ProfitSword (Cloudflare-hosted) both publish
// IPv6 AAAA records. On networks where IPv6 is advertised by DNS but the actual
// IPv6 route is broken (common on residential/office networks), Node's default
// lookup tries IPv6 first and the TCP connection silently hangs until the OS
// times out, surfacing as ETIMEDOUT / socket hang up.
//
// Layer 1: setDefaultResultOrder forces lookups to return A records first.
// Layer 2: IPV4_AGENT below is an explicit https.Agent with family: 4 —
//          passed into outbound fetch calls so node-fetch can never choose IPv6
//          even if Layer 1 is bypassed by a library or stale resolver cache.
require('dns').setDefaultResultOrder('ipv4first');
const IPV4_AGENT = new https.Agent({ family: 4, keepAlive: true });

// ─── FILE UPLOADS (for brand audit PDFs) ────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
const upload = multer({ dest: uploadsDir, limits: { fileSize: 20 * 1024 * 1024 } });

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE   = path.join(__dirname, 'data.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ─── BASIC AI RATE LIMITING ────────────────────────────────────────────────
// Anthropic calls are billable. Without a throttle a malicious or buggy client
// with the PIN can fan out unlimited requests. Simple sliding-window counter
// keyed by client IP — no external deps. Default: 60 AI requests / minute / IP.
// Tune via AI_RATE_PER_MINUTE env var. Returns 429 with retry-after on overflow.
const AI_RATE_LIMIT  = parseInt(process.env.AI_RATE_PER_MINUTE || '60', 10);
const AI_RATE_WINDOW = 60 * 1000;
const _aiRateBuckets = new Map(); // ip → [{ts}, {ts}, ...]
function aiRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = _aiRateBuckets.get(ip) || [];
  // Drop entries outside the window
  bucket = bucket.filter(t => now - t < AI_RATE_WINDOW);
  if (bucket.length >= AI_RATE_LIMIT) {
    const oldest = bucket[0];
    const retryMs = AI_RATE_WINDOW - (now - oldest);
    res.set('Retry-After', Math.ceil(retryMs / 1000));
    return res.status(429).json({ error: `AI rate limit (${AI_RATE_LIMIT}/min) — retry in ${Math.ceil(retryMs / 1000)}s` });
  }
  bucket.push(now);
  _aiRateBuckets.set(ip, bucket);
  // Periodic cleanup — drop empty buckets so the Map doesn't grow forever.
  // Cheap because it only fires when the map gets large.
  if (_aiRateBuckets.size > 200) {
    for (const [k, v] of _aiRateBuckets) {
      const trimmed = v.filter(t => now - t < AI_RATE_WINDOW);
      if (trimmed.length === 0) _aiRateBuckets.delete(k);
      else _aiRateBuckets.set(k, trimmed);
    }
  }
  next();
}

// Redirect legacy splash URL (file was renamed Splash Page.html → splash.html)
app.get(['/Splash Page.html', '/Splash%20Page.html'], (req, res) => res.redirect(301, '/splash.html'));

// Root → splash (SHAI-branded landing). The splash auto-redirects to /dashboard.html.
// Direct deep links (/dashboard.html, /team.html, etc.) still bypass and load the page directly.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'splash.html')));

app.use(express.static(path.join(__dirname, 'public')));

// ─── SIMPLE PIN AUTH ────────────────────────────────────────────────────────
// Optional: set HUB_PIN in .env to require PIN on first load
// Frontend stores token in sessionStorage; no PIN = open access
function checkAuth(req, res, next) {
  const pin = process.env.HUB_PIN;
  if (!pin) return next(); // auth disabled
  const tok = req.headers['x-hub-token'];
  if (tok === Buffer.from(pin).toString('base64')) return next();
  res.status(401).json({ error: 'Unauthorized', requiresPin: true });
}
app.get('/api/auth', (req, res) => {
  const pin = process.env.HUB_PIN;
  if (!pin) return res.json({ required: false });
  const provided = req.headers['x-hub-pin'];
  if (provided === pin) {
    res.json({ required: true, token: Buffer.from(pin).toString('base64') });
  } else {
    res.status(401).json({ required: true, error: 'Invalid PIN' });
  }
});

// ─── PERSISTENCE ────────────────────────────────────────────────────────────
// loadData reads data.json synchronously. Cheap when the file is present in
// page cache; cold reads on a 170 MB file take 200-400ms. Most handlers read
// once at the top so it doesn't matter much.
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Data load error:', e); }
  return { byPeriod: {}, alerts: [], notes: {}, pipeline: [], brandCompliance: {}, lastUpdated: null };
}

// saveData hardened against the three audit findings:
//   1. ATOMIC: writes to data.json.tmp, fsyncs, then renames over the real file.
//      A crash/kill mid-write leaves data.json untouched — no partial-write corruption.
//   2. NON-BLOCKING: uses async fs.promises.writeFile so the event loop is free
//      while the 170 MB write hits disk. Callers get a Promise.
//   3. SERIALIZED: a Promise-chain queue ensures concurrent saves run one at a
//      time (no two writers racing on the same temp file). The chain is repaired
//      after errors so a single bad save doesn't lock the queue forever.
//
// API change: saveData() now returns a Promise<void>. Callers that don't await
// still work — the queue serializes regardless — but they lose the chance to
// surface write errors to the response. Best practice: `await saveData(d)`.
//
// CAVEAT: this fixes file-level corruption + event-loop blocking. It does NOT
// eliminate the load-mutate-save race in handlers (handler A reads state,
// awaits something, handler B reads same state, both save). To fully eliminate
// that race the handler patterns need to migrate to a `withDataLock` helper —
// tracked as a P1 follow-up; not in scope for this remediation pass.
let _dataWriteQueue = Promise.resolve();
async function _writeDataAtomic(d) {
  // Drop pretty-print indentation in production — saves ~30% disk on a 170 MB file.
  // Set DATA_PRETTY=1 in env if you want human-readable output for debugging.
  const indent = process.env.DATA_PRETTY === '1' ? 2 : 0;
  const json = JSON.stringify(d, null, indent);
  const tmpPath = DATA_FILE + '.tmp';
  const fh = await fsp.open(tmpPath, 'w');
  try {
    await fh.writeFile(json);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fsp.rename(tmpPath, DATA_FILE);
}
function saveData(d) {
  // Snapshot now — caller may keep mutating after the call returns. Without this,
  // if writes back up in the queue, a later mutation could leak into an earlier save.
  const snapshot = JSON.parse(JSON.stringify(d));
  const next = _dataWriteQueue.then(() => _writeDataAtomic(snapshot));
  // Repair the chain on error so one failure doesn't poison every future write.
  _dataWriteQueue = next.catch(err => {
    console.error('[saveData] write failed:', err.message);
  });
  return next;
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
function loadConfig() {
  let cfg;
  try {
    if (fs.existsSync(CONFIG_FILE)) cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  if (!cfg) {
    cfg = {
      profitsword: { username: '', password: '', dataSetId: '1', baseUrl: 'https://superhost.profitsage.net' },
      groqKey: process.env.GROQ_API_KEY || '',
      activePeriod: currentPeriod(),
      tagMap: {}
    };
  }
  // Always dynamically set activePeriod to the calendar month — overrides any stale value
  // saved in config.json so server-side fallbacks (when an API call omits ?period=) always
  // use today's month. Client-side already does the same.
  cfg.activePeriod = currentPeriod();
  return cfg;
}
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }

function ensureShape(data) {
  if (data.properties && !data.byPeriod) {
    data.byPeriod = { '2026-04': data.properties };
    delete data.properties;
  }
  if (!data.byPeriod)        data.byPeriod        = {};
  if (!data.alerts)          data.alerts          = [];
  if (!data.notes)           data.notes           = {};
  if (!data.pipeline)        data.pipeline        = [];
  if (!data.brandCompliance) data.brandCompliance = {};
  if (!data.decisions)       data.decisions       = [];
  if (!data.actions)         data.actions         = [];
  if (!data.watchlist)       data.watchlist       = [];
  if (!data.hr)              data.hr              = { jobs: [] };
  if (!data.hr.jobs)         data.hr.jobs         = [];
  if (!data.ownerProfiles)   data.ownerProfiles   = {};
  if (!data.scans)           data.scans           = [];
  if (!data.gmBench)         data.gmBench         = {};
  if (!data.councils)        data.councils        = [];
  // Weekly STR Commentary — per-property, per-week-ending entries. Mirrors the
  // PS template form: STR metrics (RGI/ARI/MPI/myOcc/myAdr/myRevpar/compOcc/
  // compAdr/compRevpar) + free-text commentary. Manually entered until we wire
  // a PS export path. Schema:
  //   data.weeklyStr[propertyId] = [
  //     { id, weekEnding: "YYYY-MM-DD", metrics: {...}, commentary: "...",
  //       enteredAt, enteredBy, updatedAt }
  //   ]
  if (!data.weeklyStr)       data.weeklyStr       = {};
  // Hotel contact roster — populated by tools-import-contacts.py (re-runnable
  // xlsx importer). Shape:
  //   data.contacts = {
  //     property:  { [propId]: { hotelName, address, phone, gm, agm, dos,
  //                              support, owner, m3CompanyCode, ... } },
  //     corporate: { [slug]:   { name, title, department, email, cell, linkedin } },
  //     unmapped:  { [code]:   {raw row from sheet} },
  //     _meta:     { importedAt, sourceFile, schemaVersion, stats }
  //   }
  // The xlsx is the source of truth. Re-running the importer wholesale-replaces
  // property/corporate; nothing else in data.json is touched.
  if (!data.contacts)        data.contacts        = { property: {}, corporate: {}, unmapped: {}, _meta: null };
  // Custom personas — built from the intake form at /persona-intake.html.
  // Shape:
  //   data.personas[slug] = {
  //     slug, name, title, photo, status: 'draft' | 'complete',
  //     intake: { identity:{...}, authority:{...}, data:{...}, ownership:{...},
  //               voice:{...}, decisions:{...}, priorities:{...},
  //               samples:{...}, constraints:{...}, personal:{...} },
  //     intakeSchemaVersion: <int>,
  //     completionPct: 0-100,
  //     updatedAt: ISO,
  //     createdAt: ISO
  //   }
  // Generated system prompt is computed on demand by buildPersonaPrompt(),
  // not stored — keeps the source of truth as the intake fields.
  if (!data.personas)        data.personas        = {};

  // ── PMS Pace / Pickup snapshots (Forecast Stack Layer 1) ──
  // Per-property daily snapshots of the PMS pace report. See:
  //   docs/SHAI_FORECAST_STACK.md (canonical spec)
  //   memory/project_forecast_stack.md (priority + rationale)
  // Shape:
  //   data.pmsPace[propId] = {
  //     [asOfDate (YYYY-MM-DD)]: {
  //       snappedAt: ISO timestamp,
  //       source: 'pep' | 'opera' | 'fosse' | 'choice-advantage' | 'opera-cloud' | 'manual',
  //       fileName: original uploaded file name (for audit only),
  //       rows: [
  //         {
  //           stayDate: 'YYYY-MM-DD',       // the future date being measured
  //           segment: 'transient' | 'group' | 'contract' | 'wholesale' | 'other',
  //           otbRooms: number,             // on-the-books rooms for that stayDate × segment
  //           otbRev: number,               // on-the-books room revenue
  //           adr: number,                  // otbRev / otbRooms
  //           pickup1d: number | null,      // rooms picked up since 1 day prior
  //           pickup7d: number | null,      // rooms picked up since 7 days prior
  //           lyOtbRooms: number | null,    // same-time-last-year comparable OTB rooms
  //           lyOtbRev:   number | null,    // same-time-last-year comparable OTB revenue
  //           leadTimeDays: number | null,  // weighted average lead time, if reported
  //           channelMix:  object | null    // optional { 'brand.com': 0.42, 'OTA': 0.31, ... }
  //         },
  //         ...
  //       ]
  //     }
  //   }
  // Merge semantics: re-uploading the same (propId, asOfDate) REPLACES the prior
  // snapshot (so a corrected pace report supersedes the original). Different
  // asOfDates accumulate so the time series builds over days. No file bytes
  // are stored — the import endpoint accepts normalized JSON only.
  if (!data.pmsPace)         data.pmsPace         = {};

  // ── Events / Compression Calendar (Forecast Stack Layer 3) ──
  // Per-property × period cache of demand-affecting events (concerts, sports,
  // conventions, festivals, graduations, major corporate). Populated by Claude
  // with the web_search server tool when the daily-forecast endpoint asks for
  // a period that's missing or stale. See docs/SHAI_FORECAST_STACK.md Layer 3.
  // Shape:
  //   data.events[propId][period] = {
  //     generatedAt: ISO timestamp,
  //     source: 'ai-websearch' | 'manual',
  //     events: [
  //       {
  //         date: 'YYYY-MM-DD',
  //         name: string,
  //         type: 'concert' | 'sports' | 'convention' | 'festival' |
  //               'graduation' | 'corporate' | 'religious' | 'other',
  //         venue: string | null,
  //         estAttendance: number | null,
  //         demandImpact: 'high' | 'medium' | 'low',
  //         note: string  // 1-2 sentence summary for the model + UI
  //       },
  //       ...
  //     ]
  //   }
  // TTL: 48 hours. Events occasionally change (cancellations, additions) but
  // most major events are locked in months ahead. Refresh on /api/events
  // request when stale, or force-refresh via ?force=1.
  if (!data.events)          data.events          = {};

  // ── Forecast History (Forecast Stack Phase 8 — adaptive feedback loop) ──
  // Per-property × stayDate, every AI daily-forecast generation that
  // predicted that date appends a compact record. Once the stayDate is
  // in the past, the calibration helper joins these against actuals
  // (from data.dailyPtd and data.byPeriod) to compute delta, which feeds
  // back into the next forecast's prompt as model-calibration context.
  //
  // Shape:
  //   data.forecasts[propId][stayDate] = [
  //     {
  //       generatedAt: ISO,
  //       leadDays:    number,  // days(stayDate - generatedAt's date)
  //       occ, adr, revpar, revenue,
  //       transient: { rms, adr, rev },
  //       group:     { rms, adr, rev },
  //       contract:  { rms, adr, rev }
  //     },
  //     ...
  //   ]
  //
  // Capped per stayDate at the most recent 12 entries (a typical stay gets
  // forecast 2-4× per week × 4-12 weeks of lead time = ~10-50 generations;
  // 12 keeps the relevant lead-time band coverage without bloating).
  if (!data.forecasts)       data.forecasts       = {};
  return data;
}

// ─── PS PROXY (OAuth2 Token Auth) ──────────────────────────────────────────
// ProfitSword/ProfitSage uses OAuth2 password grant:
//   1. POST to /PS-Handlers/token with username+password → get access_token
//   2. Pass access_token as query param on all API calls
//   API base: https://superhost.profitsage.net/PS-Handlers/api/DataPortalv3

let psTokenCache = { token: null, expiresAt: 0 };

// Log gate — every PS call previously logged 4-6 lines. With 17 properties × 3
// datasets × 6 daily refreshes, that's hundreds of MB/year of log spam (the
// real hub.log was 15 MB after a few weeks). Default off; set LOG_LEVEL=debug
// in .env to bring it back for troubleshooting.
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const psDebug = (...args) => { if (LOG_LEVEL === 'debug') console.log(...args); };

async function psGetToken(config) {
  const username = config.profitsword.username || process.env.PROFITSAGE_USERNAME;
  const password = config.profitsword.password || process.env.PROFITSAGE_PASSWORD;
  const baseUrl  = config.profitsword.baseUrl;
  if (!username || !password) throw new Error('ProfitSword credentials not configured');

  // Return cached token if still valid (with 60s buffer)
  if (psTokenCache.token && Date.now() < psTokenCache.expiresAt - 60000) {
    return psTokenCache.token;
  }

  const base = (baseUrl || 'https://superhost.profitsage.net').replace(/\/+$/, '');
  const tokenUrl = base + '/PS-Handlers/token';
  psDebug('[PS] Token request →', tokenUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      signal: controller.signal
    });
    clearTimeout(timer);
    psDebug('[PS] Token response status:', res.status);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log('[PS] Token error body:', text.substring(0, 500));
      throw new Error(`ProfitSword auth failed (${res.status}): ${text || res.statusText}`);
    }
    const data = await res.json();
    psDebug('[PS] Token received, expires_in:', data.expires_in);
    if (!data.access_token) throw new Error('ProfitSword auth response missing access_token');

    psTokenCache.token = data.access_token;
    psTokenCache.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return data.access_token;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('ProfitSword token request timed out after 15s');
    throw e;
  }
}

async function psRequest(endpoint, config, params = {}) {
  const token = await psGetToken(config);
  const base  = (config.profitsword.baseUrl || 'https://superhost.profitsage.net').replace(/\/+$/, '');
  const ep    = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const url   = new URL(base + '/PS-Handlers/api/DataPortalv3' + ep);

  // Always pass access_token as query param
  url.searchParams.set('access_token', token);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });

  psDebug('[PS] Request →', url.toString().replace(/access_token=[^&]+/, 'access_token=***'));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);
    psDebug('[PS] Response:', res.status, endpoint);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.log('[PS] Error body:', errText.substring(0, 300));
      throw new Error(`ProfitSword ${res.status}: ${res.statusText}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    console.log('[PS] Request failed:', endpoint, e.message);
    if (e.name === 'AbortError') throw new Error('ProfitSword request timed out after 20s');
    throw e;
  }
}

app.get('/api/ps/test', checkAuth, async (req, res) => {
  try {
    const config = loadConfig();
    await psGetToken(config);           // Test auth first
    const sites = await psRequest('/Sites', config);
    res.json({ status: 'connected', siteCount: Array.isArray(sites) ? sites.length : 0 });
  } catch (e) {
    psTokenCache = { token: null, expiresAt: 0 }; // Clear bad token
    res.status(400).json({ status: 'failed', message: e.message });
  }
});

app.get('/api/ps/sites', checkAuth, async (req, res) => {
  const config = loadConfig();
  try {
    const sites = await psRequest('/Sites', config);
    const props = getPropertyList();
    const norm  = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const matches = {};
    if (Array.isArray(sites)) {
      sites.forEach(site => {
        const sn = norm(site.siteName || site.siteTag || '');
        props.forEach(p => {
          const pn = norm(p.name);
          let hits = 0;
          for (let i = 0; i <= pn.length - 4; i++) if (sn.includes(pn.slice(i,i+4))) hits++;
          if (hits >= 3 && (!matches[p.id] || matches[p.id].hits < hits))
            matches[p.id] = { siteTag: site.siteTag || site.siteName, hits };
        });
      });
    }
    res.json({ sites, autoMatched: Object.fromEntries(Object.entries(matches).map(([id,m])=>[id,m.siteTag])) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Daily-granularity probe (REMOVED 2026-05-05).
// Probed 10 candidate endpoints (/Daily, /DailyExtended, /DailyData, /PaceDaily,
// /DailyReport, /DailyTotals, /DailyMetrics, /DailySummary, /MonthlyDaily, /Day).
// Result: ProfitSword does NOT expose a daily-granularity endpoint — 9 returned
// "Could not find file '...SQLTemplates/DataPortal/v3/<name>.txt'" (missing SQL
// template), 1 returned "No data downloaded." Decision: PATH A — Daily Flash
// shipped with PTD = current month-to-date actuals (PS posts daily; running
// actuals ARE the PTD), Full Period = Live Fc / Day-1 Locked / Budget. See
// docs/SESSION_HANDOFF.md and the buildDailyFlash function in dashboard.html.

app.get('/api/ps/datasets', checkAuth, async (req, res) => {
  try {
    const datasets = await psRequest('/DataSets', loadConfig());
    res.json({ datasets });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Diagnostic: see raw PS response for one property. Gated behind ADMIN_DEBUG=1
// because the response includes raw PS data + parse errors + stack hints — fine
// for local troubleshooting, not something to leave exposed in any deployment.
app.get('/api/ps/debug/:siteTag', checkAuth, async (req, res) => {
  if (process.env.ADMIN_DEBUG !== '1') {
    return res.status(404).json({ error: 'Not found' });
  }
  const config = loadConfig();
  const { period, begMonth, endMonth } = req.query;
  const [year, month] = (period || config.activePeriod).split('-');
  const mon = parseInt(month);
  // Optional range mode: pass &begMonth=1&endMonth=4 to query Jan-Apr aggregated
  const bm = begMonth ? parseInt(begMonth) : mon;
  const em = endMonth ? parseInt(endMonth) : mon;
  try {
    // Make raw fetch to see actual response before .json() parsing
    const token = await psGetToken(config);
    const base = (config.profitsword.baseUrl || 'https://superhost.profitsage.net').replace(/\/+$/, '');
    const url = new URL(base + '/PS-Handlers/api/DataPortalv3/MonthlyExtended');
    url.searchParams.set('access_token', token);
    url.searchParams.set('siteTag', req.params.siteTag);
    url.searchParams.set('year', year);
    url.searchParams.set('eyear', year);
    url.searchParams.set('begmonth', bm);
    url.searchParams.set('endmonth', em);
    url.searchParams.set('dataSetID', req.query.dataSetId || config.profitsword.dataSetId || '1');
    url.searchParams.set('includeTotals', 'Y');
    url.searchParams.set('includeZeroes', 'N');

    const resp = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    const contentType = resp.headers.get('content-type') || '';
    const rawText = await resp.text();

    // Try to parse
    let parsed = null, parseError = null;
    try { parsed = JSON.parse(rawText); } catch (e) { parseError = e.message; }

    // If parsed is a string, try double-decode
    let doubleParsed = null;
    if (typeof parsed === 'string') {
      try { doubleParsed = JSON.parse(parsed); } catch {}
    }

    const final = doubleParsed || parsed;
    const normalized = normalizePS(final);
    const tags = normalized.map(i => i.itemTag || i.ItemTag || i.tag || i.item_tag || 'NO_TAG');

    res.json({
      httpStatus: resp.status,
      contentType,
      rawTextLength: rawText.length,
      rawTextPreview: rawText.substring(0, 800),
      parsedType: typeof parsed,
      parsedIsArray: Array.isArray(parsed),
      parsedKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : null,
      wasDoubleEncoded: !!doubleParsed,
      normalizedCount: normalized.length,
      sampleItems: normalized.slice(0, 5),
      allTags: [...new Set(tags)],
      fieldNames: normalized.length > 0 ? Object.keys(normalized[0]) : []
    });
  } catch (e) { res.status(400).json({ error: e.message, stack: e.stack?.split('\n').slice(0,3) }); }
});

app.get('/api/ps/monthly/:siteTag', checkAuth, async (req, res) => {
  const config = loadConfig();
  const { period, dataSetId } = req.query;
  // period format: "2026-04" → year=2026, begmonth=4, endmonth=4
  const [year, month] = (period || config.activePeriod).split('-');
  const mon = parseInt(month);
  try {
    const [actuals, budget, forecast] = await Promise.all([
      psRequest('/MonthlyExtended', config, {
        siteTag: req.params.siteTag, year, eyear: year,
        begmonth: mon, endmonth: mon,
        dataSetID: dataSetId || config.profitsword.dataSetId || '1',
        includeTotals: 'Y', includeZeroes: 'N'
      }),
      psRequest('/MonthlyExtended', config, {
        siteTag: req.params.siteTag, year, eyear: year,
        begmonth: mon, endmonth: mon,
        dataSetID: config.profitsword.budgetDataSetId || '2',
        includeTotals: 'Y', includeZeroes: 'N'
      }),
      psRequest('/MonthlyExtended', config, {
        siteTag: req.params.siteTag, year, eyear: year,
        begmonth: mon, endmonth: mon,
        dataSetID: config.profitsword.forecastDataSetId || '3',
        includeTotals: 'Y', includeZeroes: 'N'
      }).catch(() => null)  // Forecast may not exist — don't fail the whole pull
    ]);
    res.json({ actuals, budget, forecast });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Core refresh logic (reusable) ──
async function refreshAllProperties(period) {
  const config  = loadConfig();
  const p       = period || config.activePeriod;
  const data    = ensureShape(loadData());
  const results = { success: [], failed: [] };
  if (!data.byPeriod[p]) data.byPeriod[p] = {};
  const tagMap = config.tagMap || {};
  console.log('[PS] Refresh-all: period=', p, 'tagMap keys=', Object.keys(tagMap).length);
  const [year, month] = p.split('-');
  const mon = parseInt(month);
  for (const prop of getPropertyList().filter(pr => pr.active)) {
    const siteTag = tagMap[prop.id];
    if (!siteTag) { results.failed.push({ name: prop.name, error: 'No siteTag mapped' }); continue; }
    try {
      const [actuals, budget, forecast] = await Promise.all([
        psRequest('/MonthlyExtended', config, {
          siteTag, year, eyear: year, begmonth: mon, endmonth: mon,
          dataSetID: config.profitsword.dataSetId || '-3',
          includeTotals: 'Y', includeZeroes: 'N'
        }),
        psRequest('/MonthlyExtended', config, {
          siteTag, year, eyear: year, begmonth: mon, endmonth: mon,
          dataSetID: config.profitsword.budgetDataSetId || '2', includeTotals: 'Y', includeZeroes: 'N'
        }),
        psRequest('/MonthlyExtended', config, {
          siteTag, year, eyear: year, begmonth: mon, endmonth: mon,
          dataSetID: config.profitsword.forecastDataSetId || '1', includeTotals: 'Y', includeZeroes: 'N'
        }).catch(() => null)
      ]);
      const fcMetrics = forecast ? extractMetrics(forecast, forecast) : null;
      const psExtracted = extractMetrics(actuals, budget);
      // STR data lives in its own field; peel it off so it doesn't pollute manual
      const strFromPS = psExtracted.strFromPS;
      delete psExtracted.strFromPS;
      const existing = data.byPeriod[p][prop.id] || {};
      const userManual = existing.manual || {};
      const existingStr = existing.str || null;
      // PSC manual inputs — user-entered fields that PS does not feed.
      // Once set by the user, they win over any PS-derived value of the same key.
      // primaryFc* are the Day-1 Primary Forecast snapshot — feeds PSC Forecast Accuracy
      // AND the Daily Flash dashboard. Locked on the first refresh of the month, never
      // overwritten by subsequent PS refreshes (PS does not version forecasts).
      const PSC_MANUAL_KEYS = [
        'primaryFcGopAmt','ytdPrimaryFcGopAmt',
        'primaryFcRevenue','primaryFcRoomRev','primaryFcOcc','primaryFcAdr','primaryFcRevpar',
        'primaryFcFbRev','primaryFcFoodRev','primaryFcBevRev','primaryFcOiRev',
        'revparIdx','ytdRevparIdx','revparIdxBud',
        'guestScore','googleScore','aosScore','turnover','qaPass','communityEngagement',
        // ESS Occ — manual entry preserved unless/until the PS tag is confirmed
        // and resolves a real value. Once the tag works, user can blank the
        // manual field at Admin → Data Entry to let PS take over.
        'essOcc','essOccBud',
        // Brand Compare cost-line sub-accounts. Not yet pulled from PS (sub-tags
        // unconfirmed in Chris's environment). Entered manually via Data Entry;
        // surfaced as $ POR (cost ÷ rooms sold) on the Brand Compare panel.
        // Pattern matches essOcc — once the PS sub-tag is confirmed (hit
        // /api/ps/debug/<siteTag> and look for room-attendant / guest-supply /
        // cleaning-supply / IT-expense lines), wire it into extractMetrics and
        // user can blank the manual entry to let PS take over.
        'rmAttCost','guestSupplies','cleaningSupplies','itExpense'
      ];
      const merged = { ...psExtracted };
      PSC_MANUAL_KEYS.forEach(k => {
        const v = userManual[k];
        if (v !== undefined && v !== null && v !== '') merged[k] = v;
      });
      // Lock-in Primary Forecast on the first refresh of the month.
      // Captures the full set of metrics the Daily Flash needs (revenue, roomRev,
      // occ, adr, revpar, F&B rev, other rev, GOP $). Each only sets if not already
      // locked — once snapped, subsequent refreshes leave it alone, and the user can
      // override any field via the Data Entry form.
      if (fcMetrics) {
        const snapMap = {
          primaryFcGopAmt:   fcMetrics.gopAmt,
          primaryFcRevenue:  fcMetrics.revenue,
          primaryFcRoomRev:  fcMetrics.dept?.rooms?.rev,
          primaryFcOcc:      fcMetrics.occ,
          primaryFcAdr:      fcMetrics.adr,
          primaryFcRevpar:   fcMetrics.revpar,
          primaryFcFbRev:    fcMetrics.dept?.fb?.rev,
          primaryFcFoodRev:  fcMetrics.dept?.food?.rev,
          primaryFcBevRev:   fcMetrics.dept?.bev?.rev,
          primaryFcOiRev:    fcMetrics.dept?.oi?.rev
        };
        let snapped = false;
        for (const [key, val] of Object.entries(snapMap)) {
          if ((merged[key] == null || merged[key] === '') && val != null && val !== 0) {
            merged[key] = val;
            snapped = true;
          }
        }
        if (snapped) {
          merged._primaryFcSnapAt = new Date().toISOString();
          merged._primaryFcSnapAuto = true;
        }
      }
      // STR auto-derive: PS-derived values flow in unless the user has manually entered STR for this period
      // Manual entries are flagged with source 'manual' or 'csv'; PS-derived flagged 'profitsword'.
      let strMerged = existingStr;
      if (strFromPS) {
        if (!existingStr || existingStr.source === 'profitsword' || !existingStr.source) {
          strMerged = strFromPS;
        }
        // else: user-entered STR exists — keep it, do not overwrite
      }
      data.byPeriod[p][prop.id] = {
        ...existing,
        manual: merged,
        str: strMerged,
        forecast: fcMetrics ? {
          revenue: fcMetrics.revenue, revpar: fcMetrics.revpar, occ: fcMetrics.occ, adr: fcMetrics.adr,
          gopAmt: fcMetrics.gopAmt, gop: fcMetrics.gop, noiAmt: fcMetrics.noiAmt,
          labor: fcMetrics.labor, roomsSold: fcMetrics.roomsSold, roomsAvail: fcMetrics.roomsAvail,
          ebitda: fcMetrics.ebitda, pace: fcMetrics.pace, dept: fcMetrics.dept
        } : null,
        actuals, budget, forecastRaw: forecast,
        lastUpdated: new Date().toISOString(),
        source: 'live'
      };
      // ── Daily PTD snapshot ──
      // Only snapshot when refreshing the actual current calendar month. The auto-refresh task
      // also pulls "prior month catch-up" on day 1-5 — those refreshes shouldn't seed daily snaps.
      // Snapshot fields are CUMULATIVE month-to-date values; per-day actuals are derived as the
      // delta between consecutive morning snapshots (see /api/forecast/demand/:propId/daily).
      if (p === currentPeriod()) {
        const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' (UTC ok — close enough)
        data.dailyPtd = data.dailyPtd || {};
        data.dailyPtd[prop.id] = data.dailyPtd[prop.id] || {};
        data.dailyPtd[prop.id][p] = data.dailyPtd[prop.id][p] || {};
        // First snapshot of the day wins — later same-day refreshes don't overwrite it. This
        // gives us a clean "morning of date D" baseline; deltas across consecutive D's = day D's actual.
        if (!data.dailyPtd[prop.id][p][today]) {
          data.dailyPtd[prop.id][p][today] = {
            revenue:    merged.revenue ?? null,
            roomRev:    merged.dept?.rooms?.rev ?? null,
            roomsSold:  merged.roomsSold ?? null,
            roomsAvail: merged.roomsAvail ?? null,
            snappedAt:  new Date().toISOString()
          };
        }
      }
      results.success.push(prop.name);
    } catch (e) { results.failed.push({ name: prop.name, error: e.message }); }
  }
  data.lastUpdated = new Date().toISOString();
  saveData(data);
  // Invalidate the portfolio-trend cache so the Today landing picks up the
  // refreshed numbers within seconds rather than waiting for the 60s TTL.
  if (typeof clearTrendCache === 'function') clearTrendCache();
  return { ...results, period: p };
}

app.post('/api/ps/refresh-all', checkAuth, async (req, res) => {
  try {
    const result = await refreshAllProperties(req.body.period);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Refresh ALL 12 months of a given year. Used to backfill historical years (2025, 2024, etc.)
// so STR comp set + actuals + budget data flows in for prior periods.
app.post('/api/ps/refresh-year', checkAuth, async (req, res) => {
  try {
    const year = parseInt(req.body.year);
    if (!year || year < 2000 || year > 2100) return res.status(400).json({ error: 'year required (e.g. 2025)' });
    const periods = [];
    for (let m = 1; m <= 12; m++) periods.push(`${year}-${String(m).padStart(2,'0')}`);
    const all = { year, perPeriod: [], totalSuccess: 0, totalFailed: 0 };
    for (const p of periods) {
      const result = await refreshAllProperties(p);
      all.perPeriod.push({ period: p, success: result.success.length, failed: result.failed.length });
      all.totalSuccess += result.success.length;
      all.totalFailed += result.failed.length;
    }
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Refresh the next 1-N forward months from PS. Used by the Forecast tab's forward outlook so May/Jun/Jul
// (when active = April) get populated with PS forecast data. Default 3 forward months. Skips active month.
app.post('/api/ps/refresh-forward', checkAuth, async (req, res) => {
  try {
    const config = loadConfig();
    const targetPeriod = req.body.period || config.activePeriod;
    const months = parseInt(req.body.months) || 3;
    const [year, month] = targetPeriod.split('-').map(Number);
    const periods = [];
    for (let i = 1; i <= months; i++) {
      const d = new Date(year, (month - 1) + i, 1);
      periods.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const all = { period: targetPeriod, perPeriod: [], totalSuccess: 0, totalFailed: 0 };
    for (const p of periods) {
      const result = await refreshAllProperties(p);
      all.perPeriod.push({ period: p, success: result.success.length, failed: result.failed.length });
      all.totalSuccess += result.success.length;
      all.totalFailed += result.failed.length;
    }
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Refresh every YTD period (Jan through active month). Use sparingly — runs 12x API calls per property at year-end.
// Triggered by the "Refresh YTD" button on the dashboard. Also useful after onboarding mid-year or after any
// extended outage where prior months' data may be stale or missing.
app.post('/api/ps/refresh-ytd', checkAuth, async (req, res) => {
  try {
    const config = loadConfig();
    const targetPeriod = req.body.period || config.activePeriod;
    const [year, month] = targetPeriod.split('-').map(Number);
    const periods = [];
    for (let m = 1; m <= month; m++) periods.push(`${year}-${String(m).padStart(2,'0')}`);
    const all = { period: targetPeriod, perPeriod: [], totalSuccess: 0, totalFailed: 0 };
    for (const p of periods) {
      const result = await refreshAllProperties(p);
      all.perPeriod.push({ period: p, success: result.success.length, failed: result.failed.length });
      all.totalSuccess += result.success.length;
      all.totalFailed += result.failed.length;
    }
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function normalizePS(raw) {
  // ProfitSage API may return data in various wrapper structures
  // This normalizes to a flat array of line items
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  // Common wrappers: { data: [...] }, { items: [...] }, { results: [...] }, { lineItems: [...] }
  for (const key of ['data','items','results','lineItems','Data','Items','Results','LineItems','d']) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  // Nested month structure: { "2026": { "4": [...] } } or { months: { "4": [...] } }
  const vals = Object.values(raw);
  for (const v of vals) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const inner = Object.values(v);
      for (const iv of inner) {
        if (Array.isArray(iv)) return iv;
      }
    }
  }
  console.log('[PS] WARNING: Could not normalize response. Keys:', Object.keys(raw), 'Sample:', JSON.stringify(raw).substring(0, 500));
  return [];
}

function extractMetrics(actuals, budget) {
  // Normalize API response to flat arrays
  const act = normalizePS(actuals);
  const bud = normalizePS(budget);
  psDebug('[PS] Raw actuals type:', typeof actuals, Array.isArray(actuals) ? 'array('+actuals.length+')' : (actuals ? 'keys:'+Object.keys(actuals).join(',') : 'null'));
  psDebug('[PS] Normalized actuals:', act.length, 'items. First 3:', JSON.stringify(act.slice(0,3)));
  psDebug('[PS] Normalized budget:', bud.length, 'items. First 3:', JSON.stringify(bud.slice(0,3)));
  // Check for alternate field names
  if (act.length > 0) {
    const sample = act[0];
    psDebug('[PS] Sample item keys:', Object.keys(sample).join(', '));
  }

  // ProfitSword MonthlyExtended returns array of line items with:
  //   itemTag, description, stat, amt
  // Key tags:
  //   RMAVL  = Available Rooms (stat = count)
  //   RF0001 = Occupied Rooms  (stat = count, amt = room revenue)
  //   TOTGOP = Gross Operating Profit (amt = dollars)
  //   TOTOPRV = Department Sales / Total Revenue (amt = dollars)
  //   TOTRMRV = Total Room Revenue (amt = dollars)
  //   RF0008 = Total Hotel Labor (amt = dollars)
  // Occ%, ADR, RevPAR are calculated from rooms data

  const findByTag = (dataset, ...tags) => {
    if (!dataset || !Array.isArray(dataset)) return null;
    for (const tag of tags) {
      const item = dataset.find(i => (i.itemTag||'') === tag);
      if (item) return item;
    }
    return null;
  };

  const findAmt = (dataset, ...tags) => {
    const item = findByTag(dataset, ...tags);
    return item ? parseFloat(item.amt || 0) : null;
  };

  const findStat = (dataset, ...tags) => {
    const item = findByTag(dataset, ...tags);
    return item ? parseFloat(item.stat || 0) : null;
  };

  // ── Core KPIs (Actuals) ──
  const aAvail    = findStat(act, 'RMAVL');
  const aOccRooms = findStat(act, 'RF0001');
  const aRoomRev  = findAmt(act,  'TOTRM', 'RF0001');
  const aTotalRev = findAmt(act,  'TOTOPRV');
  const aGopAmt   = findAmt(act,  'TOTGOP');
  const aTotalRmRv= findAmt(act,  'TOTRMRV');
  const aLaborAmt = findAmt(act,  'RF0008');
  const aGuestSat = findAmt(act,  'I00066');
  const aNOI      = findAmt(act,  'TOTNOP', 'TOTNOPX');

  // ── Core KPIs (Budget) ──
  const bAvail    = findStat(bud,  'RMAVL');
  const bOccRooms = findStat(bud,  'RF0001');
  const bRoomRev  = findAmt(bud,   'TOTRM', 'RF0001');
  const bTotalRev = findAmt(bud,   'TOTOPRV');
  const bGopAmt   = findAmt(bud,   'TOTGOP');
  const bLaborAmt = findAmt(bud,   'RF0008');
  const bNOI      = findAmt(bud,   'TOTNOP', 'TOTNOPX');

  // ── Extended Stay Occupancy ──
  // Reported by PS for extended-stay brands (Home2, TownePlace, Mainstay).
  // The exact itemTag varies by chart-of-accounts setup; candidates below cover
  // the common Hilton / Marriott / Choice naming conventions. First match wins.
  // CONFIRM THE ACTUAL TAG by hitting /api/ps/debug/:siteTag for one of your
  // extended-stay properties and scanning the returned items for one whose
  // description matches "extended stay" / "LOS 5+" / "stay length pct". Then
  // promote that tag to the front of this list. Manual entry at Admin → Data
  // Entry (essOcc / essOccBud) is the fallback for any property that doesn't
  // resolve a tag.
  const ESS_OCC_TAGS_PCT  = ['ESSOCC', 'EXTSTAY', 'EXTOCC', 'EXTRMOCC', 'LOSEXT', 'OCCEXT', 'LOS5OCC', 'OCCESS'];
  const ESS_OCC_TAGS_ROOMS = ['EXTRMS', 'EXTRMSOLD', 'RMLOS5', 'RMLOS7', 'LOSGT5', 'EXTSTAYRM'];
  // Try direct percent first
  let aEssOcc = findStat(act, ...ESS_OCC_TAGS_PCT);
  if (aEssOcc == null) {
    // Fallback: compute % from extended-stay room count / total available rooms
    const losRooms = findStat(act, ...ESS_OCC_TAGS_ROOMS);
    if (losRooms != null && aAvail > 0) aEssOcc = Math.round((losRooms / aAvail) * 1000) / 10;
  }
  if (aEssOcc != null && aEssOcc <= 1) aEssOcc = aEssOcc * 100; // normalize 0-1 ratio → percent
  let bEssOcc = findStat(bud, ...ESS_OCC_TAGS_PCT);
  if (bEssOcc == null) {
    const losRooms = findStat(bud, ...ESS_OCC_TAGS_ROOMS);
    if (losRooms != null && bAvail > 0) bEssOcc = Math.round((losRooms / bAvail) * 1000) / 10;
  }
  if (bEssOcc != null && bEssOcc <= 1) bEssOcc = bEssOcc * 100;

  // ── EBITDA ──
  const aEbitda   = findAmt(act,  'EBITDA');
  const aEbitdaX  = findAmt(act,  'EBITDAX');
  const bEbitda   = findAmt(bud,  'EBITDA');

  // ── Pace / Booking (actuals dataset only) ──
  const paceTrn   = findAmt(act,  'TOTPACETRN');    // transient pace $
  const paceGrp   = findAmt(act,  'TOTPACEGP');     // group pace $
  const paceTot   = findAmt(act,  'TOTPACECT');      // total confirmed pace $
  const paceTotBud= findAmt(act,  'TOTPACECTB');     // total pace vs budget
  const paceRevTot= findAmt(act,  'TTRPACE');        // total revenue pace $
  const paceTrnCon= findStat(act, 'PACETRNCON');     // transient confirmed rooms

  // ── Departmental: Rooms ──
  const aRmRev    = findAmt(act,  'TOTRMRV');
  const aRmLabor  = findAmt(act,  'TOTRML1');
  const aRmExp    = findAmt(act,  'TOTRMEX');
  const aRmProfit = findAmt(act,  'TOTRMDP');
  const bRmRev    = findAmt(bud,  'TOTRMRV');
  const bRmLabor  = findAmt(bud,  'TOTRML1');
  const bRmExp    = findAmt(bud,  'TOTRMEX');
  const bRmProfit = findAmt(bud,  'TOTRMDP');

  // ── Departmental: F&B ──
  // PS encodes F&B by outlet (Restaurant / Room Service / Banquet / Lounge), with Food
  // and Beverage as separate revenue tags within each outlet. Combined F&B rev still lives
  // in TOTFBRV, but for finer-grained reporting we sum the per-outlet Food and Beverage tags.
  // Discovered tag map (2026-05-05 across Embassy Naperville, HGI Atlanta, others):
  //   TOTFB01 Restaurant Food | TOTFB02 Restaurant Beverage | TOTFB03 Restaurant Allowances
  //   TOTFB04 R/S Food        | TOTFB05 R/S Beverage        | TOTFB07 R/S Other
  //   TOTFB08 BQT Food        | TOTFB09 BQT Beverage        | TOTFB11 BQT Other (service charge etc.)
  //   TOTFB12 LNGE Food       | TOTFB13 LNGE Beverage
  // Labor/expense/profit are NOT split by Food vs Bev in PS — those stay combined under TOTFBL1/EX/DP.
  const FB_FOOD_TAGS = ['TOTFB01', 'TOTFB04', 'TOTFB08', 'TOTFB12'];
  const FB_BEV_TAGS  = ['TOTFB02', 'TOTFB05', 'TOTFB09', 'TOTFB13'];
  const sumTagAmts = (dataset, tags) => {
    let s = 0, any = false;
    for (const t of tags) {
      const v = findAmt(dataset, t);
      if (v != null) { s += v; any = true; }
    }
    return any ? s : null;
  };
  const aFbRev    = findAmt(act,  'TOTFBRV');
  const aFoodRev  = sumTagAmts(act, FB_FOOD_TAGS);
  const aBevRev   = sumTagAmts(act, FB_BEV_TAGS);
  const aFbLabor  = findAmt(act,  'TOTFBL1');
  const aFbExp    = findAmt(act,  'TOTFBEX');
  const aFbProfit = findAmt(act,  'TOTFBDP');
  const bFbRev    = findAmt(bud,  'TOTFBRV');
  const bFoodRev  = sumTagAmts(bud, FB_FOOD_TAGS);
  const bBevRev   = sumTagAmts(bud, FB_BEV_TAGS);
  const bFbLabor  = findAmt(bud,  'TOTFBL1');
  const bFbExp    = findAmt(bud,  'TOTFBEX');
  const bFbProfit = findAmt(bud,  'TOTFBDP');

  // ── Departmental: A&G, S&M, Maintenance, Utilities ──
  const aAgExp    = findAmt(act,  'TOTAGEX');
  const aAgLabor  = findAmt(act,  'TOTAGL1');
  const bAgExp    = findAmt(bud,  'TOTAGEX');
  const aMkExp    = findAmt(act,  'TOTMKEX');
  const aMkLabor  = findAmt(act,  'TOTMKL1');
  const bMkExp    = findAmt(bud,  'TOTMKEX');
  const aMfExp    = findAmt(act,  'TOTMFEX');
  const bMfExp    = findAmt(bud,  'TOTMFEX');
  const aUtExp    = findAmt(act,  'TOTUTEX');
  const bUtExp    = findAmt(bud,  'TOTUTEX');

  // ── Labor: FTE ──
  const aFte      = findStat(act, 'DAYFTE');

  // ── AR Aging (actuals only) ──
  const ar030     = findAmt(act,  'AA0001');
  const ar3060    = findAmt(act,  'AA0002');
  const ar6090    = findAmt(act,  'AA0003');
  const ar90120   = findAmt(act,  'AA0004');
  const ar120p    = findAmt(act,  'AA0005');
  const arTotal   = findAmt(act,  'ARTOTAL');

  // ── Fixed Charges ──
  const aFxExp    = findAmt(act,  'TOTFXEX');
  const bFxExp    = findAmt(bud,  'TOTFXEX');

  // ── Other Income ──
  const aOiRev    = findAmt(act,  'TOTOIRV');
  const bOiRev    = findAmt(bud,  'TOTOIRV');

  // ── Recon — Cash + Credit Card receipts (actuals only; for the Recon page) ──
  // TOTCRCA = aggregated cash receipts; TOTCRCC = aggregated credit card receipts.
  // PMS Total Revenue = m.revenue (already computed below as aTotalRev || aTotalRmRv).
  const aCashReceipts = findAmt(act, 'TOTCRCA');
  const aCcReceipts   = findAmt(act, 'TOTCRCC');

  // ── STR Comp Set (data flows STR → ProfitSword) ──
  // COMPPRP = my property: stat = STR-reported occupied rooms, amt = STR-reported room revenue
  // COMPSET = comp set average: stat = avg occupied rooms (per-property normalized), amt = avg room revenue
  // Indices computed against my available rooms (RMAVL) — STR's standard share methodology
  const compMyOcc   = findStat(act, 'COMPPRP');
  const compMyRev   = findAmt(act,  'COMPPRP');
  const compSetOcc  = findStat(act, 'COMPSET');
  const compSetRev  = findAmt(act,  'COMPSET');
  let strData = null;
  if (compMyOcc != null && compSetOcc != null && aAvail > 0) {
    const myOccPct  = (compMyOcc / aAvail) * 100;
    const myAdr     = compMyOcc > 0 ? compMyRev / compMyOcc : null;
    const myRev     = aAvail > 0 ? compMyRev / aAvail : null;
    const compOccPct = (compSetOcc / aAvail) * 100;
    const compAdr   = compSetOcc > 0 ? compSetRev / compSetOcc : null;
    const compRev   = aAvail > 0 ? compSetRev / aAvail : null;
    strData = {
      // STR convention: indices on a 100 scale (100 = at comp set, 110 = 10% above, 90 = 10% below)
      occIdx:    compOccPct > 0 ? Math.round((myOccPct / compOccPct) * 1000) / 10 : null,
      adrIdx:    compAdr > 0 ? Math.round((myAdr / compAdr) * 1000) / 10 : null,
      revparIdx: compRev > 0 ? Math.round((myRev / compRev) * 1000) / 10 : null,
      myOcc:     Math.round(myOccPct * 10) / 10,
      myAdr:     myAdr ? Math.round(myAdr * 100) / 100 : null,
      myRevpar:  myRev ? Math.round(myRev * 100) / 100 : null,
      compOcc:   Math.round(compOccPct * 10) / 10,
      compAdr:   compAdr ? Math.round(compAdr * 100) / 100 : null,
      compRevpar:compRev ? Math.round(compRev * 100) / 100 : null,
      source:    'profitsword',
      pulledAt:  new Date().toISOString()
    };
  }

  // ── Calculate ratios ──
  const occ       = (aAvail > 0 && aOccRooms != null) ? Math.round((aOccRooms / aAvail) * 1000) / 10 : null;
  const adr       = (aOccRooms > 0 && aRoomRev != null) ? Math.round((aRoomRev / aOccRooms) * 100) / 100 : null;
  const revpar    = (aAvail > 0 && aRoomRev != null)    ? Math.round((aRoomRev / aAvail) * 100) / 100 : null;

  const occBud    = (bAvail > 0 && bOccRooms != null)   ? Math.round((bOccRooms / bAvail) * 1000) / 10 : null;
  const adrBud    = (bOccRooms > 0 && bRoomRev != null)  ? Math.round((bRoomRev / bOccRooms) * 100) / 100 : null;
  const revparBud = (bAvail > 0 && bRoomRev != null)     ? Math.round((bRoomRev / bAvail) * 100) / 100 : null;

  const revenue   = aTotalRev || aTotalRmRv;
  const revBud    = bTotalRev;
  const gopPct    = (revenue > 0 && aGopAmt != null)  ? Math.round((aGopAmt / revenue) * 1000) / 10 : null;
  const laborPct  = (revenue > 0 && aLaborAmt != null) ? Math.round((aLaborAmt / revenue) * 1000) / 10 : null;
  const laborBPct = (revBud > 0 && bLaborAmt != null)  ? Math.round((bLaborAmt / revBud) * 1000) / 10 : null;

  const result = {
    // ── Existing KPIs (unchanged) ──
    revpar, revparBud,
    occ, occBud,
    adr, adrBud,
    gop:       gopPct,
    gopAmt:    aGopAmt,
    gopBudAmt: bGopAmt,
    revenue,
    revBud,
    labor:     laborPct,
    laborBud:  laborBPct,
    guestScore: aGuestSat ? Math.round(aGuestSat * 10) / 10 : null,
    noiAmt:     aNOI,
    noiBudAmt:  bNOI,
    roomsSold:  aOccRooms,
    roomsAvail: aAvail,
    // Extended Stay Occupancy — pulled where the tag resolves; manual-entry
    // fallback at Admin → Data Entry preserves the value even on refresh
    // because /api/properties/:id/data merges by field (doesn't overwrite null).
    essOcc:    aEssOcc,
    essOccBud: bEssOcc,

    // ── EBITDA ──
    ebitda:    aEbitda,
    ebitdaX:   aEbitdaX,
    ebitdaBud: bEbitda,

    // ── Pace ──
    pace: (paceTrn != null || paceGrp != null) ? {
      transient: paceTrn, group: paceGrp, total: paceTot,
      totalBud: paceTotBud, revTotal: paceRevTot, trnConfRooms: paceTrnCon
    } : null,

    // ── Departments ──
    dept: {
      rooms:  { rev: aRmRev, labor: aRmLabor, exp: aRmExp, profit: aRmProfit,
                revBud: bRmRev, laborBud: bRmLabor, expBud: bRmExp, profitBud: bRmProfit },
      fb:     { rev: aFbRev, labor: aFbLabor, exp: aFbExp, profit: aFbProfit,
                revBud: bFbRev, laborBud: bFbLabor, expBud: bFbExp, profitBud: bFbProfit },
      // Food and Beverage REVENUE only (PS doesn't split labor/expense by food vs bev).
      // Sums the per-outlet Food/Bev tags. dept.fb stays as the combined for back-compat.
      food:   { rev: aFoodRev, revBud: bFoodRev },
      bev:    { rev: aBevRev,  revBud: bBevRev },
      ag:     { exp: aAgExp, labor: aAgLabor, expBud: bAgExp },
      sm:     { exp: aMkExp, labor: aMkLabor, expBud: bMkExp },
      maint:  { exp: aMfExp, expBud: bMfExp },
      util:   { exp: aUtExp, expBud: bUtExp },
      fx:     { exp: aFxExp, expBud: bFxExp },
      oi:     { rev: aOiRev, revBud: bOiRev }
    },

    // ── Labor ──
    fte: aFte,

    // ── AR Aging (actuals only — null for budget/forecast) ──
    ar: (ar030 != null || arTotal != null) ? {
      d030: ar030, d3060: ar3060, d6090: ar6090, d90120: ar90120, d120p: ar120p, total: arTotal
    } : null,

    // ── Recon receipts (actuals only) — feeds the Recon page directly from PS ──
    cashReceipts: aCashReceipts,
    ccReceipts:   aCcReceipts,

    // ── STR Comp Set (auto-derived from PS COMPPRP/COMPSET tags) ──
    strFromPS: strData
  };

  psDebug('[PS] extractMetrics →', JSON.stringify(result));
  return result;
}

// ─── CONFIG ─────────────────────────────────────────────────────────────────
app.get('/api/config', checkAuth, (req, res) => {
  const c = loadConfig();
  res.json({
    hasCreds:        !!(c.profitsword.username && c.profitsword.password),
    dataSetId:       c.profitsword.dataSetId,
    budgetDataSetId: c.profitsword.budgetDataSetId || '2',
    forecastDataSetId: c.profitsword.forecastDataSetId || '3',
    baseUrl:         c.profitsword.baseUrl,
    activePeriod:    c.activePeriod,
    aiConfigured:    !!(c.aiKey || c.groqKey || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY),
    aiKeyMasked:     (c.aiKey||c.groqKey) ? '••••••••' + (c.aiKey||c.groqKey).slice(-6) : '',
    tagMap:          c.tagMap || {}
  });
});
app.post('/api/config', checkAuth, (req, res) => {
  const c = loadConfig(), u = req.body;
  if (u.psUsername)              c.profitsword.username  = u.psUsername;
  if (u.psPassword)              c.profitsword.password  = u.psPassword;
  if (u.psDataSetId !== undefined) c.profitsword.dataSetId = u.psDataSetId;
  if (u.psBudgetDataSetId !== undefined) c.profitsword.budgetDataSetId = u.psBudgetDataSetId;
  if (u.psForecastDataSetId !== undefined) c.profitsword.forecastDataSetId = u.psForecastDataSetId;
  if (u.psBaseUrl)               c.profitsword.baseUrl   = u.psBaseUrl;
  if (u.groqKey)                 c.aiKey                 = u.groqKey;  // frontend sends as groqKey, store as aiKey
  // DO NOT persist activePeriod to disk. It's a runtime value — always derived from
  // currentPeriod() at read time. Persisting it caused the May-2026 stale-data regression
  // (the file said 2026-04 forever, auto-refresh kept pulling April even after May arrived).
  // If the request supplies activePeriod, ignore it. The header dropdown is the only
  // source of truth for what the user is currently viewing.
  if (u.tagMap)                  c.tagMap                = u.tagMap;
  // Strip any stale activePeriod that might still be in the on-disk config from before this fix
  delete c.activePeriod;
  saveConfig(c);
  res.json({ saved: true });
});

// ─── PROPERTIES ─────────────────────────────────────────────────────────────
app.get('/api/properties', checkAuth, (req, res) => {
  const period = req.query.period || loadConfig().activePeriod;
  const data   = ensureShape(loadData());
  const pData  = data.byPeriod[period] || {};

  // Pro-rate budget for current month so MTD actuals compare apples-to-apples.
  // PS data lags ~1 day, so the elapsed-days denominator is (today - 1), floored
  // at 1. This same proRateFactor is used by buildPortfolioSnapshot — keep them
  // aligned so dashboard tiles and AI chat see the same numbers.
  const now = new Date();
  const [pYear, pMonth] = period.split('-').map(Number);
  const isCurrentMonth = (pYear === now.getFullYear() && pMonth === (now.getMonth() + 1));
  const daysInMonth = new Date(pYear, pMonth, 0).getDate();
  const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate() - 1) : daysInMonth;
  const proRateFactor = isCurrentMonth ? daysElapsed / daysInMonth : 1;

  const props  = getPropertyList().map(p => {
    const stored = pData[p.id] || {};
    let manual = stored.manual ? { ...stored.manual } : null;

    // Stash the un-pro-rated full-month budget BEFORE pro-rating, so callers that
    // need full-month figures (Daily Flash Full Period column) can access them.
    // For non-current months, fullBud === manual since no pro-rating happens.
    let fullBud = null;
    if (manual) {
      fullBud = {
        revBud:    manual.revBud,
        gopBudAmt: manual.gopBudAmt,
        noiBudAmt: manual.noiBudAmt,
        ebitdaBud: manual.ebitdaBud,
        dept: manual.dept ? Object.fromEntries(
          Object.entries(manual.dept).map(([k, d]) => [k, {
            revBud: d.revBud, laborBud: d.laborBud, expBud: d.expBud, profitBud: d.profitBud
          }])
        ) : null
      };
    }

    // Apply pro-rate to budget DOLLAR fields for current month
    // Ratios (occBud%, adrBud$, revparBud$, laborBud%) stay untouched — they're rates, not totals
    if (manual && proRateFactor < 1) {
      ['revBud', 'gopBudAmt', 'noiBudAmt', 'ebitdaBud'].forEach(k => {
        if (manual[k] != null) manual[k] = Math.round(manual[k] * proRateFactor);
      });
      // Pro-rate departmental budget dollar amounts
      if (manual.dept) {
        for (const d of Object.values(manual.dept)) {
          ['revBud','laborBud','expBud','profitBud'].forEach(k => {
            if (d[k] != null) d[k] = Math.round(d[k] * proRateFactor);
          });
        }
      }

      // ── ACTUAL RATE FIELDS — fix the PS denominator bug ────────────────
      // PS delivers actuals for the current month with an MTD numerator
      // (roomsSold, room revenue) and a FULL-MONTH denominator (roomsAvail).
      // Result: occ% and revpar$ are mathematically wrong by exactly the
      // proRateFactor — e.g., a hotel running 78% MTD occ shows up as 12.7%
      // on May 6. ADR is unaffected (no avail in its calc).
      // Fix: divide actual occ% and revpar$ by proRateFactor to recover the
      // true MTD daily rates. Stash the original PS values for traceability.
      // Stored data is left untouched — this is a render-time correction.
      if (manual.occ != null) {
        manual.occRaw = manual.occ;
        manual.occ = Math.round((manual.occ / proRateFactor) * 10) / 10;
      }
      if (manual.revpar != null) {
        manual.revparRaw = manual.revpar;
        manual.revpar = Math.round((manual.revpar / proRateFactor) * 100) / 100;
      }
      if (manual.roomsAvail != null) {
        manual.roomsAvailFullMonth = manual.roomsAvail;
        manual.roomsAvail = Math.round(manual.roomsAvail * proRateFactor);
      }
    }

    // Score and flow MUST use the corrected `manual` (pro-rated bud, true-MTD
    // rates) — not raw stored.manual — or current-month properties get scored
    // against full-month budgets and look like 0/200 disasters when they're
    // actually on plan.
    return { ...p, manual, fullBud, forecast: stored.forecast||null, lastUpdated: stored.lastUpdated||null, source: stored.source||null, score: calcScore(manual), flow: calcFlow(manual), str: stored.str||null, note: (data.notes[p.id]||{}).current||'' };
  });
  res.json({ properties: props, period, lastUpdated: data.lastUpdated, proRated: proRateFactor < 1, proRateFactor: Math.round(proRateFactor * 1000) / 1000 });
});

// ─── PORTFOLIO TREND ────────────────────────────────────────────────────────
// Single-shot aggregated time series for the Today landing chart + hero
// sparkline. Replaces 24 parallel /api/properties calls (12 current + 12 LY)
// with one read of data.byPeriod and an in-memory aggregation pass.
//
// Query params:
//   period   YYYY-MM (default: active period)
//   months   1..36   (default: 12)
//
// Returns: { periods:[YYYY-MM,...], cur:[bucket,...], ly:[bucket,...] }
// Each bucket: { revenue, revBud, gopAmt, gopBudAmt, noiAmt, noiBudAmt,
//                rooms, available, count }
//
// Pro-rate behavior matches /api/properties: only the active calendar month
// is pro-rated (budget dollars × proRate; roomsAvail × proRate). All prior
// months use full stored values. This keeps the active-month data point
// apples-to-apples MTD vs. MTD-scope budget, same as the dashboard tiles.
//
// Cache: keyed by `${period}:${months}`, 60s TTL. The aggregation itself is
// cheap (~10ms); the cost is loadData() parsing the 90+ MB data.json on each
// call (~2s). 60s TTL hides that on repeat hits — short enough to pick up
// auto-refresh updates within a minute, long enough that Today re-renders
// don't pay the parse cost. Invalidated on every PS refresh via
// `clearTrendCache()` so fresh numbers appear immediately after a refresh.
const _trendCache = new Map();
const _TREND_TTL_MS = 60 * 1000;
function clearTrendCache() { _trendCache.clear(); }
app.get('/api/portfolio-trend', checkAuth, (req, res) => {
  const monthsN = Math.min(36, Math.max(1, parseInt(req.query.months) || 12));
  const endPeriod = req.query.period || loadConfig().activePeriod;
  const m = String(endPeriod).match(/^(\d{4})-(\d{2})$/);
  if (!m) return res.status(400).json({ error: 'invalid period' });
  const eY = +m[1], eM = +m[2];

  const cacheKey = `${endPeriod}:${monthsN}`;
  const cached = _trendCache.get(cacheKey);
  if (cached && (Date.now() - cached.at) < _TREND_TTL_MS) {
    return res.json({ ...cached.body, cached: true });
  }

  const periods = [];
  const lyPeriods = [];
  for (let i = monthsN - 1; i >= 0; i--) {
    const d = new Date(eY, eM - 1 - i, 1);
    const y = d.getFullYear(), mm = d.getMonth() + 1;
    periods.push(`${y}-${String(mm).padStart(2,'0')}`);
    lyPeriods.push(`${y - 1}-${String(mm).padStart(2,'0')}`);
  }

  const data = ensureShape(loadData());
  const byPeriod = data.byPeriod || {};
  const propList = getPropertyList();
  const now = new Date();

  const aggForPeriod = (period) => {
    const pData = byPeriod[period] || {};
    const [pY, pM] = period.split('-').map(Number);
    const isCurrent = (pY === now.getFullYear() && pM === (now.getMonth() + 1));
    const daysInMonth = new Date(pY, pM, 0).getDate();
    const daysElapsed = isCurrent ? Math.max(1, now.getDate() - 1) : daysInMonth;
    const proRate = isCurrent ? daysElapsed / daysInMonth : 1;

    let revenue = 0, revBud = 0, gopAmt = 0, gopBudAmt = 0,
        noiAmt = 0, noiBudAmt = 0, rooms = 0, available = 0, count = 0;
    for (const p of propList) {
      if (!p.active) continue;
      const stored = pData[p.id] || {};
      const mn = stored.manual;
      if (!mn) continue;
      if (mn.revenue == null && mn.revBud == null) continue;

      revenue   += mn.revenue || 0;
      revBud    += (mn.revBud || 0) * proRate;
      gopAmt    += mn.gopAmt || 0;
      gopBudAmt += (mn.gopBudAmt || 0) * proRate;
      const noi    = mn.noiAmt    != null ? mn.noiAmt    : mn.gopAmt;
      const noiBud = mn.noiBudAmt != null ? mn.noiBudAmt : mn.gopBudAmt;
      noiAmt    += noi || 0;
      noiBudAmt += (noiBud || 0) * proRate;
      rooms     += mn.roomsSold || 0;
      // For RevPAR scope match: pro-rate roomsAvail in the active month so
      // revenue/available = true MTD RevPAR (mirrors /api/properties).
      const avail = mn.roomsAvail || 0;
      available += isCurrent ? Math.round(avail * proRate) : avail;
      count++;
    }
    return {
      revenue: Math.round(revenue),
      revBud:  Math.round(revBud),
      gopAmt:  Math.round(gopAmt),
      gopBudAmt: Math.round(gopBudAmt),
      noiAmt:    Math.round(noiAmt),
      noiBudAmt: Math.round(noiBudAmt),
      rooms, available, count
    };
  };

  const cur = periods.map(aggForPeriod);
  const ly  = lyPeriods.map(aggForPeriod);
  const body = { periods, cur, ly, months: monthsN, period: endPeriod };
  _trendCache.set(cacheKey, { at: Date.now(), body });
  res.json(body);
});

// ─── DEMAND FORECAST ────────────────────────────────────────────────────────
// 6-month forward demand forecast for a property. Uses LY-same-month as the base
// (preserves seasonality), scaled by a YoY growth ratio derived from the property's
// own history. Falls back to historical average when no LY same-month exists.
// Confidence is a simple function of how many historical periods we have.
app.get('/api/forecast/demand/:propId', checkAuth, (req, res) => {
  const propId = req.params.propId;
  const prop = getPropertyList().find(p => String(p.id) === String(propId));
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  // Forecast horizon — accepts 3, 6, 9, or 12 months. Default 6.
  const horizonRaw = parseInt(req.query.months, 10);
  const horizon = [3, 6, 9, 12].includes(horizonRaw) ? horizonRaw : 6;
  // History lookback window — accepts 3, 6, 9, or 12 months back from current period. Default 12.
  // Trims the history considered for YoY growth, fallback averages, and the returned `history` array.
  const historyRaw = parseInt(req.query.historyMonths, 10);
  const historyMonths = [3, 6, 9, 12].includes(historyRaw) ? historyRaw : 12;

  const data = ensureShape(loadData());
  const periods = Object.keys(data.byPeriod).sort();
  // Build the full unfiltered history first (so we can report total-on-file count),
  // then slice the trailing N months that fall within the lookback window.
  // Segment data is captured from PS pace tags (TOTPACETRN/TOTPACEGP/TOTPACECT) at
  // refresh time — present on most periods, surfaced here for both UI display and
  // computation of LY mix proportions used to estimate forward segment $.
  const allHistory = [];
  // Track per-period pace snapshots so the forecast loop can mix-derive forward segments
  const paceByPeriod = {};
  for (const period of periods) {
    const stored = (data.byPeriod[period] || {})[propId] || {};
    const m = stored.manual;
    if (m && (m.revpar != null || m.occ != null)) {
      // Snapshot order: prefer forecast.pace (full-month committed) over manual.pace (PTD),
      // since forecast.pace better represents the period's expected total mix.
      const fcPace = (stored.forecast && stored.forecast.pace) || null;
      const mPace  = m.pace || null;
      const pace   = fcPace || mPace || null;
      paceByPeriod[period] = { fcPace, mPace };
      allHistory.push({
        period,
        occ:        m.occ        != null ? Number(m.occ) : null,
        adr:        m.adr        != null ? Number(m.adr) : null,
        revpar:     m.revpar     != null ? Number(m.revpar) : null,
        roomsAvail: m.roomsAvail != null ? Number(m.roomsAvail) : null,
        roomsSold:  m.roomsSold  != null ? Number(m.roomsSold) : null,
        revenue:    m.revenue    != null ? Number(m.revenue) : null,
        // Segment $ — transient and group from PS pace tags (forecast preferred, falls back to actual PTD)
        segTransientRev: pace && pace.transient != null ? Number(pace.transient) : null,
        segGroupRev:     pace && pace.group     != null ? Number(pace.group)     : null,
        segTotalRev:     pace && pace.total     != null ? Number(pace.total)     : null,
        segSource:       fcPace ? 'forecast-pace' : (mPace ? 'actual-pace' : null)
      });
    }
  }
  // Compute the window cutoff: N months before the current calendar month.
  // e.g., on 2026-05-05 with historyMonths=6, cutoff = 2025-12 (inclusive).
  const _now = new Date();
  let cy = _now.getFullYear(), cm = _now.getMonth() + 1; // 1-indexed
  cm -= historyMonths;
  while (cm < 1) { cm += 12; cy -= 1; }
  const cutoffPeriod = `${cy}-${String(cm).padStart(2, '0')}`;
  // Also exclude the current month (incomplete) and any future periods from the window.
  const curPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
  const history = allHistory.filter(h => h.period >= cutoffPeriod && h.period < curPeriod);
  const historyTotal = allHistory.length;

  // YoY growth: median of (this-year-month / prior-year-same-month) RevPAR ratios where both exist.
  // Uses the FULL history (not the trimmed display window) so a short lookback (e.g., 3 months) doesn't
  // starve the model of YoY pairs.
  const yoyRatios = [];
  const byPeriodAll = Object.fromEntries(allHistory.map(h => [h.period, h]));
  for (const h of allHistory) {
    const [hy, hm] = h.period.split('-').map(Number);
    const ly = byPeriodAll[`${hy - 1}-${String(hm).padStart(2, '0')}`];
    if (ly && ly.revpar > 0 && h.revpar > 0) yoyRatios.push(h.revpar / ly.revpar);
  }
  const median = arr => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const yoy = median(yoyRatios) ?? 1.03; // 3% default if no signal

  // Fallback averages — computed from the TRIMMED window so the user's lookback choice
  // still influences the forecast when no LY same-month exists. Short window = recent-trend bias.
  const avg = key => {
    const xs = history.map(h => h[key]).filter(v => v != null && !isNaN(v));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const avgOcc = avg('occ'), avgAdr = avg('adr'), avgRevpar = avg('revpar');
  const lastRoomsAvail = (() => {
    for (let i = allHistory.length - 1; i >= 0; i--) if (allHistory[i].roomsAvail) return allHistory[i].roomsAvail;
    return null;
  })();

  // Generate `horizon` forward periods starting next month
  const now = new Date();
  let fy = now.getFullYear(), fm = now.getMonth() + 2; // next month (1-indexed)
  if (fm > 12) { fm -= 12; fy += 1; }
  const forecast = [];
  for (let i = 0; i < horizon; i++) {
    const fPeriod = `${fy}-${String(fm).padStart(2, '0')}`;
    // LY same-month lookup uses FULL history (trimmed window doesn't constrain seasonal base).
    const ly      = byPeriodAll[`${fy - 1}-${String(fm).padStart(2, '0')}`] || null;

    let occF, adrF, revparF, source;
    if (ly && ly.revpar != null) {
      // LY-same-month base, scaled by YoY growth (occ holds; ADR/RevPAR scale)
      occF    = ly.occ;
      adrF    = ly.adr ? ly.adr * yoy : null;
      revparF = ly.revpar * yoy;
      source  = 'ly-seasonal';
    } else if (avgRevpar != null) {
      occF    = avgOcc;
      adrF    = avgAdr ? avgAdr * yoy : null;
      revparF = avgRevpar * yoy;
      source  = 'historical-avg';
    } else {
      occF = adrF = revparF = null;
      source = 'no-data';
    }

    // Confidence: high if 12+ periods AND have LY base; medium if 6+; low otherwise
    let confidence;
    if (history.length >= 12 && ly) confidence = 'high';
    else if (history.length >= 6)   confidence = 'medium';
    else                            confidence = 'low';

    // ── Segment estimate ──
    // Prefer LY same-month's pace mix (transient share / group share). Apply to forecasted
    // total revenue (revpar × roomsAvail) to get $ per segment. Honest approximation —
    // future periods in PS only carry pace if a refresh hit them.
    const lyPace = byPeriodAll[`${fy - 1}-${String(fm).padStart(2, '0')}`];
    const lyTrn  = lyPace?.segTransientRev;
    const lyGrp  = lyPace?.segGroupRev;
    const lyDen  = (lyTrn != null ? lyTrn : 0) + (lyGrp != null ? lyGrp : 0);
    let mixTrnPct = null, mixGrpPct = null, segTrnRev = null, segGrpRev = null, mixSource = 'none';
    if (lyDen > 0) {
      mixTrnPct = (lyTrn || 0) / lyDen;
      mixGrpPct = (lyGrp || 0) / lyDen;
      mixSource = 'ly-mix';
    } else {
      // Fallback: portfolio-typical mix from THIS property's most recent periods with pace
      const recent = allHistory.filter(h => h.segTransientRev != null || h.segGroupRev != null).slice(-6);
      if (recent.length) {
        const tSum = recent.reduce((s, r) => s + (r.segTransientRev || 0), 0);
        const gSum = recent.reduce((s, r) => s + (r.segGroupRev || 0), 0);
        const den  = tSum + gSum;
        if (den > 0) { mixTrnPct = tSum / den; mixGrpPct = gSum / den; mixSource = 'recent-avg'; }
      }
    }
    const fcRoomsAvail = ly?.roomsAvail || lastRoomsAvail || 0;
    const fcTotalRev   = (revparF != null && fcRoomsAvail) ? revparF * fcRoomsAvail : null;
    if (fcTotalRev != null && mixTrnPct != null) {
      segTrnRev = Math.round(fcTotalRev * mixTrnPct);
      segGrpRev = Math.round(fcTotalRev * mixGrpPct);
    }

    forecast.push({
      period:         fPeriod,
      occForecast:    occF != null ? Math.round(occF * 10) / 10 : 0,
      adrForecast:    adrF != null ? Math.round(adrF * 100) / 100 : 0,
      revparForecast: revparF != null ? Math.round(revparF * 100) / 100 : 0,
      roomsAvail:     fcRoomsAvail,
      confidence,
      source,
      // Segment estimates
      segTransientRev: segTrnRev,
      segGroupRev:     segGrpRev,
      mixTransient:    mixTrnPct != null ? Math.round(mixTrnPct * 1000) / 10 : null, // pct, 1 decimal
      mixGroup:        mixGrpPct != null ? Math.round(mixGrpPct * 1000) / 10 : null,
      mixSource
    });

    fm++; if (fm > 12) { fm = 1; fy++; }
  }

  // Current segment mix — from the most-recent period's pace (forecast first, then actual)
  let currentMix = null;
  for (let i = allHistory.length - 1; i >= 0; i--) {
    const h = allHistory[i];
    if (h.segTransientRev != null || h.segGroupRev != null) {
      const den = (h.segTransientRev || 0) + (h.segGroupRev || 0);
      if (den > 0) {
        currentMix = {
          period: h.period,
          transientRev: h.segTransientRev,
          groupRev:     h.segGroupRev,
          totalRev:     h.segTotalRev,
          transientPct: Math.round(((h.segTransientRev || 0) / den) * 1000) / 10,
          groupPct:     Math.round(((h.segGroupRev || 0) / den) * 1000) / 10,
          source:       h.segSource
        };
        break;
      }
    }
  }

  res.json({
    propId: prop.id,
    propName: prop.name,
    horizon,
    historyMonths,
    historyTotal,
    yoyGrowth: Math.round(yoy * 1000) / 1000,
    currentMix,
    history,
    forecast
  });
});

// ─── DAILY DEMAND FORECAST (Claude-driven) ──────────────────────────────────
// Generates a day-by-day projection for a property and target month using the
// property's full history, pace data, comp set, and seasonal patterns. Returns
// JSON with one row per day: { date, dow, occ, adr, revpar, transientRev, groupRev,
// notes? }. Cached per (propId, period) for 4 hours unless ?force=1 is passed —
// daily LLM calls would otherwise add up fast across 17 properties × 12 months.
const DAILY_FORECAST_CACHE_MS  = 4 * 60 * 60 * 1000; // 4h TTL
const DAILY_FORECAST_CACHE_MAX = 500;                 // hard cap — prevents unbounded growth
const dailyForecastCache = new Map(); // key = `${propId}:${period}` → { ts, parsed }
// Capped insertion + LRU-ish eviction. The keyspace is bounded in practice
// (17 properties × ~24 months at most), but a misconfigured caller or a
// future feature could blow that out. When the cap is hit, drop the oldest entry.
function dailyForecastCacheSet(key, value) {
  if (dailyForecastCache.size >= DAILY_FORECAST_CACHE_MAX && !dailyForecastCache.has(key)) {
    // Drop the oldest by insertion order (Map iteration order = insertion order).
    const oldest = dailyForecastCache.keys().next().value;
    if (oldest !== undefined) dailyForecastCache.delete(oldest);
  }
  dailyForecastCache.set(key, value);
}

app.post('/api/forecast/demand/:propId/daily', checkAuth, aiRateLimit, async (req, res) => {
  const propId = req.params.propId;
  const prop = getPropertyList().find(p => String(p.id) === String(propId));
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  const period = req.body?.period || currentPeriod();
  if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'Invalid period (expected YYYY-MM)' });
  const force = !!(req.body?.force);

  // Cache stores the RAW Claude output (no actuals overlay). Actuals overlay is recomputed
  // on every request — cheap, and ensures fresh PTD snapshots show through immediately
  // without waiting for cache expiry.
  const cacheKey = `${propId}:${period}`;
  let parsed = null, cacheHit = null;
  if (!force) {
    const hit = dailyForecastCache.get(cacheKey);
    if (hit && (Date.now() - hit.ts) < DAILY_FORECAST_CACHE_MS) {
      parsed = JSON.parse(JSON.stringify(hit.parsed)); // clone — overlay mutates
      cacheHit = hit;
    }
  }

  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey && !parsed) return res.status(400).json({ error: 'Claude API key not configured (Admin → API Keys)' });

  // Pull rich context for the prompt
  const data = ensureShape(loadData());
  const periods = Object.keys(data.byPeriod).sort();
  const trailing = periods.slice(-18); // last 18 months for context
  const historyForLLM = trailing.map(p => {
    const stored = (data.byPeriod[p] || {})[propId] || {};
    const m = stored.manual || {};
    const f = stored.forecast || {};
    const pace = (f.pace || m.pace || null);
    return {
      period: p,
      occ:    m.occ ?? null, adr: m.adr ?? null, revpar: m.revpar ?? null,
      revenue: m.revenue ?? null, roomsAvail: m.roomsAvail ?? null,
      transientRev: pace?.transient ?? null,
      groupRev:     pace?.group ?? null,
      strRgi:       stored.str?.revparIdx ?? null,
      strMpi:       stored.str?.occIdx ?? null
    };
  }).filter(r => r.revpar != null);

  const lyPeriod = (() => {
    const [y, m] = period.split('-').map(Number);
    return `${y - 1}-${String(m).padStart(2, '0')}`;
  })();
  const lyData = (data.byPeriod[lyPeriod] || {})[propId] || {};
  const lyM = lyData.manual || {};
  const curStored = (data.byPeriod[period] || {})[propId] || {};
  const curM = curStored.manual || {};
  const curF = curStored.forecast || {};

  const [pYear, pMonth] = period.split('-').map(Number);
  const daysInMonth = new Date(pYear, pMonth, 0).getDate();
  const monthName = new Date(pYear, pMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // System prompt: forces JSON-only output with strict schema
  const sys = `You are a hospitality demand forecaster. You output ONLY valid JSON — no prose, no markdown fences, no commentary outside the JSON object.

You will produce a day-by-day demand projection for a single hotel property for one calendar month. Use the historical data, pace data, comp-set indices, and seasonal patterns provided to build realistic daily values.

DAY-OF-WEEK PRINCIPLES (apply unless data suggests otherwise):
- Select-service / extended-stay: Mon-Thu peaks (corporate transient), weekends softer
- Full-service / convention: Tue-Thu peak with weekend shoulder, group blocks shift the curve
- Resort/leisure: weekends peak, midweek soft
- Holidays and observed events shift demand markedly — use the calendar context for the month

PACE DATA — when paceContext is provided, treat it as the primary anchor:
- paceContext.daily[].tRms / .gRms / .cRms are ACTUAL on-the-books rooms today by segment for each future date. These are not estimates, they are bookings already received. Anchor your forecast to them and add pickup-to-arrival on top — do not under-shoot the OTB.
- paceContext.daily[].lyRms / .lyRev are same-time-last-year comparables for the same future date (when source is Lighthouse). Use the LY pace as a sanity benchmark — if CY pace is materially behind LY, flag the risk in your "risks" field; if it's ahead, lean into a stronger forecast.
- paceContext.source identifies the system. Lighthouse Rev Pak has Transient + Group + Contract with CY + LY; Opera Future Occupancy has Transient + Group without LY. Don't mention these source names in your output — they're just for your awareness.
- paceContext.asOfDate is when the snapshot was taken. Booking activity AFTER that date isn't reflected. Assume reasonable pickup between asOfDate and stay date.
- When paceContext is null/missing, fall back to history + day1Locked + LY same month patterns as before.

EVENTS CONTEXT — when events array is provided, weight it explicitly per event:
- Each entry has { date, name, type, venue, estAttendance, demandImpact, note } — verified events in the property's market.
- demandImpact tiers map to typical occupancy effect at a hotel within the market:
  * "high"   — +15 to +30 points of occ around the event day, often spills to ±1 night. Transient unless type=convention/corporate (then group). Can hit ADR ceiling.
  * "medium" — +5 to +15 points of occ on the event day. Mostly transient, some shoulder spill.
  * "low"    — +2 to +5 points, factor into mix but don't materially shift the daily curve.
- Event-type rules of thumb:
  * concert / sports — event-day + day-before peak; transient leisure mix; weekend events stretch to 2-night minimums; ADR holds firm
  * convention / corporate — multi-night, group block typically already in paceContext; transient on shoulder; arrival day Sun/Mon, departure Thu/Fri
  * graduation — Fri-Sun peak around the ceremony; parents/family fill rooms; high transient ADR
  * festival — 3-day spans typical; leisure transient mix; lead time longer (45+ days)
  * religious / corporate retreats — large block, often pre-booked; minimal walk-in pickup
- When a high-impact event lands on a date where paceContext shows soft OTB: forecast that pickup is still coming (people book closer to the event). Don't replicate the soft OTB — adjust upward toward the event-day potential.
- Reference specific events by name in your "rationale" and "note" fields when they're driving the curve. Example: "Keeneland Spring Meet 4/4-4/26 drives weekend transient compression; mid-meet ADR ceiling tested."
- If events list is empty or null, don't fabricate. Use seasonality + DOW + pace as usual.

PICKUP CURVE REASONING — when paceContext.daily[X].pickupHistory is present (≥3 longitudinal snapshots for the stay date):
- pickupHistory is an array sorted by leadDays DESC: [{ld: 35, r: 12}, {ld: 28, r: 18}, {ld: 21, r: 26}, {ld: 14, r: 35}, {ld: 7, r: 48}, ...]. Earliest snapshot first, most recent last.
- Compute pickup velocity per week: (r_at_ld_N+7 - r_at_ld_N) over those 7 days = rooms/day. Compare velocities across windows to spot acceleration / deceleration.
- A healthy demand curve typically accelerates as the stay date approaches (transient especially). Decelerating velocity inside 21 days = warning sign — pace gap is real, not just early-booking-window timing.
- Compare CY pickup velocity to LY (paceContext.daily[X].lyRms) at equivalent lead time. If LY had 41 rms by lead-7 and CY only has 28 rms at lead-7, that's a 32% pace gap with limited time to close — forecast accordingly and flag in risks.
- When pickup velocity is decelerating AND CY is materially behind LY, set day.confidence to "low" and consider emitting an anomaly.
- When pickup velocity is accelerating beyond LY's curve at the same lead time, lean into a stronger forecast — that's a demand surge signal.
- Reference specifics in rationale: "June 14 pickup velocity 1.8 rms/day in days 14-7 vs LY's typical 4.2 rms/day at same lead — pace materially decelerating, transient forecast held at 42 rms vs LY's 58."

PRICING INTELLIGENCE — when paceContext.daily[X] carries Layer-4 fields (Lighthouse source):
- ownBar: this property's published BAR for that future date. Your transient ADR forecast should generally land within ±5% of ownBar unless you have a specific reason (compression event → premium; weak pace → discount toward hurdle).
- compSetAvg: comp set's average BAR for the same date. ownBar vs compSetAvg shows positioning:
  * ownBar > compSetAvg by >5% → priced above market; risk of share loss if demand isn't there
  * ownBar < compSetAvg by >5% → priced below market; share gain likely but yield left on the table
  * within ±5% → competitive parity
- hurdle: the rate FLOOR the revenue manager has set. Your transient ADR forecast should NEVER land below hurdle unless explicitly noted. If pace + demand suggest the property will struggle to fill at hurdle, flag in "risks" rather than forecast below the floor.
- lhEvents: Lighthouse's curated event annotation (e.g., "Juneteenth (Regional Holiday)"). Often complements the events array — treat as confirming signal when both flag the same date.
- lhForecastRms: Lighthouse's own forecast rooms for the date. Your forecast doesn't need to match it (you're producing an independent view), but if you differ by more than 20% in either direction, mention it in rationale — the reader will want to know why.
- pickup7dRms: rooms picked up in the past 7 days for this future date. High pickup7d on a date close to today signals booking acceleration → forecast above current OTB.
- compSetMembers: list of properties in the comp set (informational only — reference by name only if a specific competitor's pricing is materially shaping strategy).
- When pricingIntel is absent (Opera source, or no Lighthouse drop), use comp set RGI/MPI/ARI from compSet block as the alternative pricing signal.

OUTPUT SCHEMA (every key required, day count must equal daysInMonth):
{
  "monthName": string,
  "daysInMonth": number,
  "monthlyTotal": {
    "occ": number, "adr": number, "revpar": number, "revenue": number,
    "transient": { "rms": number, "adr": number, "rev": number },
    "group":     { "rms": number, "adr": number, "rev": number },
    "contract":  { "rms": number, "adr": number, "rev": number }
  },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dow": "Mon|Tue|...|Sun",
      "occ": number,
      "adr": number,
      "revpar": number,
      "revenue": number,
      "transient": { "rms": number, "adr": number, "rev": number },
      "group":     { "rms": number, "adr": number, "rev": number },
      "contract":  { "rms": number, "adr": number, "rev": number },
      "confidence": "high" | "medium" | "low",
      "anomaly"?: { "severity": "high"|"medium", "paceVsLyPct"?: number, "note": string },
      "note"?: string
    }
  ],
  "riskScorecard": {
    "paceRisk":               { "tier": "high"|"medium"|"low", "note": string },
    "adrRisk":                { "tier": "high"|"medium"|"low", "note": string },
    "washRisk":               { "tier": "high"|"medium"|"low", "note": string },
    "compressionOpportunity": { "tier": "high"|"medium"|"low", "note": string },
    "groupDependency":        { "tier": "high"|"medium"|"low", "note": string },
    "otaExposure":            { "tier": "high"|"medium"|"low", "note": string }
  },
  "rationale": string,    // 2-4 sentences on what's driving the curve (booking pace, seasonality, events, comp set, brand mix). Cite specific segments AND specific dates.
  "risks": string,        // 1-2 sentences on key downside scenarios
  "confidence": "high"|"medium"|"low"  // overall month-level
}

NUMERIC RULES:
- occ in % (one decimal, 0-100)
- adr/revpar/revenue and segment .rms/.adr/.rev in dollars or whole-number rooms (rev rounded to whole dollar OK)
- Within each day: revenue ≈ transient.rev + group.rev + contract.rev (small rounding ok)
- Within each day: total rooms sold ≈ transient.rms + group.rms + contract.rms
- occ = (transient.rms + group.rms + contract.rms) × 100 / property.roomsAvail (use the property's daily capacity from history)
- adr = revenue / total rooms sold (rounded; if zero rooms, set adr=0)
- monthlyTotal aggregates: sum days[].x.rms and days[].x.rev for each segment; adr is revenue/rooms across the month
- For properties with no Contract demand (typical select-service): set contract.rms=0, contract.adr=0, contract.rev=0. Do NOT fabricate.
- "note" only on days with material events (holidays, group blocks, weather, brand mandates) — leave off otherwise

SEGMENT FORECASTING — the new core of this output:
- Start each future date from paceContext.daily[X].t/g/cRms (already-booked OTB by segment) when available
- Add expected pickup based on lead-time patterns, day-of-week, historical pickup curves, and comp-set demand
- The .adr field per segment should reflect realistic mix — transient ADR typically tracks BAR; group/contract often have negotiated rates lower than transient
- Cross-check: segment forecasts must roll up to the day total, and day totals must roll up to monthly. Internal arithmetic consistency is required.

CONDITIONAL REASONING — branch your analysis, don't just average:
When pace, ADR, comp set, or events deviate from baseline, your reasoning must investigate not just describe. Patterns to apply:
- Soft midweek transient pace → ask: corporate-week pull-back? competitor opened? rate too high vs comp? Is this DOW pattern normal? Don't just report softness — diagnose.
- ADR vs comp set wide gap → ask: are we underpriced (yield gap) or overpriced (share-loss risk)? Reference compSetAvg + named competitors.
- Strong LY same-day with weak CY pace → ask: pickup delayed (still time to fill) or true demand destruction? Use pace7dRms and lead-time context.
- High pickup7dRms on a near-term date → forecast lift; acceleration signals demand catching up.
- Event present but CY pace flat → ask: event missing from prior years' lift? Pricing too high for event guests? Late-booking pattern?

DAILY CONFIDENCE — set per day in days[].confidence:
- "high"    — CY pace tracks within ±10% of LY same-day at this lead time, normal DOW pattern, no event-driven uncertainty
- "medium"  — pace deviates 10–25% from LY, OR event impact uncertain, OR shoulder night with limited OTB signal
- "low"     — pace >25% off LY, OR <30% of expected OTB at this lead time, OR event materiality unclear, OR group-block-dependent with tentative-only status

ANOMALY DETECTION — emit anomaly block on a day ONLY when material:
- severity: "high"  if CY pace is >40% below LY-equivalent OR pickup7dRms=0 on a date where LY clearly had pickup
- severity: "medium" for 25–40% pace gaps, or ADR forecast >10% below ownBar with no apparent reason
- note: 1 sentence with specific quantification, e.g., "Transient OTB 14 rms vs LY 41 rms at 21-day lead — investigate: event missing? competitor compression? export issue?"
- Within ±25% volatility = normal — do NOT emit an anomaly block (don't be noisy)

RISK SCORECARD (top-level riskScorecard, all 6 dimensions required even when "low"):
- paceRisk: CY OTB vs LY trajectory. high = >25% behind. medium = 10–25%. low = within ±10%.
- adrRisk: ADR forecast vs market positioning. high = ownBar >10% below compSetAvg with no demand signal AND forecast holds the gap. medium = parity below market with mixed signal. low = within ±5% of compSet or premium-justified.
- washRisk: group cancellation/wash exposure. high = group >25% of forecast AND tentative-block heavy. medium = group 10–25% definite-only OR data missing. low = group <10%.
- compressionOpportunity: high = HIGH-impact event AND comp set tight. medium = MEDIUM event OR midweek corporate spike pattern. low = normal pattern.
- groupDependency: high = group >25% of forecast. medium = 10–25%. low = <10%.
- otaExposure: channel mix isn't currently in your inputs → default to "medium" with note "OTA mix unknown — recommend PMS rate-code production upload."
Each note must be specific and reference data values. Generic notes ("normal range," "looks fine") are unacceptable.

STRENGTHENED ADR LOGIC — when ownBar and compSetAvg are present:
- Forecast ADR > ownBar by >3% → you're implying rate adjustment is justified; explain why (event compression? near sellout? compSetAvg also climbing?)
- Forecast ADR < ownBar by >3% → you're implying discount pressure; explain why
- ownBar > compSetAvg by >8% with no compression catalyst → flag adrRisk Medium-High with "priced above market without demand catalyst — share-loss risk"
- Reference specific competitors by name when their pricing materially shapes the recommendation: "Courtyard is $215, Fairfield $109 — we're at $189, positioned between them. Compression event would let us push toward Courtyard."

FORECAST CALIBRATION — when calibrationContext is provided, USE IT to self-correct:
- pairsScored: how many past (forecast → actual) pairs were available over the windowDays. <5 = early days, weight modestly. ≥10 = trustworthy pattern.
- avgRevDeltaPct: average % delta between your past predictions and actuals. POSITIVE = you've been forecasting too high; NEGATIVE = too low.
- bias: 'forecast-optimistic' = trim this run; 'forecast-conservative' = lean a bit higher; 'well-calibrated' = stay the course; 'unknown' = not enough data.
- dowPattern: avg % delta by day-of-week. If Sat shows +14% and Tue shows -8%, your prior forecasts have been over-optimistic on Saturdays and under-shooting on Tuesdays. Adjust THIS forecast's Sat/Tue accordingly.
- leadBandPattern: avg % delta by lead-time band ('0-3', '4-7', '8-14', '15-21', '22+'). Tells you when in the booking cycle your forecasts have drifted. If 4-7 day band is +20%, you've been over-forecasting close-to-arrival — usually means pickup that didn't materialize. Pull down forecasts inside that band.
- Apply calibration as a TRIM, not a wholesale revision. If overall bias is +6%, take 3-5% off — don't shave the full delta blindly. The other signals (paceContext, events, pricing) still matter; calibration is the *correction*.
- Reference calibration in rationale when it's materially shaping the forecast: "Calibration shows model has been +8% on Saturdays over the last 30 days — Sat forecast trimmed accordingly."
- If pairsScored is 0 or calibrationContext is null, proceed without calibration adjustment.

EVENT QUANTIFICATION — when events provided, attach a numeric lift estimate:
- HIGH-impact: +15 to +30 occ pts above baseline DOW occupancy
- MEDIUM-impact: +5 to +15 pts
- LOW-impact: +2 to +5 pts
- Multiple events same day → combine, cap at +35 total
- Quantify in rationale: "Railbird Festival 6/5–6/7 drives transient occ to ~85% vs baseline 60% for Fri-Sun in early June."

Be specific. Reference the data. If transient pace is +12% vs LY but group pace is -30%, say so. If LY had a group block in week 2 and CY paceContext shows it landed, reflect it. If Contract is structurally zero at this property, note that contract is being held at zero and explain why. Every forecast output must pair a number with the action it implies — if your output doesn't end in a recommended action, you're still reporting.`;

  // ── PACE CONTEXT — Forecast Stack Layer 1 (PMS pace + Lighthouse Rev Pak)
  // Pull the most recent pms-pace snapshot for this property, filter to the
  // target month, and pivot to daily × segment. When Lighthouse is the source
  // we also carry LY comparables. This is the highest-value signal for
  // forward forecasts — the model should anchor to actual OTB rooms rather
  // than synthesize from history alone. See docs/SHAI_FORECAST_STACK.md.
  // ── EVENTS CONTEXT — Forecast Stack Layer 3 ──
  // Fetch events for this property × period. Uses 48h cache. If cache is
  // stale, kicks off a fresh web_search lookup (only when API key configured).
  // Forecast endpoint NEVER blocks on events — if the lookup fails or is slow,
  // we proceed without events context rather than holding up the user.
  let eventsContext = null;
  try {
    data.events = data.events || {};
    data.events[propId] = data.events[propId] || {};
    const cached = data.events[propId][period];
    const fresh = cached && (Date.now() - new Date(cached.generatedAt).getTime() < EVENTS_CACHE_MS);
    if (cached && fresh) {
      eventsContext = cached.events || [];
    } else if (apiKey) {
      const result = await lookupEventsForProperty(prop, period);
      eventsContext = result.events || [];
      data.events[propId][period] = {
        generatedAt: new Date().toISOString(),
        source: result.source || 'ai-websearch',
        events: eventsContext,
        ...(result.error ? { error: result.error } : {})
      };
      try { saveData(data); } catch (e) { console.error('[forecast/daily] events save failed:', e); }
    }
  } catch (e) {
    console.error('[forecast/daily] events lookup failed (continuing without):', e);
    eventsContext = null;
  }

  let paceContext = null;
  try {
    const allSnaps = (data.pmsPace || {})[propId] || {};
    const snapKeys = Object.keys(allSnaps);
    if (snapKeys.length) {
      // Latest snapshot, preferring Lighthouse on ties (has CY+LY)
      const sortedKeys = snapKeys.slice().sort((a, b) => {
        const cmp = b.localeCompare(a);
        if (cmp !== 0) return cmp;
        return allSnaps[a].source === 'lighthouse' ? -1 : (allSnaps[b].source === 'lighthouse' ? 1 : 0);
      });
      const pickedAsOf = sortedKeys[0];
      const snap = allSnaps[pickedAsOf];
      const inMonth = (snap.rows || []).filter(r => String(r.stayDate || '').startsWith(period + '-'));
      // Layer-4 outlook (own BAR, comp set, LH forecast, LH events, pickup7d)
      // is keyed by stayDate too. Merge by date during the day-aggregate pass.
      const outlookByDate = (snap.outlook && typeof snap.outlook === 'object') ? snap.outlook : {};
      if (inMonth.length) {
        // Pivot: byDate[stayDate] = { transient, group, contract: { rooms, adr, rev, lyRooms, lyRev } }
        const byDate = {};
        for (const r of inMonth) {
          if (!byDate[r.stayDate]) byDate[r.stayDate] = {};
          byDate[r.stayDate][r.segment] = {
            rms: r.otbRooms, adr: r.adr, rev: r.otbRev,
            lyRms: r.lyOtbRooms, lyRev: r.lyOtbRev,
            pickup1d: r.pickup1d, leadDays: r.leadTimeDays
          };
        }
        const days = Object.keys(byDate).sort().map(sd => {
          const s = byDate[sd];
          const t = s.transient || {}, g = s.group || {}, c = s.contract || {};
          const totRms = (t.rms || 0) + (g.rms || 0) + (c.rms || 0);
          const totRev = (t.rev || 0) + (g.rev || 0) + (c.rev || 0);
          const totLyRms = (t.lyRms || 0) + (g.lyRms || 0) + (c.lyRms || 0);
          const totLyRev = (t.lyRev || 0) + (g.lyRev || 0) + (c.lyRev || 0);
          // Layer-4 fields from 365 Day Outlook (when Lighthouse was the source)
          const o = outlookByDate[sd] || {};
          // Phase 7 — pickup curve. Walks back through ALL stored snapshots
          // for this property to compute OTB-at-each-lead-time. Only inject
          // when the curve has ≥3 data points (need acceleration signal).
          // Cap at the most recent 8 snapshots so payload stays bounded.
          // Compact field names {ld, r} (leadDays, rooms) keep token cost low.
          const fullCurve = buildPickupCurve(data, propId, sd);
          const pickupHistory = (fullCurve.length >= 3)
            ? fullCurve.slice(-8).map(p => ({ ld: p.leadDays, r: p.otbRooms }))
            : null;
          return {
            d: sd,
            tRms: t.rms ?? null, tRev: t.rev ?? null, tAdr: t.adr ?? null,
            gRms: g.rms ?? null, gRev: g.rev ?? null, gAdr: g.adr ?? null,
            cRms: c.rms ?? null, cRev: c.rev ?? null, cAdr: c.adr ?? null,
            totRms, totRev,
            lyRms: totLyRms || null, lyRev: totLyRev || null,
            // Layer-4 pricing & forecast intel (null when not from Lighthouse)
            ownBar:        o.ownBar ?? null,
            compSetAvg:    o.compSetAvg ?? null,
            hurdle:        o.hurdle ?? null,
            lhEvents:      o.lhEvents ?? null,
            lhForecastRms: o.lhForecastRms ?? null,
            pickup7dRms:   o.pickup7dRms ?? null,
            pickup7dAdr:   o.pickup7dAdr ?? null,
            // Phase 7: longitudinal pickup history (null until ≥3 weekly snapshots accumulate)
            pickupHistory
          };
        });
        const sumRms = days.reduce((a, d) => a + (d.totRms || 0), 0);
        const sumRev = days.reduce((a, d) => a + (d.totRev || 0), 0);
        const sumLyRms = days.reduce((a, d) => a + (d.lyRms || 0), 0);
        const sumLyRev = days.reduce((a, d) => a + (d.lyRev || 0), 0);
        // Layer-4 summary: does any day in the target month carry pricing intel?
        const pricingDays = days.filter(d => d.ownBar != null || d.compSetAvg != null || d.hurdle != null).length;
        const lhEventDays = days.filter(d => d.lhEvents).length;
        const lhFcstDays  = days.filter(d => d.lhForecastRms != null).length;
        paceContext = {
          source: snap.source,
          asOfDate: pickedAsOf,
          fileName: snap.fileName || null,
          monthCovered: { days: days.length, daysInMonth },
          monthlyOtb: {
            transient: { rms: days.reduce((a,d) => a + (d.tRms || 0), 0), rev: days.reduce((a,d) => a + (d.tRev || 0), 0) },
            group:     { rms: days.reduce((a,d) => a + (d.gRms || 0), 0), rev: days.reduce((a,d) => a + (d.gRev || 0), 0) },
            contract:  { rms: days.reduce((a,d) => a + (d.cRms || 0), 0), rev: days.reduce((a,d) => a + (d.cRev || 0), 0) },
            total:     { rms: sumRms, rev: sumRev }
          },
          monthlyLY: (sumLyRms || sumLyRev) ? { rms: sumLyRms, rev: sumLyRev } : null,
          // Layer-4 pricing intelligence summary (when source=lighthouse)
          pricingIntel: pricingDays > 0 ? {
            datesWithBar:      pricingDays,
            datesWithLhEvents: lhEventDays,
            datesWithLhFcst:   lhFcstDays,
            compSetMembers:    Array.isArray(snap.compNames) ? snap.compNames : []
          } : null,
          daily: days
        };
      }
    }
  } catch (e) { console.error('[forecast/daily] paceContext build failed:', e); paceContext = null; }

  const userPayload = {
    property:    { id: prop.id, name: prop.name, brand: prop.brand, state: prop.state, owner: prop.owner },
    targetMonth: { period, monthName, daysInMonth, year: pYear, month: pMonth },
    currentSnapshot: {
      ptdActuals: { occ: curM.occ, adr: curM.adr, revpar: curM.revpar, revenue: curM.revenue, roomsAvail: curM.roomsAvail },
      liveForecast: { occ: curF.occ, adr: curF.adr, revpar: curF.revpar, revenue: curF.revenue,
                      transientRev: curF.pace?.transient, groupRev: curF.pace?.group, totalRev: curF.pace?.total },
      day1Locked:   { revenue: curM.primaryFcRevenue, revpar: curM.primaryFcRevpar, occ: curM.primaryFcOcc, adr: curM.primaryFcAdr, gop: curM.primaryFcGopAmt }
    },
    lySameMonth: {
      period: lyPeriod, occ: lyM.occ, adr: lyM.adr, revpar: lyM.revpar, revenue: lyM.revenue,
      roomsAvail: lyM.roomsAvail,
      transientRev: lyData.forecast?.pace?.transient || lyM.pace?.transient || null,
      groupRev:     lyData.forecast?.pace?.group     || lyM.pace?.group     || null
    },
    history: historyForLLM,
    compSet: curStored.str ? {
      revparIndex: curStored.str.revparIdx, occIndex: curStored.str.occIdx, adrIndex: curStored.str.adrIdx,
      myRevpar: curStored.str.myRevpar, compRevpar: curStored.str.compRevpar
    } : null,
    paceContext,
    events: eventsContext,
    // Phase 8 — calibration context: how the model has performed on past
    // forecasts for this property over the last 30 days. null when no
    // scoreable pairs exist (early days, no historical forecasts persisted
    // yet, or no PTD snapshots to compute single-day actuals from).
    calibrationContext: buildCalibrationContext(data, propId, new Date().toISOString().slice(0, 10), 30)
  };

  try {
    if (!parsed) {
      const txt = await callClaude(
        apiKey,
        sys,
        [{ role: 'user', content: 'Generate the daily forecast. Input data:\n\n' + JSON.stringify(userPayload, null, 2) }],
        12000, // Bumped from 8000 in Phase 6 — added per-day confidence + anomaly + riskScorecard pushes ~30 days × 14 fields + 6-tile scorecard well past 8K
        CLAUDE_MODEL_FAST,  // Haiku 4.5 — high-volume structured JSON, ~5x cheaper than Sonnet
        { skipVoice: true } // Structured JSON only — voice rules don't apply
      );
      // Robust JSON extraction. Despite the "no prose, no markdown fences"
      // instruction, models occasionally wrap output in ```json fences or add
      // a brief preamble/closing. We:
      //   1. Strip any leading/trailing markdown fence variant
      //   2. Locate the first '{' and last '}' in the text
      //   3. Parse the slice between them
      // If that still fails, surface a richer error so we can diagnose.
      const raw = String(txt);
      let cleaned = raw.trim()
        .replace(/^```(?:json|javascript|js)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace  = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
      try { parsed = JSON.parse(cleaned); }
      catch (e) {
        return res.status(502).json({
          error: 'AI returned non-JSON output',
          parseError: e.message,
          rawPreview: raw.substring(0, 400),
          cleanedPreview: cleaned.substring(0, 400),
          hint: 'Model may have been truncated (try smaller month) or wrapped output unexpectedly. Re-run.'
        });
      }

      if (!Array.isArray(parsed.days) || parsed.days.length !== daysInMonth) {
        return res.status(502).json({ error: `AI returned ${parsed.days?.length || 0} days; expected ${daysInMonth}`, sample: parsed.days?.[0] });
      }
      // Cache the raw Claude output (no overlay yet)
      dailyForecastCacheSet(cacheKey, { ts: Date.now(), parsed: JSON.parse(JSON.stringify(parsed)) });

      // ── Phase 8: persist this generation per-stayDate for the feedback loop.
      // Each future date's prediction gets appended to data.forecasts so
      // when that date later passes into the past, we can compare to actuals
      // and surface the delta as calibration context on subsequent forecasts.
      // We do this BEFORE the actuals overlay below so we capture the raw
      // AI prediction, not the back-cast-adjusted version.
      try {
        const persistData = ensureShape(loadData());
        persistData.forecasts = persistData.forecasts || {};
        persistData.forecasts[propId] = persistData.forecasts[propId] || {};
        const generatedAt = new Date().toISOString();
        const genDateOnly = generatedAt.slice(0, 10); // = today ISO date
        for (const day of parsed.days) {
          if (!day || typeof day.date !== 'string') continue;
          // Only capture FUTURE-day predictions (don't pollute the history
          // store with model output for already-past dates — those get the
          // back-cast/actuals overlay and aren't the AI's true forecast).
          if (day.date <= genDateOnly) continue;
          const leadDays = Math.max(0, Math.round((new Date(day.date + 'T12:00:00').getTime() - new Date(genDateOnly + 'T12:00:00').getTime()) / 86400000));
          persistData.forecasts[propId][day.date] = persistData.forecasts[propId][day.date] || [];
          persistData.forecasts[propId][day.date].push({
            generatedAt,
            leadDays,
            occ:     day.occ ?? null,
            adr:     day.adr ?? null,
            revpar:  day.revpar ?? null,
            revenue: day.revenue ?? null,
            transient: day.transient ? { rms: day.transient.rms ?? null, adr: day.transient.adr ?? null, rev: day.transient.rev ?? null } : null,
            group:     day.group     ? { rms: day.group.rms     ?? null, adr: day.group.adr     ?? null, rev: day.group.rev     ?? null } : null,
            contract:  day.contract  ? { rms: day.contract.rms  ?? null, adr: day.contract.adr  ?? null, rev: day.contract.rev  ?? null } : null
          });
          // Cap each stayDate's history at the most recent 12 entries.
          if (persistData.forecasts[propId][day.date].length > 12) {
            persistData.forecasts[propId][day.date] = persistData.forecasts[propId][day.date].slice(-12);
          }
        }
        // Prune entries where the stayDate is more than 60 days in the past
        // — once we've captured the actuals-vs-forecast delta, we don't need
        // the prediction history anymore. Keeps data.json bounded.
        const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
        for (const sd of Object.keys(persistData.forecasts[propId])) {
          if (sd < cutoff) delete persistData.forecasts[propId][sd];
        }
        saveData(persistData);
      } catch (e) {
        console.error('[forecast/daily] forecast history persist failed (continuing):', e);
      }
    }

    // ── Overlay actuals onto past days ──
    // For days that have already actualized (date < today), we want occ/adr/revpar to
    // reflect what really happened, not Claude's prediction. Two paths:
    //
    //   1. SNAPSHOT-DELTA — if we have CUMULATIVE PTD snapshots for both day-D-morning and
    //      day-(D+1)-morning, day D's actual = (D+1 snapshot) − (D snapshot). Cleanest, but
    //      only works for days bracketed by snapshots that the auto-refresh job collected.
    //
    //   2. PTD-SCALED BACK-CAST — for past days WITHOUT a snapshot pair (e.g., the current
    //      month before snapshotting started, or sparse refresh history), scale the model's
    //      forecast for those days by (actual MTD ÷ forecast MTD). Preserves the day-of-week
    //      shape Claude inferred while making the actual MTD total match reality. Tagged as
    //      "backcast" so the UI can flag it.
    //
    // Each day gets `actualSource: 'snapshot' | 'backcast' | null` so the UI can style it.
    const todayISO = new Date().toISOString().slice(0, 10);
    const isCurrentMonth = (period === currentPeriod());
    const dailyPtdForProp = (data.dailyPtd && data.dailyPtd[propId] && data.dailyPtd[propId][period]) || {};
    const totalRooms = curM.roomsAvail && daysInMonth ? curM.roomsAvail / Math.max(1, new Date(todayISO).getDate() - 1) : null;
    // For ratios we need per-day rooms_avail. PS-stored roomsAvail is cumulative MTD. The total
    // property room count = roomsAvail ÷ days_elapsed_through_PTD. Approximate, fine for here.

    function snapshotForDate(dateISO) {
      return dailyPtdForProp[dateISO] || null;
    }
    function dayActualFromSnapshots(dateISO) {
      // dateISO is the day we want (e.g., '2026-06-03'). We need snapshots taken on the
      // mornings of dateISO and dateISO+1 (so dateISO+1's snapshot includes day dateISO's posted activity).
      const d = new Date(dateISO + 'T00:00:00Z');
      const next = new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const startSnap = snapshotForDate(dateISO);
      const endSnap   = snapshotForDate(next);
      // Special case for day 1: no "morning of day 1" snapshot needed — start = 0 baseline.
      const isDay1 = dateISO.endsWith('-01');
      const start  = startSnap || (isDay1 ? { revenue: 0, roomRev: 0, roomsSold: 0, roomsAvail: 0 } : null);
      if (!start || !endSnap) return null;
      const dRev    = (endSnap.revenue    ?? 0) - (start.revenue    ?? 0);
      const dRmRev  = (endSnap.roomRev    ?? 0) - (start.roomRev    ?? 0);
      const dRmsSld = (endSnap.roomsSold  ?? 0) - (start.roomsSold  ?? 0);
      const dRmsAvl = (endSnap.roomsAvail ?? 0) - (start.roomsAvail ?? 0);
      if (dRmsAvl <= 0) return null;
      return {
        occ:    Math.round((dRmsSld / dRmsAvl) * 1000) / 10,
        adr:    dRmsSld > 0 ? Math.round((dRmRev / dRmsSld) * 100) / 100 : 0,
        revpar: Math.round((dRmRev / dRmsAvl) * 100) / 100,
        revenue: dRev,
        roomRev: dRmRev,
        roomsSold: dRmsSld
      };
    }

    if (isCurrentMonth && parsed.days && parsed.days.length === daysInMonth) {
      // Helper: total per-day revenue and rooms across segments (new schema).
      // Falls back to the old transientRev/groupRev fields if a cached entry
      // pre-dates the segment-schema rollout.
      const dayRev = (d) => {
        if (d.transient || d.group || d.contract) {
          return (d.transient?.rev || 0) + (d.group?.rev || 0) + (d.contract?.rev || 0);
        }
        return (d.transientRev || 0) + (d.groupRev || 0);
      };
      const dayRms = (d) => (d.transient?.rms || 0) + (d.group?.rms || 0) + (d.contract?.rms || 0);
      // Identify past-day rows
      const pastDays = parsed.days.filter(d => d.date < todayISO);
      if (pastDays.length > 0) {
        // Try snapshot-delta first; collect days that need back-cast
        const needsBackcast = [];
        pastDays.forEach(day => {
          const a = dayActualFromSnapshots(day.date);
          if (a) {
            day.occ           = a.occ;
            day.adr           = a.adr;
            day.revpar        = a.revpar;
            day.actualSource  = 'snapshot';
            // Keep segment forecasts as-is — we don't capture daily segment actuals yet.
          } else {
            needsBackcast.push(day);
          }
        });

        // Back-cast: scale model's per-day output so the back-cast days' MTD sum reconciles to
        // the actual MTD (minus whatever snapshot-derived days already contributed). Scale all
        // dollar fields by the same factor (revpar + each segment.rev) so they stay internally
        // consistent. Cap at [0.5, 2.0] — beyond that the model context was too stale to trust.
        let backcastWarning = null;
        if (needsBackcast.length > 0 && curM.revenue != null) {
          const snapshotPastRevSum = pastDays
            .filter(d => d.actualSource === 'snapshot')
            .reduce((s, d) => {
              const a = dayActualFromSnapshots(d.date);
              return s + (a ? a.revenue : 0);
            }, 0);
          const remainingActualMtd = (curM.revenue || 0) - snapshotPastRevSum;
          const forecastBackcastRevSum = needsBackcast.reduce((s, d) => s + dayRev(d), 0);
          const rawScale = forecastBackcastRevSum > 0 ? remainingActualMtd / forecastBackcastRevSum : null;
          const SCALE_MIN = 0.5, SCALE_MAX = 2.0;
          if (rawScale != null && isFinite(rawScale) && rawScale >= SCALE_MIN && rawScale <= SCALE_MAX) {
            const scale = rawScale;
            needsBackcast.forEach(day => {
              const newRevpar   = (day.revpar || 0) * scale;
              const newOccUncap = (day.occ || 0) * scale;
              const newOcc      = Math.min(100, newOccUncap);
              const newAdr      = newOcc > 0 ? (newRevpar * 100 / newOcc) : (day.adr || 0) * scale;
              day.occ    = Math.round(newOcc * 10) / 10;
              day.adr    = Math.round(newAdr * 100) / 100;
              day.revpar = Math.round(newRevpar * 100) / 100;
              // Scale each segment's revenue. Leave rms/adr alone — we don't know the
              // segment-level rooms-sold actuals, so distorting rooms would lie.
              ['transient', 'group', 'contract'].forEach(seg => {
                if (day[seg] && typeof day[seg] === 'object') {
                  day[seg].rev = day[seg].rev != null ? Math.round(day[seg].rev * scale) : null;
                }
              });
              day.revenue      = Math.round((day.revenue || 0) * scale);
              day.actualSource = 'backcast';
            });
          } else {
            needsBackcast.forEach(day => { day.actualSource = 'forecast'; });
            backcastWarning = rawScale != null
              ? `Model under/over-forecasted past days by ${Math.round((rawScale - 1) * 100)}% — actuals not back-cast (would distort daily shape). Re-run forecast for fresher model context.`
              : 'No forecast revenue basis to back-cast against.';
          }
        }
        parsed.backcastWarning = backcastWarning;

        // Recompute monthlyTotal so the summary reflects actuals + remaining forecast.
        // Aggregate per-segment sums across all days, plus weighted averages for ratios.
        const segTotals = { transient: { rms:0, rev:0 }, group: { rms:0, rev:0 }, contract: { rms:0, rev:0 } };
        parsed.days.forEach(d => {
          ['transient','group','contract'].forEach(seg => {
            if (d[seg]) {
              segTotals[seg].rms += (d[seg].rms || 0);
              segTotals[seg].rev += (d[seg].rev || 0);
            }
          });
        });
        const totalRev = segTotals.transient.rev + segTotals.group.rev + segTotals.contract.rev;
        const occWeighted = parsed.days.reduce((s, d) => s + (d.occ || 0), 0) / parsed.days.length;
        const revparAvg   = parsed.days.reduce((s, d) => s + (d.revpar || 0), 0) / parsed.days.length;
        parsed.monthlyTotal = {
          ...parsed.monthlyTotal,
          occ:     Math.round(occWeighted * 10) / 10,
          revpar:  Math.round(revparAvg * 100) / 100,
          revenue: Math.round(totalRev),
          transient: { rms: segTotals.transient.rms, adr: segTotals.transient.rms > 0 ? Math.round((segTotals.transient.rev / segTotals.transient.rms) * 100) / 100 : 0, rev: Math.round(segTotals.transient.rev) },
          group:     { rms: segTotals.group.rms,     adr: segTotals.group.rms     > 0 ? Math.round((segTotals.group.rev     / segTotals.group.rms)     * 100) / 100 : 0, rev: Math.round(segTotals.group.rev) },
          contract:  { rms: segTotals.contract.rms,  adr: segTotals.contract.rms  > 0 ? Math.round((segTotals.contract.rev  / segTotals.contract.rms)  * 100) / 100 : 0, rev: Math.round(segTotals.contract.rev) }
        };
      }
    }

    // Counts to surface in the response
    const actualSnap = (parsed.days || []).filter(d => d.actualSource === 'snapshot').length;
    const actualBack = (parsed.days || []).filter(d => d.actualSource === 'backcast').length;
    const forecastDays = (parsed.days || []).length - actualSnap - actualBack;

    const result = {
      propId: prop.id, propName: prop.name, period, monthName, daysInMonth,
      generatedAt: cacheHit ? new Date(cacheHit.ts).toISOString() : new Date().toISOString(),
      cached: !!cacheHit,
      cachedAt: cacheHit ? new Date(cacheHit.ts).toISOString() : null,
      model: CLAUDE_MODEL_FAST,
      actualCounts: { snapshot: actualSnap, backcast: actualBack, forecast: forecastDays },
      // Surface events the model saw (or null if lookup didn't run). Client
      // renders these as pills so the user can audit what the AI was aware of.
      events: eventsContext,
      // Phase 8: surface calibration so the UI can show recent accuracy stats
      // and the user can see whether the model has been over/under-forecasting.
      calibration: userPayload.calibrationContext,
      ...parsed
    };
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Daily forecast failed: ' + e.message });
  }
});

app.get('/api/properties/compare', checkAuth, (req, res) => {
  const { p1, p2 } = req.query;
  if (!p1 || !p2) return res.status(400).json({ error: 'p1 and p2 period params required' });
  const data   = ensureShape(loadData());
  const props  = getPropertyList();
  const result = props.filter(p => p.active).map(p => {
    const d1 = ((data.byPeriod[p1]||{})[p.id]||{}).manual || null;
    const d2 = ((data.byPeriod[p2]||{})[p.id]||{}).manual || null;
    return { ...p, [p1]: d1, [p2]: d2, score1: calcScore(d1), score2: calcScore(d2), flow1: calcFlow(d1), flow2: calcFlow(d2) };
  });
  res.json({ properties: result, p1, p2 });
});

// Multi-period aggregation (quarterly / custom ranges)
app.get('/api/properties/compare-multi', checkAuth, (req, res) => {
  const { periods1, periods2 } = req.query; // comma-separated period lists
  if (!periods1 || !periods2) return res.status(400).json({ error: 'periods1 and periods2 required (comma-separated)' });
  const p1List = periods1.split(',').filter(Boolean);
  const p2List = periods2.split(',').filter(Boolean);
  const data = ensureShape(loadData());
  const props = getPropertyList();

  function aggregatePeriods(propId, periodList) {
    const manuals = periodList.map(p => ((data.byPeriod[p] || {})[propId] || {}).manual).filter(Boolean);
    if (!manuals.length) return null;
    // Sum dollar amounts, average percentages, recalculate ratios
    const sumF = key => manuals.reduce((a, m) => a + (m[key] || 0), 0);
    const avgF = key => { const vals = manuals.filter(m => m[key] != null); return vals.length ? vals.reduce((a, m) => a + m[key], 0) / vals.length : null; };
    const tRev = sumF('revenue'), tRevBud = sumF('revBud');
    const tGopAmt = sumF('gopAmt'), tGopBudAmt = sumF('gopBudAmt');
    const tNoi = sumF('noiAmt'), tNoiBud = sumF('noiBudAmt');
    const tRoomsAvail = sumF('roomsAvail'), tRoomsSold = sumF('roomsSold');
    const tRoomRev = manuals.reduce((a, m) => {
      if (m.adr != null && m.roomsSold) return a + (m.adr * m.roomsSold);
      return a + (m.revpar && m.roomsAvail ? m.revpar * m.roomsAvail : 0);
    }, 0);
    const occ = tRoomsAvail > 0 ? Math.round((tRoomsSold / tRoomsAvail) * 1000) / 10 : avgF('occ');
    const adr = tRoomsSold > 0 && tRoomRev ? Math.round((tRoomRev / tRoomsSold) * 100) / 100 : avgF('adr');
    const revpar = tRoomsAvail > 0 && tRoomRev ? Math.round((tRoomRev / tRoomsAvail) * 100) / 100 : avgF('revpar');
    const gopPct = tRev > 0 && tGopAmt != null ? Math.round((tGopAmt / tRev) * 1000) / 10 : avgF('gop');
    return {
      revpar, revparBud: avgF('revparBud'), occ, occBud: avgF('occBud'),
      adr, adrBud: avgF('adrBud'), gop: gopPct,
      gopAmt: tGopAmt, gopBudAmt: tGopBudAmt, revenue: tRev, revBud: tRevBud,
      labor: avgF('labor'), laborBud: avgF('laborBud'),
      guestScore: avgF('guestScore'), noiAmt: tNoi, noiBudAmt: tNoiBud,
      roomsSold: tRoomsSold, roomsAvail: tRoomsAvail
    };
  }

  const result = props.filter(p => p.active).map(p => {
    const d1 = aggregatePeriods(p.id, p1List);
    const d2 = aggregatePeriods(p.id, p2List);
    return { ...p, periodA: d1, periodB: d2, score1: calcScore(d1), score2: calcScore(d2), flow1: calcFlow(d1), flow2: calcFlow(d2) };
  });
  res.json({ properties: result, periods1: p1List, periods2: p2List });
});

app.put('/api/properties/:id/data', checkAuth, (req, res) => {
  const period = req.query.period || loadConfig().activePeriod;
  const data   = ensureShape(loadData());
  const id     = parseInt(req.params.id);
  if (!data.byPeriod[period]) data.byPeriod[period] = {};
  const existing = data.byPeriod[period][id] || {};
  // Merge — never wipe PS-fed financials or auto-snapshotted fields with a partial form save
  data.byPeriod[period][id] = { ...existing, manual: { ...(existing.manual||{}), ...(req.body||{}) }, lastUpdated: new Date().toISOString(), source: 'manual' };
  saveData(data);
  res.json({ saved: true, period });
});

app.post('/api/properties/bulk-save', checkAuth, (req, res) => {
  const period  = req.query.period || loadConfig().activePeriod;
  const data    = ensureShape(loadData());
  const entries = req.body.entries;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });
  if (!data.byPeriod[period]) data.byPeriod[period] = {};
  const now = new Date().toISOString();
  entries.forEach(e => {
    if (!e.id) return;
    const existing = data.byPeriod[period][e.id] || {};
    data.byPeriod[period][e.id] = { ...existing, manual: { ...(existing.manual||{}), ...(e.manual||{}) }, lastUpdated: now, source: 'manual' };
    if (e.str) data.byPeriod[period][e.id].str = e.str;
  });
  data.lastUpdated = now;
  saveData(data);
  res.json({ saved: true, count: entries.length, period });
});

// ─── HR / JOB POSTINGS ──────────────────────────────────────────────────────
// Stored at data.hr.jobs[]. Each job: { id, title, propertyId, department, type, status,
// postedDate, targetCloseDate, applicationsCount, candidatesCount, url, notes, updatedAt }.
app.get('/api/hr/jobs', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  res.json({ jobs: data.hr.jobs || [] });
});

app.post('/api/hr/jobs', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const job = {
    id: Date.now(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.hr.jobs.unshift(job);
  saveData(data);
  res.json({ job });
});

app.put('/api/hr/jobs/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const id = parseInt(req.params.id);
  const idx = data.hr.jobs.findIndex(j => j.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Job not found' });
  data.hr.jobs[idx] = { ...data.hr.jobs[idx], ...req.body, id, updatedAt: new Date().toISOString() };
  saveData(data);
  res.json({ job: data.hr.jobs[idx] });
});

app.delete('/api/hr/jobs/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const id = parseInt(req.params.id);
  data.hr.jobs = (data.hr.jobs || []).filter(j => j.id !== id);
  saveData(data);
  res.json({ deleted: true });
});

// ─── BALANCE SHEET (Tier 2) ─────────────────────────────────────────────────
// Stored at data.byPeriod[period][propId].balanceSheet, point-in-time at period close.
// Source = 'manual' for hand-entered values, 'm3' for live-pulled values (once M3 API is enabled).
app.get('/api/balance-sheet/:propId', checkAuth, (req, res) => {
  const period = req.query.period || loadConfig().activePeriod;
  const id     = parseInt(req.params.propId);
  const data   = ensureShape(loadData());
  const stored = ((data.byPeriod[period]||{})[id]||{}).balanceSheet || null;
  res.json({ propertyId: id, period, balanceSheet: stored });
});

app.put('/api/balance-sheet/:propId', checkAuth, (req, res) => {
  const period = req.query.period || loadConfig().activePeriod;
  const id     = parseInt(req.params.propId);
  const data   = ensureShape(loadData());
  if (!data.byPeriod[period]) data.byPeriod[period] = {};
  if (!data.byPeriod[period][id]) data.byPeriod[period][id] = {};
  data.byPeriod[period][id].balanceSheet = {
    ...(req.body || {}),
    source: req.body?.source || 'manual',
    updatedAt: new Date().toISOString()
  };
  saveData(data);
  res.json({ saved: true, period, propertyId: id });
});

// ─── M3 CONNECTOR ENDPOINTS (placeholder until M3 API access provisioned) ──
let _m3Connector = null;
try { _m3Connector = require('./shared/connectors/m3'); } catch (e) { console.log('[M3] connector module not loadable:', e.message); }

app.get('/api/m3/test', checkAuth, async (req, res) => {
  if (!_m3Connector) return res.json({ ok: false, error: 'connector module missing' });
  try { res.json(await _m3Connector.testConnection()); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/m3/sync-bs', checkAuth, async (req, res) => {
  if (!_m3Connector || !_m3Connector.isEnabled()) {
    return res.status(501).json({
      error: 'M3 not enabled',
      message: 'M3 API access must be provisioned and configured before balance-sheet sync can run. See docs/INTEGRATION_REQUESTS.md.'
    });
  }
  // TODO: iterate active properties, call getBalanceSheet, persist to data.byPeriod[period][propId].balanceSheet
  res.status(501).json({ error: 'sync not implemented yet — connector placeholder only' });
});

// STR data save
app.put('/api/properties/:id/str', checkAuth, (req, res) => {
  const period = req.query.period || loadConfig().activePeriod;
  const data   = ensureShape(loadData());
  const id     = parseInt(req.params.id);
  if (!data.byPeriod[period]) data.byPeriod[period] = {};
  if (!data.byPeriod[period][id]) data.byPeriod[period][id] = {};
  data.byPeriod[period][id].str = { ...req.body, updatedAt: new Date().toISOString() };
  saveData(data);
  res.json({ saved: true });
});

app.get('/api/periods', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  res.json({ periods: Object.keys(data.byPeriod).sort().reverse() });
});

app.delete('/api/data/clear', checkAuth, (req, res) => {
  const period = req.query.period || loadConfig().activePeriod;
  const data = ensureShape(loadData());
  if (data.byPeriod[period]) {
    delete data.byPeriod[period];
    saveData(data);
  }
  res.json({ ok: true, period });
});

// ─── NOTES ──────────────────────────────────────────────────────────────────
// Notes are per-property (not per-period) — rolling operational context
app.get('/api/notes/:propId', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  res.json({ notes: data.notes[req.params.propId] || { current: '', history: [] } });
});
app.put('/api/notes/:propId', checkAuth, (req, res) => {
  const data   = ensureShape(loadData());
  const id     = req.params.propId;
  const prev   = data.notes[id] || { current: '', history: [] };
  const { text } = req.body;
  if (prev.current && prev.current !== text) {
    prev.history = [{ text: prev.current, savedAt: new Date().toISOString() }, ...(prev.history||[])].slice(0, 10);
  }
  prev.current = text;
  data.notes[id] = prev;
  saveData(data);
  res.json({ saved: true });
});

// ─── PIPELINE ───────────────────────────────────────────────────────────────
app.get('/api/pipeline', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  res.json({ pipeline: data.pipeline || [] });
});
app.post('/api/pipeline', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const item = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
  data.pipeline = [item, ...(data.pipeline||[])];
  saveData(data);
  res.json({ item });
});
app.put('/api/pipeline/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const id   = parseInt(req.params.id);
  data.pipeline = (data.pipeline||[]).map(p => p.id === id ? { ...p, ...req.body, updatedAt: new Date().toISOString() } : p);
  saveData(data);
  res.json({ saved: true });
});
app.delete('/api/pipeline/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  data.pipeline = (data.pipeline||[]).filter(p => p.id !== parseInt(req.params.id));
  saveData(data);
  res.json({ deleted: true });
});

// ─── BRAND COMPLIANCE ───────────────────────────────────────────────────────
app.get('/api/compliance', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  res.json({ compliance: data.brandCompliance || {} });
});
app.put('/api/compliance/:propId', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  data.brandCompliance[req.params.propId] = { ...req.body, updatedAt: new Date().toISOString() };
  saveData(data);
  res.json({ saved: true });
});

// ─── BRAND AUDIT PDF UPLOAD & EXTRACTION ────────────────────────────────────
app.post('/api/compliance/upload-audit', checkAuth, upload.single('auditPdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Claude API key not configured. Enter it in Admin first.' });
  }

  try {
    // 1. Extract text from PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData   = await pdfParse(pdfBuffer);
    const pdfText   = pdfData.text;

    if (!pdfText || pdfText.trim().length < 50) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Could not extract readable text from PDF. The file may be image-based or encrypted.' });
    }

    // 2. Send to Claude for structured extraction
    const propList = getPropertyList().filter(p => p.active).map(p =>
      `ID:${p.id} — ${p.name} (${p.brand}, ${p.brandFamily}, ${p.state})`
    ).join('\n');

    const system = `You are a hotel brand QA audit data extractor for Superhost Hospitality. Extract structured compliance data from brand audit PDFs (Hilton, Marriott, IHG, Choice). Return ONLY valid JSON — no markdown, no explanation.\n\nActive properties:\n${propList}`;

    const prompt = `Extract the brand audit data from this document. Return a JSON array where each element represents one property found in the audit. Match each property to the closest property ID from the list above.\n\nFor each property return:\n{\n  "propId": <number — matched property ID from list above, or null if no match>,\n  "propertyName": "<name as shown in audit>",\n  "brand": "<brand family: Hilton, Marriott, IHG, or Choice>",\n  "score": <QA score 0-100, or null if not found>,\n  "lastInspection": "<date in YYYY-MM-DD format, or null>",\n  "nextWindow": "<next inspection date YYYY-MM-DD, or null>",\n  "openPIPs": <number of open PIP items, or 0>,\n  "status": "<compliant|watch|at-risk|in-pip — infer from score/language>",\n  "deficiencies": ["<list of specific deficiency items found>"],\n  "notes": "<summary of key findings, action items, deadlines — 2-3 sentences max>"\n}\n\nRules:\n- If the audit is for a single property, return a 1-element array\n- Infer status: score >= 90 = compliant, 75-89 = watch, 60-74 = at-risk, <60 = in-pip\n- Extract ALL deficiency items, PIP items, and action items mentioned\n- Convert all dates to YYYY-MM-DD format\n- If a field isn't in the document, use null (not empty string)\n\nAudit document text:\n\n${pdfText.substring(0, 12000)}`;

    const rawResponse = await callClaude(apiKey, system, [{ role: 'user', content: prompt }], 3000);

    // 3. Parse Claude's JSON response
    let extracted;
    try {
      // Strip markdown code fences if Claude wraps it
      const jsonStr = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      extracted = JSON.parse(jsonStr);
      if (!Array.isArray(extracted)) extracted = [extracted];
    } catch (parseErr) {
      console.error('[Audit] JSON parse failed:', parseErr.message, 'Raw:', rawResponse.substring(0, 500));
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ error: 'Could not parse audit data. Try a cleaner PDF.', raw: rawResponse.substring(0, 1000) });
    }

    // 4. Auto-save extracted data to compliance records
    const data    = ensureShape(loadData());
    const saved   = [];
    const unmatched = [];

    for (const entry of extracted) {
      if (entry.propId) {
        const record = {
          score: entry.score,
          brand: entry.brand || 'Hilton',
          lastInspection: entry.lastInspection,
          nextWindow: entry.nextWindow,
          openPIPs: entry.openPIPs || 0,
          status: entry.status || 'compliant',
          notes: entry.notes || '',
          deficiencies: entry.deficiencies || [],
          source: 'pdf-upload',
          uploadedAt: new Date().toISOString(),
          fileName: req.file.originalname
        };
        data.brandCompliance[entry.propId] = { ...record, updatedAt: new Date().toISOString() };
        saved.push({ propId: entry.propId, name: entry.propertyName, score: entry.score, status: entry.status });
      } else {
        unmatched.push(entry);
      }
    }

    saveData(data);
    fs.unlink(req.file.path, () => {}); // Clean up temp file

    res.json({
      success: true,
      extracted: extracted.length,
      saved: saved.length,
      savedProperties: saved,
      unmatched,
      pdfPages: pdfData.numpages,
      textLength: pdfText.length
    });

  } catch (e) {
    console.error('[Audit] Upload error:', e.message);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Audit extraction failed: ' + e.message });
  }
});

// ─── ALERTS ─────────────────────────────────────────────────────────────────
app.get('/api/alerts',         checkAuth, (req, res) => res.json({ alerts: ensureShape(loadData()).alerts || [] }));
app.post('/api/alerts',        checkAuth, (req, res) => { const data = ensureShape(loadData()); const alert = { id: Date.now(), ...req.body, created: new Date().toISOString() }; data.alerts = [alert, ...(data.alerts||[])].slice(0,100); saveData(data); res.json({ alert }); });
app.delete('/api/alerts/:id',  checkAuth, (req, res) => { const data = ensureShape(loadData()); data.alerts = (data.alerts||[]).filter(a => a.id !== parseInt(req.params.id)); saveData(data); res.json({ deleted: true }); });

// ─── AI PROXY (Claude / Anthropic) ─────────────────────────────────────────
// Default model — used by chat, narrative generation, etc. (where reasoning quality matters).
// Individual endpoints can override per-call (e.g., daily forecast uses Haiku for cost).
// Default model — bumped from Sonnet 4 (May 2025) to Sonnet 4.6 in 2026-05.
// The 4.6 release has a higher per-minute input-token cap on the same tier
// (see memory/project_anthropic_tier_limits.md). All non-fast Claude calls
// (general chat, council, scans, role agents) use this model. Override via
// the CLAUDE_MODEL env var.
const CLAUDE_MODEL   = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
// Cheap-and-fast model for high-volume structured-JSON tasks (daily forecasts, etc.).
// ~5x cheaper than Sonnet, comparable on tabular numeric output, slightly less nuance on prose.
const CLAUDE_MODEL_FAST = process.env.CLAUDE_MODEL_FAST || 'claude-haiku-4-5-20251001';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

function aiKey(config) {
  return config.aiKey || config.groqKey || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY || '';
}

// ─── CANONICAL VOICE INJECTION ───────────────────────────────────────────────
// Single source of truth at superhost-agents/shared/voice/superhost.md.
// Prepended to the system prompt of every Claude call by default — skill specs,
// persona files, and SH_CORE in dashboard.html no longer need to restate voice
// rules. Updates to the voice file propagate to every output instantly.
//
// Skip via opts.skipVoice for structured-JSON-only endpoints (e.g. daily forecast)
// where prose voice rules don't apply.
const VOICE_FILE = path.join(__dirname, 'superhost-agents', 'shared', 'voice', 'superhost.md');
let _voiceCache = null;
let _voiceCacheTs = 0;
function loadVoiceBlock() {
  // Hot-reload at most once per 30s — voice edits don't require restart.
  if (_voiceCache && (Date.now() - _voiceCacheTs) < 30 * 1000) return _voiceCache;
  try {
    _voiceCache = fs.readFileSync(VOICE_FILE, 'utf8');
    _voiceCacheTs = Date.now();
    return _voiceCache;
  } catch (e) {
    console.warn('[VOICE] Failed to load voice file:', e.message);
    return '';
  }
}

async function callClaude(apiKey, system, messages, maxTokens=2000, modelOverride=null, opts={}) {
  const skipVoice = opts.skipVoice === true;
  const voiceBlock = skipVoice ? '' : loadVoiceBlock();
  const fullSystem = voiceBlock
    ? `${voiceBlock}\n\n========================================\nROLE / CONTEXT (specific to this request)\n========================================\n\n${system || ''}`
    : (system || '');
  const timeoutMs = opts.timeoutMs || 90000;
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : 2;
  const requestBody = JSON.stringify({
    model: modelOverride || CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: fullSystem,
    messages: messages.map(m => ({ role: m.role, content: String(m.content) }))
  });

  // Rate-limit-aware retry loop. Anthropic returns 429 with a Retry-After
  // header (seconds) when the per-minute input-token cap is hit. On 429 we
  // wait Retry-After (or fall back to 60s + jitter) and retry up to maxRetries
  // times. Other 5xx errors get one quick retry. Final failure throws with
  // the original error message so the caller can surface it.
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        agent: IPV4_AGENT,
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error(`Claude API timed out after ${timeoutMs}ms`);
      // Network error — retry once if we have attempts left
      if (attempt < maxRetries) { await _sleep(1000 + Math.random() * 1000); continue; }
      throw e;
    }
    clearTimeout(timer);

    // 429 → backoff per Retry-After header, then retry
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = parseFloat(response.headers.get('retry-after') || '0');
      const waitMs = (retryAfter > 0 ? retryAfter * 1000 : 60000) + Math.random() * 1500;
      console.warn(`[callClaude] 429 rate limit, waiting ${Math.round(waitMs/1000)}s (attempt ${attempt+1}/${maxRetries+1})`);
      await _sleep(waitMs);
      continue;
    }
    // 5xx → one quick retry with jitter
    if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
      console.warn(`[callClaude] ${response.status} server error, retrying after backoff (attempt ${attempt+1}/${maxRetries+1})`);
      await _sleep(2000 + Math.random() * 2000);
      continue;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || `Claude API error ${response.status}`);
    const block = result.content?.[0];
    if (!block || typeof block.text !== 'string') {
      throw new Error(`Claude returned unexpected content shape: ${JSON.stringify(block || null).substring(0, 200)}`);
    }
    return block.text;
  }
  // Exhausted retries — last attempt should have either succeeded or thrown.
  throw new Error('Claude API rate-limited after exhausted retries (10K input-TPM cap on current Anthropic tier — consider tier upgrade or wider per-call caching).');
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Claude with web_search (server-side tool) ──────────────────────────────
// Anthropic's web_search is a SERVER tool — the API handles the searches and
// feeds results back into Claude server-side, returning a synthesized final
// text response in one round-trip. No client-side tool loop needed.
//
// Used for: events / compression intelligence (forecast stack Layer 3). Looks
// up real events affecting a property's market at forecast time so the AI
// has location-aware demand-drivers without us building Ticketmaster /
// PredictHQ API plumbing.
//
// Cost note: web_search has a per-search fee on top of Claude tokens. Cap
// max_uses at 4 to keep cost predictable. Cache results in data.events so
// the same lookup doesn't repeat for 48h.
async function callClaudeWithWebSearch(apiKey, system, userText, modelOverride = null, maxUses = 4, timeoutMs = 60000, maxRetries = 2) {
  const requestBody = JSON.stringify({
    model: modelOverride || CLAUDE_MODEL_FAST,
    max_tokens: 3000,
    system,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }],
    messages: [{ role: 'user', content: userText }]
  });
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        agent: IPV4_AGENT,
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error(`Claude web_search timed out after ${timeoutMs}ms`);
      if (attempt < maxRetries) { await _sleep(1000 + Math.random() * 1000); continue; }
      throw e;
    }
    clearTimeout(timer);
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = parseFloat(response.headers.get('retry-after') || '0');
      const waitMs = (retryAfter > 0 ? retryAfter * 1000 : 60000) + Math.random() * 1500;
      console.warn(`[callClaudeWithWebSearch] 429 rate limit, waiting ${Math.round(waitMs/1000)}s (attempt ${attempt+1}/${maxRetries+1})`);
      await _sleep(waitMs);
      continue;
    }
    if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
      await _sleep(2000 + Math.random() * 2000);
      continue;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || `Claude web_search error ${response.status}`);
    const blocks = result.content || [];
    const finalText = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!finalText) throw new Error('Claude web_search returned no text output');
    return finalText;
  }
  throw new Error('Claude web_search rate-limited after exhausted retries.');
}

// ─── Events Lookup (Forecast Stack Layer 3) ─────────────────────────────────
const EVENTS_CACHE_MS = 48 * 60 * 60 * 1000; // 48 hours

// Build the events-search prompt for a property × period and ask Claude
// (with web_search) to return a JSON array of demand-affecting events.
// Conservative: better to miss an event than fabricate one — model is told
// to only include events it can verify via search.
async function lookupEventsForProperty(prop, period, opts = {}) {
  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey) return { events: [], source: 'no-api-key', error: 'No Claude API key configured.' };

  const [year, month] = period.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  const city = prop.city || '(city unknown)';
  const state = prop.state || '';

  const sys = `You are a hotel revenue manager looking up real events that will impact hotel demand. You use web search to find verified events in the property's market for a specific calendar month. You return ONLY a JSON array — no prose, no markdown fences, no commentary. If you can't verify any events, return an empty array.`;

  const userText = `Property: ${prop.name} (${prop.brand}) in ${city}, ${state}
Target month: ${monthName} ${year}

Use web search to find events in or near ${city}, ${state} during ${monthName} ${year} that would affect hotel demand. Look for:
- Concerts at major venues
- College and pro sports (especially SEC football, NCAA basketball, NFL, MLB)
- Conventions, trade shows, and corporate gatherings
- Festivals and cultural events
- University events (graduation, parents weekend, move-in/out)
- Religious / political gatherings of size
- Major employer events (corporate retreats, plant openings)

Search the actual web — don't recall events from memory.

After searching, return ONLY a JSON array (raw — no \`\`\`json fences) like:
[
  {
    "date": "YYYY-MM-DD",
    "name": "Event name",
    "type": "concert" | "sports" | "convention" | "festival" | "graduation" | "corporate" | "religious" | "other",
    "venue": "Venue name or null",
    "estAttendance": number_or_null,
    "demandImpact": "high" | "medium" | "low",
    "note": "1-2 sentences on the demand effect — when impact peaks, transient vs group, lead-time pattern"
  }
]

Multi-day events: emit one row per day of meaningful impact. Be conservative — only include events you can verify via search. Empty array is a valid answer if there's nothing verifiable. No prose, just the JSON array.`;

  try {
    const txt = await callClaudeWithWebSearch(apiKey, sys, userText, CLAUDE_MODEL_FAST, 4, 60000);
    // Strip code fences if Claude added them despite the instruction
    let cleaned = txt.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '').trim();
    // Find the JSON array
    const startIdx = cleaned.indexOf('[');
    const endIdx   = cleaned.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
      return { events: [], source: 'ai-websearch', error: 'No JSON array in response', rawPreview: cleaned.slice(0, 200) };
    }
    let parsed;
    try { parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1)); }
    catch (e) { return { events: [], source: 'ai-websearch', error: 'JSON parse failed: ' + e.message, rawPreview: cleaned.slice(0, 300) }; }
    if (!Array.isArray(parsed)) return { events: [], source: 'ai-websearch', error: 'Response was not a JSON array' };
    // Validate + normalize each event. Drop entries missing critical fields.
    const validImpacts = new Set(['high', 'medium', 'low']);
    const validTypes   = new Set(['concert', 'sports', 'convention', 'festival', 'graduation', 'corporate', 'religious', 'other']);
    const clean = parsed
      .filter(e => e && typeof e === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || '')))
      .filter(e => String(e.date).startsWith(period + '-')) // events MUST land inside the requested month
      .map(e => ({
        date: e.date,
        name: String(e.name || '').slice(0, 200),
        type: validTypes.has(String(e.type || '').toLowerCase()) ? String(e.type).toLowerCase() : 'other',
        venue: e.venue ? String(e.venue).slice(0, 200) : null,
        estAttendance: (typeof e.estAttendance === 'number' && e.estAttendance >= 0) ? Math.round(e.estAttendance) : null,
        demandImpact: validImpacts.has(String(e.demandImpact || '').toLowerCase()) ? String(e.demandImpact).toLowerCase() : 'medium',
        note: String(e.note || '').slice(0, 400)
      }))
      .filter(e => e.name);
    return { events: clean, source: 'ai-websearch' };
  } catch (e) {
    return { events: [], source: 'ai-websearch', error: e.message };
  }
}

// GET /api/events/:propId/:period?force=1 — returns cached events (or
// triggers a fresh web_search lookup if stale or forced). Same endpoint
// is called internally by the daily-forecast endpoint to inject events
// into the forecast prompt.
app.get('/api/events/:propId/:period', checkAuth, async (req, res) => {
  const pid = parseInt(req.params.propId, 10);
  if (isNaN(pid)) return res.status(400).json({ error: 'propId must be numeric' });
  const period = req.params.period;
  if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'period must be YYYY-MM' });
  const prop = getPropertyList().find(p => p.id === pid);
  if (!prop) return res.status(404).json({ error: `Property ${pid} not found` });

  const data = ensureShape(loadData());
  data.events[pid] = data.events[pid] || {};
  const cached = data.events[pid][period];
  const force = req.query.force === '1' || req.query.force === 'true';
  const fresh = cached && (Date.now() - new Date(cached.generatedAt).getTime() < EVENTS_CACHE_MS);

  if (cached && fresh && !force) {
    return res.json({ propId: pid, period, fromCache: true, ...cached });
  }
  // Trigger a fresh lookup
  const result = await lookupEventsForProperty(prop, period);
  const record = {
    generatedAt: new Date().toISOString(),
    source: result.source || 'ai-websearch',
    events: result.events || [],
    ...(result.error ? { error: result.error } : {})
  };
  data.events[pid][period] = record;
  try { saveData(data); } catch (e) { console.error('[events] save failed:', e); }
  res.json({ propId: pid, period, fromCache: false, ...record });
});

// ─── TRACK BLOCK VALIDATION ──────────────────────────────────────────────────
// Many skills end with a ```track ... ``` JSON block: watchlist entries, actions,
// decisions to commit. The canonical voice spec requires propertyId be the numeric
// id from the portfolio snapshot (not a slug or property name). This helper parses
// the block, validates the schema, and returns structured findings the client can
// surface alongside the prose output.
//
// Returns: { found: bool, valid: bool, parsed: <obj|null>, errors: [str], warnings: [str] }
function validateTrackBlock(text, propertyList) {
  const out = { found: false, valid: true, parsed: null, errors: [], warnings: [] };
  if (typeof text !== 'string') return out;
  const match = text.match(/```track\s*\n([\s\S]*?)\n```/);
  if (!match) return out;
  out.found = true;
  let parsed;
  try { parsed = JSON.parse(match[1]); }
  catch (e) {
    out.valid = false;
    out.errors.push(`Track block is not valid JSON: ${e.message.substring(0, 120)}`);
    return out;
  }
  out.parsed = parsed;
  const validIds = new Set((propertyList || []).map(p => p.id));
  const checkPropertyId = (val, ctx) => {
    if (val === null) return; // null is allowed for portfolio-level
    if (typeof val !== 'number' || !Number.isInteger(val)) {
      out.errors.push(`${ctx}: propertyId must be a numeric id (got ${JSON.stringify(val)})`);
      out.valid = false;
      return;
    }
    if (validIds.size && !validIds.has(val)) {
      out.warnings.push(`${ctx}: propertyId ${val} doesn't match any active property`);
    }
  };
  const checkDate = (val, ctx) => {
    if (val === null || val === undefined || val === '') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(val))) {
      out.errors.push(`${ctx}: dueDate must be YYYY-MM-DD (got ${JSON.stringify(val)})`);
      out.valid = false;
    }
  };
  const checkOwner = (val, ctx) => {
    if (typeof val !== 'string' || !val.trim()) {
      out.errors.push(`${ctx}: owner must be a non-empty named person`);
      out.valid = false;
      return;
    }
    if (/^(team|operations|management|tbd|unknown)$/i.test(val.trim())) {
      out.warnings.push(`${ctx}: owner "${val}" is generic — voice rule says specific named person`);
    }
  };
  if (Array.isArray(parsed.watchlist)) {
    parsed.watchlist.forEach((w, i) => checkPropertyId(w.propertyId, `watchlist[${i}]`));
  }
  if (Array.isArray(parsed.actions)) {
    parsed.actions.forEach((a, i) => {
      checkPropertyId(a.propertyId, `actions[${i}]`);
      checkDate(a.dueDate, `actions[${i}]`);
      checkOwner(a.owner, `actions[${i}]`);
    });
  }
  if (Array.isArray(parsed.decisions)) {
    parsed.decisions.forEach((d, i) => {
      checkPropertyId(d.propertyId, `decisions[${i}]`);
      checkDate(d.dueDate, `decisions[${i}]`);
      checkOwner(d.recommendedOwner, `decisions[${i}]`);
    });
  }
  return out;
}

// ─── SKILL INJECTION ─────────────────────────────────────────────────────────
// When a chat message contains [SKILL: skill-id], load
// superhost-agents/skills/<skill-id>/SKILL.md and prepend it to the system
// prompt. This is what makes a launcher card actually deliver its full format
// spec — not just a 1-line nudge.
const SKILLS_DIR = path.join(__dirname, 'superhost-agents', 'skills');
const SKILL_TAG_RE = /\[SKILL:\s*([a-z0-9-]+)\s*\]/i;

function loadSkillContent(skillId) {
  if (!skillId) return null;
  const p = path.join(SKILLS_DIR, skillId, 'SKILL.md');
  if (!fs.existsSync(p)) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function detectSkillFromMessages(messages) {
  if (!Array.isArray(messages)) return null;
  // Scan the most recent user message first; fall back to any.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const c = typeof m?.content === 'string' ? m.content : '';
    const match = c.match(SKILL_TAG_RE);
    if (match) return match[1];
  }
  return null;
}

function buildSkillSystemBlock(skillId) {
  const content = loadSkillContent(skillId);
  if (!content) return '';
  return [
    '\n\n========================================',
    `LOADED SKILL: ${skillId}`,
    '========================================',
    'The user invoked this skill. Apply its rules, voice, and exact output format. The user message may have additional context — honor it but never violate the skill spec.',
    '',
    content,
    '========================================',
    'END SKILL DEFINITION',
    '========================================\n'
  ].join('\n');
}

app.post('/api/ai/chat', checkAuth, aiRateLimit, async (req, res) => {
  // Wrap the WHOLE handler — loadData / parsePersonaFile / snapshot building
  // can all throw on corrupt state. Without this Express has no async-error
  // path and the response hangs.
  try {
    const config = loadConfig();
    const apiKey = aiKey(config);
    if (!apiKey) return res.status(400).json({
      error: 'Claude API key not configured. Go to console.anthropic.com → API Keys, then enter it in Admin.'
    });
    const { messages, system, maxTokens, model } = req.body || {};
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

    const data       = ensureShape(loadData());
    const snapshot   = buildPortfolioSnapshot(data, config.activePeriod);
    const skillId    = detectSkillFromMessages(messages);
    const skillBlock = skillId ? buildSkillSystemBlock(skillId) : '';
    const fullSystem = (system||'') + skillBlock + '\n\n' + snapshot;

    // Per-call model override — used by Reports panel to route heavy skills (e.g.
    // portfolio-quarterly-rollup) through Haiku 4.5 so their large system prompts
    // fit under tier-bound Sonnet input-tokens-per-minute caps. Falls through to
    // callClaude's CLAUDE_MODEL default when omitted.
    const rawText = await callClaude(apiKey, fullSystem, messages, maxTokens || (skillId ? 4000 : 2000), model || null);
    // Strip handoff block (if present) so the suggestion lives in metadata,
    // not in the visible prose. Track block stays in the text — validateTrackBlock
    // is non-anchored and tolerates either order.
    const { cleanText: text, handoff } = extractHandoffBlock(rawText);
    // Validate any embedded track block (watchlist/actions/decisions schema).
    // Surfaced alongside the prose so the client can flag voice/schema drift.
    const trackValidation = validateTrackBlock(text, getPropertyList());
    res.json({
      content: [{ type: 'text', text }],
      skillLoaded: skillId || null,
      trackValidation: trackValidation.found ? trackValidation : null,
      suggestedHandoff: handoff
    });
  } catch (e) {
    console.error('[ai/chat] error:', e);
    res.status(500).json({ error: 'AI request failed: ' + e.message });
  }
});

// List installed skills (for admin / future UIs)
app.get('/api/skills', checkAuth, (req, res) => {
  if (!fs.existsSync(SKILLS_DIR)) return res.json({ skills: [] });
  const skills = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const skillFile = path.join(SKILLS_DIR, d.name, 'SKILL.md');
      const exists = fs.existsSync(skillFile);
      let frontmatter = {};
      if (exists) {
        const raw = fs.readFileSync(skillFile, 'utf8');
        const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
        if (m) {
          m[1].split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx > 0) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          });
        }
      }
      return { id: d.name, hasFile: exists, name: frontmatter.name || d.name, description: frontmatter.description || '' };
    });
  res.json({ skills });
});

// ─── GENERATE NARRATIVE (Claude) ───────────────────────────────────────────
app.post('/api/generate/:type', checkAuth, aiRateLimit, async (req, res) => {
  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured. See Admin.' });

  const data       = ensureShape(loadData());
  const snapshot   = buildPortfolioSnapshot(data, config.activePeriod);
  const baseSystem = `You are the senior leadership team of Superhost Hospitality — a hotel management company operating 17 branded select-service and extended-stay hotels across IL, MI, NC, TX, KY, IN, GA. Brands: Hilton, Marriott, IHG, Choice. You think with the combined expertise of: Founder/President (strategy, capital, ownership), COO (execution, accountability), VP of HR & Corporate Counsel (labor, compliance, risk), SVP of Hotel Performance (revenue, STR, comp sets), Director of Systems & Analytics (data integrity, BI), Regional Director of Operations (property execution, brand standards), VP of Construction & Project Development (capex, renovations, PIPs), RVP of Sales (segment strategy, pipeline), VP of Accounting & Finance (P&L, cash flow, debt service), Corporate Director of Accounting (reporting, owner packages), Corporate Controller (controls, variance investigation), Senior Regional Controller (property-level financial oversight), Area GM Chris Chatfield (24 years, NOI-first operator), Area Director of Sales (portfolio sales, cross-selling). COO: Tim Foley. RDOs: Jennifer Kruk, Mark Gammill. RSMs: Teresa Bitner, Nate Taylor.

OBJECTIVE: Apply every relevant discipline to the analysis. Identify revenue and GOP variance drivers from operational, financial, commercial, and strategic perspectives. Separate structural issues vs short-term noise vs execution gaps. Recommend actions that improve NOI while managing risk across HR, legal, capital, brand, and guest experience.

OUTPUT FORMAT:
1. Top-line performance (Revenue vs Budget vs LY)
2. Profitability deep-dive (GOP, Margin, Flow-through)
3. Key drivers by discipline (Revenue, labor/HR, capital, sales, accounting)
4. Risk register (operational, financial, legal/compliance, brand, market — next 30-60 days)
5. Action plan (3-5 precise moves with responsible discipline identified)

FORMULAS: Flow% = (Actual GOP$ − Budget GOP$) adjusted ÷ ABS(Actual Rev − Budget Rev). Score 0-200 composite.

RULES: No generic statements — every insight tied to a number. Quantify in dollars. Variances >5% require root-cause from the relevant discipline. Use hotel terminology correctly.`;
// (Voice + structure + self-check come from the canonical voice block prepended by callClaude.)

  let prompt = '';
  const { propId, rdo } = req.body;

  if (req.params.type === 'rdo-recap') {
    const rdoName = rdo || 'all';
    prompt = `Generate a complete weekly RDO recap for ${rdoName === 'all' ? 'all RDO territories' : rdoName + "'s territory"}.\n\nFormat:\n1. PORTFOLIO POSITION — NOI vs budget in dollars. Revenue variance. Flow-through. One line: are we ahead or behind and by how much?\n2. BY TERRITORY — For each RDO: RevPAR vs budget ($ and %), GOP%, flow%, top performer (name + numbers), bottom performer (name + what's wrong), 1-2 specific action items with deadlines.\n3. FLAGGED PROPERTIES — Any with score <90 or flow <0 or RevPAR index <95. For each: what is the issue (structural vs execution), what intervention is required, who owns it, by when.\n4. 7-DAY PRIORITIES — 3 specific, measurable actions. Not "review rates" — "Tim to submit revised Q2 rate strategy for Embassy Naperville by Friday targeting $8 ADR lift."\n5. WINS — Top performer with specific numbers. What are they doing differently. Can it be replicated.\n\nRules: No generic commentary. If a property is underperforming, name it and quantify the gap. If an RDO territory is lagging, say it directly.`;
  } else if (req.params.type === 'gm-prep') {
    const prop = getPropertyList().find(p => p.id === parseInt(propId));
    if (!prop) return res.status(400).json({ error: 'Property not found' });
    const pData = (data.byPeriod[config.activePeriod]||{})[prop.id]||{};
    const m     = pData.manual||{};
    const score = calcScore(m);
    const flow  = calcFlow(m);
    const note  = (data.notes[prop.id]||{}).current||'';
    prompt = `Generate a GM prep form for my upcoming call with the GM of ${prop.name} (${prop.brand}, ${prop.state}, RDO: ${prop.rdo}, Owner: ${prop.owner}).\n\nCurrent data: Score ${score??'N/A'}/200, RevPAR $${m.revpar??'?'} vs budget $${m.revparBud??'?'}, Occ ${m.occ??'?'}%, ADR $${m.adr??'?'} vs budget $${m.adrBud??'?'}, GOP ${m.gop??'?'}% ($${m.gopAmt?Number(m.gopAmt).toLocaleString():'?'}), GOP Budget $${m.gopBudAmt?Number(m.gopBudAmt).toLocaleString():'?'}, Revenue $${m.revenue?Number(m.revenue).toLocaleString():'?'} vs Budget $${m.revBud?Number(m.revBud).toLocaleString():'?'}, Flow ${flow!=null?flow.toFixed(0)+'%':'N/A'}, Labor ${m.labor??'?'}% vs budget ${m.laborBud??'?'}%.\n${note?'Operational notes: '+note:''}\n\nFormat:\n1. PERFORMANCE SNAPSHOT — Revenue, GOP, Flow in dollars. Where are they vs budget and vs LY? Is the gap widening or closing?\n2. VARIANCE DRIVERS — What specific line items are driving the miss or beat? Revenue side: rate vs occupancy vs mix. Expense side: labor, F&B, maintenance.\n3. FORECAST CREDIBILITY — Based on MTD pace, is their forecast realistic? Where are they likely sandbagging? Where are they overcommitting?\n4. TOP 3 RISKS — Specific, quantified. Not "occupancy could soften" — "Midweek corporate demand down 12% vs pace, $X RevPAR exposure if trend holds."\n5. 5 QUESTIONS TO ASK — Questions that force specificity. If they say "market is soft," ask for their comp set index. If they cite renovation, ask for room-night displacement count.\n6. EXPECTED GM NARRATIVE vs REALITY — What will they say? What do the numbers actually show? Where is the gap?\n7. DESIRED OUTCOMES — 2-3 specific commitments you want from this call with deadlines.\n\nBe direct. No softening. This GM works for ownership through Chris.`;
  } else if (req.params.type === 'scorecard-narrative') {
    prompt = `Write the executive narrative for the monthly performance scorecard. This goes directly to ownership.\n\nStructure:\n1. PORTFOLIO POSITION — Lead with NOI vs budget in dollars and percentage. Revenue vs budget vs LY. One sentence on whether portfolio is gaining or losing momentum.\n2. PROFITABILITY — GOP margin, flow-through %. Identify which properties are flowing above/below 50% and why.\n3. KEY DRIVERS — Name the specific line items driving variance. Not "costs were high" — which costs, which properties, how much.\n4. UNDERPERFORMERS — Bottom 3 by score. What is structurally wrong vs what is fixable in 30 days. No softening.\n5. TOP PERFORMERS — Top 3. What are they doing that others aren't. Quantify the gap.\n6. RISKS NEXT 30-60 DAYS — Specific: renovation displacement, seasonal demand shift, rate integrity erosion, brand compliance deadlines.\n7. ACTION PLAN — 3-5 precise moves with owner, timeline, and expected dollar impact.\n\nRules: Every sentence must reference a number, a property, or a trend. Zero filler. If you catch yourself writing "overall performance was solid" — delete it and write what actually happened.`;
  } else {
    return res.status(400).json({ error: 'Unknown generation type' });
  }

  try {
    const text = await callClaude(apiKey, baseSystem + '\n\n' + snapshot, [
      { role: 'user', content: prompt }
    ], 2500);
    res.json({ text, type: req.params.type });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SCORING ────────────────────────────────────────────────────────────────
function normalizeGuestScore(raw) {
  if (raw == null) return null;
  if (raw <= 100) return raw;
  if (raw <= 500) return (raw / 500) * 100;
  if (raw <= 1000) return (raw / 1000) * 100;
  return Math.min(100, (raw / 1000) * 100);
}
function calcScore(m) {
  if (!m || !m.revpar) return null;
  let s = 0;
  if (m.revpar && m.revparBud) { const p=(m.revpar/m.revparBud)*100; s+=p>=105?60:p>=100?50:p>=95?35:p>=90?20:5; }
  if (m.gop)        s += m.gop>=45?50:m.gop>=38?42:m.gop>=32?32:m.gop>=25?18:5;
  if (m.occ)        s += m.occ>=82?40:m.occ>=75?32:m.occ>=68?22:m.occ>=60?12:3;
  if (m.guestScore) { const gs=normalizeGuestScore(m.guestScore); if(gs!=null) s+=gs>=90?30:gs>=82?22:gs>=75?14:5; }
  if (m.labor && m.laborBud) s += m.labor<=m.laborBud?20:m.labor<=m.laborBud*1.03?14:m.labor<=m.laborBud*1.07?8:2;
  return Math.min(200,s);
}
function calcFlow(m) {
  // Superhost Flex/Flow formula (matches GOP Flexflow Target Calc.xlsx)
  // D48 = Rev Variance = Actual Rev - Budget Rev
  // D49 = GOP Variance = Actual GOP - Budget GOP
  // D50 = IF(gopVar>0, IF(revVar>0, gopVar, gopVar-revVar), gopVar-revVar)
  // D51 = IF(D50=0, 0, D50/ABS(revVar))
  if (!m||m.gopAmt==null||m.gopBudAmt==null||m.revenue==null||m.revBud==null) return null;
  const revVar = m.revenue - m.revBud;
  const gopVar = m.gopAmt - m.gopBudAmt;
  const adjusted = gopVar > 0 ? (revVar > 0 ? gopVar : gopVar - revVar) : gopVar - revVar;
  if (adjusted === 0) return 0;
  // Denominator guard: when revenue lands within 0.5% of plan, |revVar| is too
  // small to be a meaningful divisor — the ratio explodes (4000%+). Audit of
  // 810 (property × period) rows showed ~80 outliers came from |revVar| in the
  // $1-$5K range vs revBud >$500K. Floor at $500 covers single-day low-revenue
  // edge cases; 0.5% × revBud scales with property/period size.
  const revBudAbs = Math.abs(Number(m.revBud) || 0);
  if (Math.abs(revVar) < Math.max(500, revBudAbs * 0.005)) return null;
  return (adjusted / Math.abs(revVar)) * 100;
}

function buildPortfolioSnapshot(data, period, opts) {
  // Comprehensive AI context — everything visible from the dashboard's left sidebar:
  // active period detail, YTD aggregates, 3-month history, prior-year same-period, owners,
  // alerts, decisions, actions, watchlist. ~10-15K tokens. Replaces the prior 150-token sketch.
  //
  // Lite mode (opts.lite = true): skips historical sections (last 3 closed months,
  // prior year, prior year YTD) and trims the cockpit blocks to top 5 each. Drops to
  // ~4-5K tokens. Used by /api/council where 7 parallel calls × full snapshot blows
  // the org-level 10K input-tokens-per-minute Sonnet budget.
  const lite = !!(opts && opts.lite);
  const p = period || loadConfig().activePeriod;
  const [py, pm] = p.split('-').map(Number);
  const byPeriod = data.byPeriod || {};
  const props = getPropertyList().filter(pr => pr.active);

  // Helpers
  const $ = v => v==null ? '?' : '$' + Math.round(Number(v)).toLocaleString();
  const pct = v => v==null ? '?' : Number(v).toFixed(1) + '%';
  const num = v => v==null ? '?' : Number(v).toFixed(1);
  const monthName = (y,m) => `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${y}`;
  const periodKey = (y,m) => `${y}-${String(m).padStart(2,'0')}`;

  // ── MTD pro-rate context (active period only) ──────────────────────────
  // PS stores actuals MTD-cumulatively. But `manual.revBud`, `manual.gopBudAmt`,
  // `manual.noiBudAmt`, etc. are FULL-MONTH plan. Comparing MTD-actual to
  // full-month-bud overstates variance by (1 - daysElapsed/daysInMonth). On May 6
  // through 5 days, that overstates miss by 84% — produces "$880K behind"
  // diagnoses on hotels actually running on pace.
  // Rates (occ%, adr$, revpar$, gop%, labor%) are already apples-to-apples — both
  // sides are ratios — so no pro-rate needed there.
  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === py && (today.getMonth() + 1) === pm);
  const daysInActiveMonth = new Date(py, pm, 0).getDate();
  // PS data lags ~1 day. Through-yesterday count: today.getDate() - 1, floored at 1.
  const daysElapsed = isCurrentMonth ? Math.max(1, today.getDate() - 1) : daysInActiveMonth;
  const proRate = isCurrentMonth ? daysElapsed / daysInActiveMonth : 1;
  const pr$ = v => v == null ? null : Math.round(v * proRate);
  const ptdHeader = isCurrentMonth
    ? `\n*** MTD PACING — READ BEFORE COMPARING ***\nToday is day ${today.getDate()} of ${daysInActiveMonth} for ${monthName(py,pm)}.\nThrough-yesterday actuals reflect ${daysElapsed} elapsed days (${(proRate*100).toFixed(1)}% of month).\nThe data layer has been corrected for two known issues:\n  1. DOLLAR bud fields (revBud, gopBudAmt, noiBudAmt) are MTD-pro-rated. Full-month bud shown in parens "(full-mo $X)".\n  2. ACTUAL RATE fields (occ%, RevPAR$, roomsAvail) are corrected to true MTD — PS delivers them with a full-month denominator that gives wildly low values (e.g., 12.7% occ instead of 78.7%). Numbers below are correct MTD.\nADR is unaffected by either issue.\nDO NOT cite MTD actual against full-month bud as a variance. The numbers below already account for both corrections.\nKNOWN MID-MONTH ARTIFACT — GOP and FLOW: ProfitSword posts variable expenses daily but most fixed expenses (insurance, property tax, brand fees, allocated overhead) end-of-month. So MTD GOP margin and flow-through read artificially HIGH early in the month and normalize toward plan as fixed costs accrue. Treat early-month GOP beats with skepticism. Revenue and rooms metrics are unaffected.\n*** END NOTICE ***\n`
    : '';

  // Build period list: YTD (Jan → active), last 3 closed months (excl. active), prior year same month
  const ytdPeriods = [];
  for (let i = 1; i <= pm; i++) ytdPeriods.push(periodKey(py, i));
  const last3Closed = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(py, (pm - 1) - i, 1);
    last3Closed.push(periodKey(d.getFullYear(), d.getMonth() + 1));
  }
  const priorYearKey = periodKey(py - 1, pm);

  // Aggregate YTD per property — current year and prior year (same Jan-through-current-month range)
  const ytdAgg = {}; const pyYtdAgg = {};
  props.forEach(pr => {
    ytdAgg[pr.id]   = { rev:0, revBud:0, gop:0, gopBud:0, noi:0, noiBud:0, occSum:0, adrSum:0, rpSum:0, revparIdxSum:0, revparIdxCount:0, count:0 };
    pyYtdAgg[pr.id] = { rev:0, revBud:0, gop:0, gopBud:0, noi:0, noiBud:0, occSum:0, adrSum:0, rpSum:0, count:0 };
  });
  const aggregateInto = (per, target) => {
    const pd = byPeriod[per] || {};
    // Pro-rate the budget contribution when this aggregation period is the active
    // current month. Actuals are MTD-cumulative either way, but bud dollars stored
    // are full-month, so without the factor YTD is biased "behind plan" by the
    // unconsumed days of the current month.
    const isActiveCurrent = (per === p && target === ytdAgg && isCurrentMonth);
    const budFactor = isActiveCurrent ? proRate : 1;
    props.forEach(pr => {
      const stored = pd[pr.id] || {}; const m = stored.manual || {}; const s = stored.str || {};
      const a = target[pr.id];
      if (m.revenue != null) {
        a.rev    += m.revenue || 0;
        a.revBud += (m.revBud || 0) * budFactor;
        a.gop    += m.gopAmt || 0;
        a.gopBud += (m.gopBudAmt || 0) * budFactor;
        a.noi    += (m.noiAmt != null ? m.noiAmt : m.gopAmt) || 0;
        a.noiBud += ((m.noiBudAmt != null ? m.noiBudAmt : m.gopBudAmt) || 0) * budFactor;
        a.occSum += m.occ || 0; a.adrSum += m.adr || 0; a.rpSum += m.revpar || 0;
        a.count++;
      }
      if (target===ytdAgg && s.revparIdx != null) { a.revparIdxSum += s.revparIdx; a.revparIdxCount++; }
    });
  };
  ytdPeriods.forEach(per => aggregateInto(per, ytdAgg));
  // Prior-year YTD: same Jan→pm range, year py-1
  for (let i = 1; i <= pm; i++) aggregateInto(periodKey(py - 1, i), pyYtdAgg);

  // ── Section 1: Active period detail ──
  const activeLines = props.map(pr => {
    const stored = (byPeriod[p] || {})[pr.id] || {};
    const mRaw = stored.manual || {}; const s = stored.str || {}; const f = stored.forecast || {};
    // Fix the PS denominator bug for current-month actuals: occ% and revpar$
    // arrive with MTD numerator / full-month denominator, wrong by proRate.
    // ADR is unaffected (no avail in its calc). Apply the same render-time
    // correction the dashboard uses, so AI sees the same numbers as the tiles.
    const m = (isCurrentMonth && proRate < 1) ? {
      ...mRaw,
      occ:        mRaw.occ != null    ? Math.round((mRaw.occ    / proRate) * 10) / 10  : mRaw.occ,
      revpar:     mRaw.revpar != null ? Math.round((mRaw.revpar / proRate) * 100) / 100 : mRaw.revpar,
      roomsAvail: mRaw.roomsAvail != null ? Math.round(mRaw.roomsAvail * proRate) : mRaw.roomsAvail
    } : mRaw;
    const score = calcScore(m); const flow = calcFlow(m);
    const noi = m.noiAmt != null ? m.noiAmt : m.gopAmt;
    const noiBud = m.noiBudAmt != null ? m.noiBudAmt : m.gopBudAmt;
    // For current month, pro-rate dollar bud fields and append the full-month bud
    // for context. For closed months, leave as-is.
    const revBudMtd  = isCurrentMonth ? pr$(m.revBud)    : m.revBud;
    const gopBudMtd  = isCurrentMonth ? pr$(m.gopBudAmt) : m.gopBudAmt;
    const noiBudMtd  = isCurrentMonth ? pr$(noiBud)      : noiBud;
    const fullMoTag  = (full) => isCurrentMonth && full != null ? ` (full-mo ${$(full)})` : '';
    const parts = [
      `${pr.name} | ${pr.brand} | ${pr.state} | RDO:${pr.rdo} | Owner:${pr.owner} | Score:${score??'?'}`,
      `  Rev ${$(m.revenue)} ${isCurrentMonth?'MTD-':''}bud ${$(revBudMtd)}${fullMoTag(m.revBud)} | GOP ${$(m.gopAmt)} ${isCurrentMonth?'MTD-':''}bud ${$(gopBudMtd)}${fullMoTag(m.gopBudAmt)} (${pct(m.gop)}) | NOI ${$(noi)} ${isCurrentMonth?'MTD-':''}bud ${$(noiBudMtd)}${fullMoTag(noiBud)}`,
      `  Occ ${pct(m.occ)} bud ${pct(m.occBud)} | ADR ${$(m.adr)} bud ${$(m.adrBud)} | RevPAR ${$(m.revpar)} bud ${$(m.revparBud)}${isCurrentMonth?'  [actual rates corrected to true MTD]':'  [rates]'}`,
      `  Flow:${flow!=null?flow.toFixed(0)+'%':'?'} | Labor ${pct(m.labor)} bud ${pct(m.laborBud)} | Rooms ${m.roomsSold??'?'}/${m.roomsAvail??'?'}${isCurrentMonth?' (true MTD)':''}`,
    ];
    if (s.revparIdx != null) parts.push(`  STR — RGI:${num(s.revparIdx)} ARI:${num(s.adrIdx)} MPI:${num(s.occIdx)} | myRevPAR ${$(s.myRevpar)} vs comp ${$(s.compRevpar)}`);
    if (f.gopAmt != null || m.primaryFcGopAmt != null) {
      parts.push(`  Forecast — Live GOP ${$(f.gopAmt)} | Day-1 Locked ${$(m.primaryFcGopAmt)} | Live RevPAR ${$(f.revpar)}`);
    }
    const psc = [];
    if (m.guestScore != null) psc.push(`Brand ${num(m.guestScore)}`);
    if (m.googleScore != null) psc.push(`Google ${num(m.googleScore)}`);
    if (m.qaPass) psc.push(`QA:${m.qaPass}`);
    if (m.aosScore != null) psc.push(`AOS ${num(m.aosScore)}`);
    if (m.turnover != null) psc.push(`TO ${pct(m.turnover)}`);
    if (m.communityEngagement) psc.push(`CE:${m.communityEngagement}`);
    if (psc.length) parts.push(`  PSC manual — ${psc.join(' | ')}`);
    // Contacts — one compact line per property if we have an imported record.
    // Lite mode: just GM + Owner contact + RDO/RSM names (the people the AI
    // most often needs to refer to). Full mode adds AGM + DOS + AP email.
    const contactsRec = ((data.contacts || {}).property || {})[String(pr.id)];
    if (contactsRec) {
      const gm  = contactsRec.gm  || {};
      const own = contactsRec.owner || {};
      const sup = contactsRec.support || {};
      const liteBits = [];
      if (gm.name)        liteBits.push(`GM ${gm.name}${gm.email?` <${gm.email}>`:''}`);
      if (own.contact)    liteBits.push(`Owner contact ${own.contact}${own.group?` (${own.group})`:''}`);
      if (sup.regional)   liteBits.push(`RDO ${sup.regional}`);
      if (sup.salesRegional) liteBits.push(`RSM ${sup.salesRegional}`);
      if (liteBits.length) parts.push(`  Contacts — ${liteBits.join(' | ')}`);
      if (!lite) {
        const fullBits = [];
        const agm = contactsRec.agm || {};
        const dos = contactsRec.dos || {};
        if (agm.name)             fullBits.push(`AGM ${agm.name}${agm.email?` <${agm.email}>`:''}`);
        if (dos.name)             fullBits.push(`DOS ${dos.name}${dos.email?` <${dos.email}>`:''}`);
        if (sup.controller)       fullBits.push(`Controller ${sup.controller}`);
        if (sup.revenue)          fullBits.push(`Revenue ${sup.revenue}`);
        if (contactsRec.hotelEmailAP) fullBits.push(`AP ${contactsRec.hotelEmailAP}`);
        if (fullBits.length) parts.push(`              ${fullBits.join(' | ')}`);
      }
    }
    return parts.join('\n');
  }).join('\n\n');

  // ── Section 2: YTD aggregates per property ──
  const ytdLines = props.map(pr => {
    const a = ytdAgg[pr.id]; if (!a.count) return null;
    const flowYTD = (a.rev - a.revBud) !== 0 ? ((a.gop - a.gopBud) / Math.abs(a.rev - a.revBud)) * 100 : null;
    const avgRGI = a.revparIdxCount > 0 ? (a.revparIdxSum / a.revparIdxCount) : null;
    return `${pr.name}: Rev ${$(a.rev)} (bud ${$(a.revBud)}, var ${$(a.rev - a.revBud)}) | GOP ${$(a.gop)} (bud ${$(a.gopBud)}) | NOI ${$(a.noi)} (bud ${$(a.noiBud)}) | Flow ${flowYTD!=null?flowYTD.toFixed(0)+'%':'?'} | Avg Occ ${pct(a.occSum/a.count)} ADR ${$(a.adrSum/a.count)} RevPAR ${$(a.rpSum/a.count)}${avgRGI!=null?` | RGI avg ${avgRGI.toFixed(1)}`:''}`;
  }).filter(Boolean).join('\n');

  // ── Section 3: Last 3 closed months — compact grid ──
  const histLines = last3Closed.reverse().map(per => {
    const pd = byPeriod[per] || {};
    const lines = props.map(pr => {
      const stored = pd[pr.id] || {}; const m = stored.manual || {};
      if (m.revenue == null) return null;
      return `  ${pr.name}: Rev ${$(m.revenue)} | GOP ${$(m.gopAmt)} (${pct(m.gop)}) | RevPAR ${$(m.revpar)} | Occ ${pct(m.occ)}`;
    }).filter(Boolean).join('\n');
    return lines ? `[${monthName(...per.split('-').map(Number))}]\n${lines}` : null;
  }).filter(Boolean).join('\n\n');

  // ── Section 4: Prior year same period ──
  const pyData = byPeriod[priorYearKey] || {};
  const pyLines = props.map(pr => {
    const stored = pyData[pr.id] || {}; const m = stored.manual || {};
    if (m.revenue == null) return null;
    return `  ${pr.name}: Rev ${$(m.revenue)} | GOP ${$(m.gopAmt)} | RevPAR ${$(m.revpar)} | Occ ${pct(m.occ)}`;
  }).filter(Boolean).join('\n');

  // ── Section 4b: Prior year YTD aggregates (same Jan→pm range, year py-1) ──
  const pyYtdLines = props.map(pr => {
    const a = pyYtdAgg[pr.id]; if (!a.count) return null;
    return `  ${pr.name}: Rev ${$(a.rev)} | GOP ${$(a.gop)} | NOI ${$(a.noi)} | Avg Occ ${pct(a.occSum/a.count)} ADR ${$(a.adrSum/a.count)} RevPAR ${$(a.rpSum/a.count)}`;
  }).filter(Boolean).join('\n');

  // ── Section 5: Owners ──
  const ownerLines = getOwnerList().map(o => {
    const propsList = o.properties.filter(x => x.active).map(x => x.name).join(', ');
    return `  ${o.name} (${o.activeCount} active, ${o.brandFamilies.join('/')}, ${o.states.join('/')}): ${propsList}`;
  }).join('\n');

  // ── Section 6: Alerts ──
  const alertCap = lite ? 5 : 15;
  const recentAlerts = (data.alerts || []).slice(0, alertCap);
  const alertLines = recentAlerts.length
    ? recentAlerts.map(a => `  [${a.level||'info'}] ${a.title||''} — ${(a.body||'').substring(0, 140)}${a.created?` (${new Date(a.created).toLocaleDateString()})`:''}`).join('\n')
    : '  (none)';

  // ── Section 7: Decisions ──
  const decisionCap = lite ? 5 : 10;
  const recentDecisions = (data.decisions || []).slice(0, decisionCap);
  const decisionLines = recentDecisions.length
    ? recentDecisions.map(d => `  ${d.title||'?'}${d.context?' — '+d.context.substring(0,140):''}${d.outcome?` → ${d.outcome.substring(0,80)}`:''}${d.created?` (${new Date(d.created).toLocaleDateString()})`:''}`).join('\n')
    : '  (none)';

  // ── Section 8: Actions ──
  const actionCap = lite ? 5 : 15;
  const openActions = (data.actions || []).filter(a => a.status !== 'done' && a.status !== 'cancelled').slice(0, actionCap);
  const actionLines = openActions.length
    ? openActions.map(a => `  [${a.status||'open'}] ${a.title||'?'}${a.owner?` (owner: ${a.owner})`:''}${a.dueDate?` due ${a.dueDate}`:''}`).join('\n')
    : '  (none)';

  // ── Section 9: Watchlist ──
  const watchCap = lite ? 5 : 15;
  const watchlist = (data.watchlist || []).slice(0, watchCap);
  const watchlistLines = watchlist.length
    ? watchlist.map(w => `  ${w.title||'?'}${w.body?' — '+w.body.substring(0,120):''}${w.created?` (${new Date(w.created).toLocaleDateString()})`:''}`).join('\n')
    : '  (none)';

  // Lite mode drops historical depth — keeps active period + cockpit only —
  // to stay inside the 10K input-tokens-per-minute org limit when the council
  // fans out across 7 personas.
  const historicalSections = lite ? '' : `
== YEAR-TO-DATE AGGREGATES (Jan → ${monthName(py, pm)}) ==
${ytdLines || '  (no YTD data)'}

== LAST 3 CLOSED MONTHS ==
${histLines || '  (no history available)'}

== PRIOR YEAR SAME PERIOD (${monthName(py - 1, pm)}) ==
${pyLines || '  (no prior-year data)'}

== PRIOR YEAR YTD AGGREGATES (Jan → ${monthName(py - 1, pm)}, ${py - 1}) ==
${pyYtdLines || '  (no prior-year YTD data)'}
`;

  // ── Corporate roster (full mode only) — lets personas reach for the right
  // person by name without inventing contact info. Skipped in lite mode to
  // protect the council's per-call token budget.
  let corporateSection = '';
  if (!lite) {
    const corp = (data.contacts || {}).corporate || {};
    const corpEntries = Object.entries(corp);
    if (corpEntries.length) {
      // Group by department so the roster reads cleanly
      const byDept = {};
      for (const [, rec] of corpEntries) {
        const d = rec.department || 'Other';
        (byDept[d] = byDept[d] || []).push(rec);
      }
      const deptLines = Object.entries(byDept).map(([dept, list]) => {
        const lines = list
          .sort((a,b) => (a.name||'').localeCompare(b.name||''))
          .map(r => `  ${r.name}${r.title?', '+r.title:''}${r.email?` <${r.email}>`:''}${r.cell?` ${r.cell}`:''}`)
          .join('\n');
        return `${dept}:\n${lines}`;
      }).join('\n\n');
      corporateSection = `\n== CORPORATE ROSTER (${corpEntries.length} contacts) ==\n${deptLines}\n`;
    }
  }

  return `\n=========================================
PORTFOLIO SNAPSHOT — Active Period: ${monthName(py, pm)} (${p})${lite ? ' [lite]' : ''}
17 active branded hotels across IL, MI, NC, TX, KY, IN, GA. Brands: Hilton, Marriott, IHG, Choice.
=========================================
${ptdHeader}
== ACTIVE PERIOD DETAIL ==
${activeLines}
${historicalSections}
${corporateSection}
== OWNER ROSTER ==
${ownerLines || '  (no owner data)'}

== RECENT ALERTS ==
${alertLines}

== RECENT DECISIONS ==
${decisionLines}

== OPEN ACTIONS ==
${actionLines}

== WATCHLIST ==
${watchlistLines}

== DATA AVAILABILITY ==
Available periods: ${Object.keys(byPeriod).sort().reverse().slice(0, 24).join(', ')}
You can answer questions about any of these periods, any property, any owner, YTD trends, YoY comparisons, comp set positioning, GM forecast credibility, decisions, actions, and watchlist items. If asked about something not in the snapshot, say so — never fabricate.
`;
}

function getPropertyList() {
  return [
    {id:1, name:'Embassy Suites Chicago Naperville',       brand:'Embassy Suites',   brandFamily:'Hilton',   state:'IL',rdo:'Tim',     rsm:'Teresa Bitner',owner:'Lakhany Group',   active:true},
    {id:2, name:'Hampton Inn Suites Chicago Schaumburg',   brand:'Hampton Inn',       brandFamily:'Hilton',   state:'IL',rdo:'Jennifer',rsm:'Teresa Bitner',owner:'Capitol One',     active:true},
    {id:3, name:'Tru by Hilton Holland',                   brand:'Tru',               brandFamily:'Hilton',   state:'MI',rdo:'Jennifer',rsm:'Nate Taylor',  owner:'INDC',            active:true},
    {id:4, name:'Home2 Suites Holland',                    brand:'Home2 Suites',      brandFamily:'Hilton',   state:'MI',rdo:'Jennifer',rsm:'Teresa Bitner',owner:'INDC',            active:true},
    {id:5, name:'DoubleTree Winston Salem',                brand:'DoubleTree',        brandFamily:'Hilton',   state:'NC',rdo:'Jennifer',rsm:'Teresa Bitner',owner:'Alpental Capital',active:true},
    {id:6, name:'Home2 Suites Normal',                     brand:'Home2 Suites',      brandFamily:'Hilton',   state:'IL',rdo:'Jennifer',rsm:'Teresa Bitner',owner:'Lakhany Group',   active:true},
    {id:7, name:'Home2 Suites Fort Wayne',                 brand:'Home2 Suites',      brandFamily:'Hilton',   state:'IN',rdo:'Jennifer',rsm:'Nate Taylor',  owner:'Lakhany Group',   active:false,comingSoon:true},
    {id:8, name:'Home2 Suites Plano',                      brand:'Home2 Suites',      brandFamily:'Hilton',   state:'TX',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Gateway',         active:true},
    {id:9, name:'TownePlace Suites Mesquite',              brand:'TownePlace Suites', brandFamily:'Marriott', state:'TX',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Gateway',         active:true},
    {id:10,name:'Mainstay Suites Lexington',               brand:'Mainstay Suites',   brandFamily:'Choice',   state:'KY',rdo:'Mark',    rsm:'Teresa Bitner',owner:'Gulfstream',      active:true},
    {id:11,name:'Quality Inn Lexington',                   brand:'Quality Inn',       brandFamily:'Choice',   state:'KY',rdo:'Mark',    rsm:'Teresa Bitner',owner:'Gulfstream',      active:true},
    {id:12,name:'Home2 Suites Lexington Hamburg',          brand:'Home2 Suites',      brandFamily:'Hilton',   state:'KY',rdo:'Mark',    rsm:'Teresa Bitner',owner:'Gulfstream',      active:true},
    {id:13,name:'Home2 Suites Owensboro',                  brand:'Home2 Suites',      brandFamily:'Hilton',   state:'KY',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Gulfstream',      active:true},
    {id:14,name:'TownePlace Suites Owensboro',             brand:'TownePlace Suites', brandFamily:'Marriott', state:'KY',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Gulfstream',      active:true},
    {id:15,name:'Hilton Garden Inn Atlanta Airport North', brand:'Hilton Garden Inn', brandFamily:'Hilton',   state:'GA',rdo:'Mark',    rsm:'Teresa Bitner',owner:'Alpental Capital',active:true},
    {id:16,name:'Home2 Suites Evansville',                 brand:'Home2 Suites',      brandFamily:'Hilton',   state:'IN',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Gulfstream',      active:true},
    {id:17,name:'Tru by Hilton Northlake',                 brand:'Tru',               brandFamily:'Hilton',   state:'TX',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Lakhany Group',   active:true},
    {id:18,name:'Holiday Inn Lexington',                   brand:'Holiday Inn',       brandFamily:'IHG',      state:'KY',rdo:'Mark',    rsm:'Teresa Bitner',owner:'Gulfstream',      active:true},
    {id:19,name:'Home2 Suites Prosper',                    brand:'Home2 Suites',      brandFamily:'Hilton',   state:'TX',rdo:'Mark',    rsm:'Nate Taylor',  owner:'Gateway',         active:false,comingSoon:true}
  ];
}

// ─── OWNERS ─────────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function getOwnerList() {
  const props = getPropertyList();
  const map = new Map();
  for (const p of props) {
    const id = slugify(p.owner);
    if (!map.has(id)) {
      map.set(id, {
        id, name: p.owner,
        properties: [], propertyIds: [], activePropertyIds: [],
        brandFamilies: new Set(), states: new Set()
      });
    }
    const o = map.get(id);
    o.propertyIds.push(p.id);
    if (p.active) o.activePropertyIds.push(p.id);
    o.properties.push({ id: p.id, name: p.name, brand: p.brand, brandFamily: p.brandFamily, state: p.state, active: p.active, comingSoon: p.comingSoon });
    o.brandFamilies.add(p.brandFamily);
    o.states.add(p.state);
  }
  return Array.from(map.values()).map(o => ({
    ...o,
    brandFamilies: Array.from(o.brandFamilies),
    states: Array.from(o.states),
    propertyCount: o.propertyIds.length,
    activeCount: o.activePropertyIds.length
  }));
}

function defaultOwnerProfile(owner) {
  return {
    id: owner.id,
    name: owner.name,
    type: '',                           // PE fund | family office | REIT | private investor | publicly held
    primaryContact: { name: '', title: '', email: '', phone: '' },
    additionalContacts: [],
    sophistication: 'medium',           // high | medium | low
    format: 'letter',                   // letter | deck | excel | email
    cadence: 'monthly',                 // monthly | quarterly
    hotButtons: [],                     // e.g. ['NOI vs budget', 'flow-through', 'GSS']
    redFlags: [],                       // e.g. ['PIP letters', 'AR > 60 days']
    fundLife: '',                       // e.g. 'evergreen' | '2027 sale' | '2029 refi'
    decisionStyle: '',                  // 'data-first' | 'relationship-first' | 'mixed'
    tone: '',                           // free-text guidance
    priorities: [],
    constraints: [],
    notes: '',
    lastTouchpoint: null,
    updatedAt: null
  };
}

app.get('/api/owners', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const owners = getOwnerList();
  // Auto-derive monthly metrics from current period snapshot if available
  const period = req.query.period || loadConfig().activePeriod;
  const periodData = (data.byPeriod || {})[period] || {};
  const enriched = owners.map(o => {
    let revenueTtl = 0, gopTtl = 0, scoreSum = 0, scoreCount = 0;
    for (const pid of o.activePropertyIds) {
      const m = (periodData[pid] || {}).manual || {};
      if (m.revenue) revenueTtl += Number(m.revenue) || 0;
      if (m.gopAmt)  gopTtl     += Number(m.gopAmt)  || 0;
      const s = calcScore(m);
      if (s != null) { scoreSum += s; scoreCount++; }
    }
    const profile = data.ownerProfiles[o.id] || defaultOwnerProfile(o);
    return {
      ...o,
      derived: {
        period,
        revenue: revenueTtl,
        gop: gopTtl,
        avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
        propertyOpenIssues: o.activePropertyIds.reduce((sum, pid) => {
          return sum + (data.actions || []).filter(a => a.propertyId === pid && (a.status === 'open' || a.status === 'in-progress')).length;
        }, 0)
      },
      profile
    };
  });
  res.json({ owners: enriched, period });
});

app.get('/api/owners/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const owner = getOwnerList().find(o => o.id === req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found' });
  res.json({
    ...owner,
    profile: data.ownerProfiles[owner.id] || defaultOwnerProfile(owner)
  });
});

app.put('/api/owners/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const owner = getOwnerList().find(o => o.id === req.params.id);
  if (!owner) return res.status(404).json({ error: 'Owner not found' });
  const existing = data.ownerProfiles[owner.id] || defaultOwnerProfile(owner);
  const updated = {
    ...existing,
    ...req.body,
    id: owner.id,
    name: owner.name,
    updatedAt: new Date().toISOString()
  };
  // sanitize array-of-strings fields
  for (const k of ['hotButtons','redFlags','priorities','constraints']) {
    if (k in updated) {
      updated[k] = Array.isArray(updated[k]) ? updated[k].filter(Boolean).map(s => String(s).trim()).filter(Boolean) : [];
    }
  }
  data.ownerProfiles[owner.id] = updated;
  saveData(data);
  res.json({ profile: updated });
});

function ownerForProperty(propertyId, data) {
  const prop = getPropertyList().find(p => p.id === parseInt(propertyId));
  if (!prop) return null;
  const oid = slugify(prop.owner);
  const owner = getOwnerList().find(o => o.id === oid);
  if (!owner) return null;
  const profile = data.ownerProfiles[oid] || defaultOwnerProfile(owner);
  return { owner, profile };
}

function buildOwnerContext(propertyId, data) {
  const o = ownerForProperty(propertyId, data);
  if (!o) return '';
  const { owner, profile } = o;
  const filled = profile.type || profile.sophistication !== 'medium' || profile.hotButtons?.length || profile.redFlags?.length || profile.tone;
  if (!filled) return ''; // no profile filled yet — skip
  const lines = [];
  lines.push(`\n\nOWNER PROFILE — ${owner.name}`);
  lines.push(`Holdings: ${owner.activeCount} active hotels (${owner.brandFamilies.join(', ')}); states: ${owner.states.join(', ')}.`);
  if (profile.type)            lines.push(`Type: ${profile.type}`);
  if (profile.primaryContact?.name) lines.push(`Primary contact: ${profile.primaryContact.name}${profile.primaryContact.title?', '+profile.primaryContact.title:''}`);
  if (profile.sophistication)  lines.push(`Sophistication: ${profile.sophistication} — calibrate the depth of variance commentary accordingly.`);
  if (profile.format)          lines.push(`Preferred format: ${profile.format}; cadence ${profile.cadence||'monthly'}.`);
  if (profile.decisionStyle)   lines.push(`Decision style: ${profile.decisionStyle}.`);
  if (profile.fundLife)        lines.push(`Fund-life / hold thesis: ${profile.fundLife}.`);
  if (profile.hotButtons?.length) lines.push(`Hot buttons: ${profile.hotButtons.join(' · ')}.`);
  if (profile.redFlags?.length)   lines.push(`Red flags (lead with these if present): ${profile.redFlags.join(' · ')}.`);
  if (profile.priorities?.length) lines.push(`Priorities: ${profile.priorities.join(' · ')}.`);
  if (profile.constraints?.length) lines.push(`Constraints: ${profile.constraints.join(' · ')}.`);
  if (profile.tone)            lines.push(`Tone: ${profile.tone}`);
  if (profile.notes)           lines.push(`Notes: ${profile.notes}`);
  lines.push(`Use this profile to calibrate tone, depth, and emphasis. If the user is asking for owner-facing output, write to THIS owner.`);
  return lines.join('\n');
}

// ─── GM BENCH TRACKER ───────────────────────────────────────────────────────
// One bench record per active property, auto-derived from getPropertyList().
// User fills in GM name, tenure, perf × pot, succession status, retention risk.
// VP People + COO + Regional VP + GM personas read this when a property is in focus.

function defaultGMRecord(prop) {
  return {
    propertyId: prop.id,
    propertyName: prop.name,
    gmName: '',
    gmEmail: '',
    gmTenureAtProperty: '',          // e.g. "2 years" or "8 months"
    gmTenureWithCompany: '',
    performance: '',                 // HIGH | MID | LOW
    potential: '',                   // HIGH | MID | LOW
    riskLevel: 'GREEN',              // GREEN | YELLOW | RED
    riskReason: '',
    successor: { name: '', role: '', readiness: 'EXPOSED' }, // role: AGM|DOO|""  readiness: COVERED|BRIDGE|EXPOSED
    notes: '',
    tags: [],                         // free-form tags
    lastReviewedAt: null,
    updatedAt: null
  };
}

// 9-box label derivation from performance × potential
function nineBoxLabel(perf, pot) {
  const p = String(perf||'').toUpperCase(), q = String(pot||'').toUpperCase();
  if (!p || !q) return '';
  const map = {
    'HIGH-HIGH': '★ Star — succession candidate, retention priority',
    'HIGH-MID':  'Develop up — load with stretch',
    'HIGH-LOW':  'Specialist — keep in role',
    'MID-HIGH':  'Latent talent — develop performance',
    'MID-MID':   'Steady — protect, develop in place',
    'MID-LOW':   'Low priority — coach lightly',
    'LOW-HIGH':  'Misplaced — reassign or rescope',
    'LOW-MID':   'Performance gap — coach with 90-day timeline',
    'LOW-LOW':   '✗ Exit-plan candidate — performance management'
  };
  return map[`${p}-${q}`] || '';
}

function getGMList() {
  return getPropertyList().filter(p => p.active).map(p => ({
    propertyId: p.id,
    propertyName: p.name,
    brand: p.brand,
    brandFamily: p.brandFamily,
    state: p.state,
    rdo: p.rdo,
    rsm: p.rsm,
    owner: p.owner
  }));
}

app.get('/api/gms', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const period = req.query.period || loadConfig().activePeriod;
  const periodData = (data.byPeriod || {})[period] || {};

  const list = getGMList().map(g => {
    const stored = data.gmBench[g.propertyId] || defaultGMRecord(g);
    const m = (periodData[g.propertyId] || {}).manual || {};
    const score = calcScore(m);
    return {
      ...g,
      bench: stored,
      box: nineBoxLabel(stored.performance, stored.potential),
      derived: {
        period,
        score,
        revpar: m.revpar ?? null,
        gop: m.gop ?? null,
        flow: calcFlow(m)
      }
    };
  });

  // Portfolio-level rollup
  const populated = list.filter(g => g.bench.gmName).length;
  const exposed   = list.filter(g => g.bench.successor?.readiness === 'EXPOSED').length;
  const redRisk   = list.filter(g => g.bench.riskLevel === 'RED').length;
  const yellowRisk= list.filter(g => g.bench.riskLevel === 'YELLOW').length;
  const star      = list.filter(g => g.bench.performance === 'HIGH' && g.bench.potential === 'HIGH').length;
  const exitPlan  = list.filter(g => g.bench.performance === 'LOW' && g.bench.potential === 'LOW').length;

  res.json({
    gms: list,
    period,
    summary: {
      total: list.length,
      populated,
      stars: star,
      exitPlanCandidates: exitPlan,
      flightRisk: redRisk,
      watchRisk: yellowRisk,
      successionExposed: exposed
    }
  });
});

app.get('/api/gms/:propertyId', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const prop = getPropertyList().find(p => p.id === parseInt(req.params.propertyId));
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  const bench = data.gmBench[prop.id] || defaultGMRecord(prop);
  res.json({ propertyId: prop.id, propertyName: prop.name, bench, box: nineBoxLabel(bench.performance, bench.potential) });
});

app.put('/api/gms/:propertyId', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const prop = getPropertyList().find(p => p.id === parseInt(req.params.propertyId));
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  const existing = data.gmBench[prop.id] || defaultGMRecord(prop);
  const merged = {
    ...existing,
    ...req.body,
    propertyId: prop.id,
    propertyName: prop.name,
    successor: { ...(existing.successor || {}), ...((req.body || {}).successor || {}) },
    updatedAt: new Date().toISOString()
  };
  // sanitize tags
  merged.tags = Array.isArray(merged.tags) ? merged.tags.filter(Boolean).map(s => String(s).trim()).filter(Boolean) : [];
  // clamp enum values
  const allowedTier = ['HIGH','MID','LOW',''];
  if (!allowedTier.includes(String(merged.performance||'').toUpperCase())) merged.performance = '';
  if (!allowedTier.includes(String(merged.potential||'').toUpperCase()))   merged.potential   = '';
  const allowedRisk = ['GREEN','YELLOW','RED'];
  if (!allowedRisk.includes(String(merged.riskLevel||'').toUpperCase()))   merged.riskLevel = 'GREEN';
  const allowedRead = ['COVERED','BRIDGE','EXPOSED',''];
  if (!allowedRead.includes(String(merged.successor?.readiness||'').toUpperCase())) {
    merged.successor.readiness = 'EXPOSED';
  }
  data.gmBench[prop.id] = merged;
  saveData(data);
  res.json({ bench: merged, box: nineBoxLabel(merged.performance, merged.potential) });
});

function buildGMContext(propertyId, data) {
  if (!propertyId) return '';
  const bench = data.gmBench[parseInt(propertyId)];
  if (!bench || !bench.gmName) return '';
  const lines = [];
  lines.push(`\n\nGM RECORD — ${bench.propertyName}`);
  lines.push(`GM: ${bench.gmName}${bench.gmTenureAtProperty?` · ${bench.gmTenureAtProperty} at property`:''}${bench.gmTenureWithCompany?` · ${bench.gmTenureWithCompany} with company`:''}`);
  if (bench.performance && bench.potential) {
    lines.push(`9-box: ${nineBoxLabel(bench.performance, bench.potential)} (perf ${bench.performance} × pot ${bench.potential})`);
  }
  lines.push(`Risk: ${bench.riskLevel}${bench.riskReason?' — '+bench.riskReason:''}`);
  if (bench.successor?.name) {
    lines.push(`Successor: ${bench.successor.name}${bench.successor.role?' ('+bench.successor.role+')':''} · readiness ${bench.successor.readiness||'?'}`);
  } else if (bench.successor?.readiness) {
    lines.push(`Successor coverage: ${bench.successor.readiness}`);
  }
  if (bench.tags?.length) lines.push(`Tags: ${bench.tags.join(' · ')}`);
  if (bench.notes) lines.push(`Notes: ${bench.notes}`);
  return lines.join('\n');
}

// ─── EXECUTIVE TEAM AGENTS (persona-based) ──────────────────────────────────
const PERSONAS_DIR = path.join(__dirname, 'superhost-agents', 'personas');

// Shared mandate block appended to any file-backed role-archetype persona
// (NOT the custom:<slug> named-leader personas). Reused by /api/ai/chat/:role
// (the team.html chat path) and /api/agents/role/:role/prompt (the dashboard
// cockpit picker path) so role agents behave identically regardless of which
// surface activates them. See memory/project_second_layer_review.md.
const SECOND_LAYER_REVIEW_MANDATE = `

---
SECOND-LAYER REVIEW MANDATE

You are operating as a role-archetype agent at Superhost Hospitality. The named corporate team — Tim Foley (COO), Maura Bruen (SVP Hotel Performance), Jill Uceny (Director Systems & Analytics), Rafiq Sabir (VP Accounting & Finance), Kori Eller (VP HR / GC), Nate Taylor (RVP Sales), Jennifer Kruk & Mark Gammill (RDOs), and others — each have their own voice-trained personas in this system. They are the FIRST layer. You are the SECOND layer.

Your job is NOT to agree with the corporate team by default. Your job is to challenge their data, their analytics, and their conclusions so the company makes decisions on the best possible information.

When you review portfolio data, ownership reports, scorecards, forecasts, P&Ls, scans, or any analytical output that the corp team has produced or is referencing:
- AUDIT THE MATH. Recompute headline numbers from the underlying data wherever possible. Flag any internal inconsistency between metrics.
- STRESS-TEST THE CONCLUSIONS. Ask: does this narrative actually fit the data, or is the data being shaped to fit a preferred story? Could the same numbers support a different conclusion?
- SURFACE WHAT'S MISSING. What metric was NOT shown that would change the conclusion? What time-period, segment, or comparison was NOT made? What part of the P&L is conspicuously absent?
- PRESSURE-TEST THE ANCHORS. Where the analysis depends on a budget number, a forecast, a comp set, an STR figure, or a benchmark — is that anchor itself sound? When was it last revisited?
- NAME THE UNKNOWNS. If a key driver isn't in the data, say so explicitly. Do not gloss over gaps to preserve a clean story.
- WATCH FOR CONFIRMATION BIAS. The corp team has incentives to read their own results favorably. You don't. Apply that independence.

Be direct and specific. "Numbers look right" is not a review — quote the specific figures you cross-checked and explain what you compared against. "I disagree" is not a review — name the line item, the variance, and the alternate explanation. Bad news first. No diplomatic hedging.

If the data and conclusions hold up under scrutiny, say so — and explain what you checked. Rigor over contrarianism. The point is the QA layer, not reflexive dissent.

The corp team WANTS to be checked. This second-layer role is a feature of how this company operates, not a friction. Your scrutiny makes Superhost smarter.
`;

function parsePersonaFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm = {};
  m[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      fm[key] = val;
    }
  });
  return { frontmatter: fm, body: m[2] };
}

function listPersonas() {
  if (!fs.existsSync(PERSONAS_DIR)) return [];
  return fs.readdirSync(PERSONAS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { frontmatter } = parsePersonaFile(path.join(PERSONAS_DIR, f));
      return {
        role: f.replace(/\.md$/, ''),
        name: frontmatter.name || f.replace(/\.md$/, ''),
        description: frontmatter.description || ''
      };
    });
}

function getPersonaPrompt(role) {
  // Custom personas (the 14 corporate leaders built from the intake form)
  // are namespaced 'custom:<slug>' to avoid collision with file-backed roles.
  if (typeof role === 'string' && role.startsWith('custom:')) {
    const slug = role.slice('custom:'.length);
    try {
      const data = ensureShape(loadData());
      const persona = (data.personas || {})[slug];
      if (!persona) return null;
      return buildPersonaPrompt(persona);
    } catch (e) {
      console.error('[personas] failed to build custom prompt for', slug, e);
      return null;
    }
  }
  const p = path.join(PERSONAS_DIR, `${role}.md`);
  if (!fs.existsSync(p)) return null;
  return parsePersonaFile(p).body;
}

// Optional persona → cockpit grouping. Used by the UI to organize the agent picker.
const PERSONA_GROUPS = {
  'C-Suite': ['ceo', 'coo', 'cfo', 'cdo', 'chief-development-officer', 'chief-investment-officer', 'cto', 'cmo', 'chief-compliance-officer', 'chief-of-staff'],
  'Corporate VPs': ['vp-revenue-management', 'vp-sales-marketing', 'vp-people', 'vp-fb', 'vp-capital-projects', 'general-counsel'],
  'Regional': ['regional-vp', 'area-general-manager']
};

app.get('/api/agents', checkAuth, (req, res) => {
  const all = listPersonas();
  const groups = {};
  for (const [group, roles] of Object.entries(PERSONA_GROUPS)) {
    groups[group] = roles
      .map(r => all.find(a => a.role === r))
      .filter(Boolean);
  }
  // Catch any persona not pinned to a group
  const grouped = new Set(Object.values(PERSONA_GROUPS).flat());
  const ungrouped = all.filter(a => !grouped.has(a.role));
  if (ungrouped.length) groups['Other'] = ungrouped;

  // ── Custom personas (corporate leaders from the intake form) ──
  // Surfaced as a synthetic group so team.html can render them next to the
  // file-backed personas. Each one carries the photo + completion status.
  try {
    const data = ensureShape(loadData());
    const schema = loadIntakeSchema();
    const manifest = loadTeamManifest();
    const customAgents = (manifest.leaders || []).map(L => {
      const persona = (data.personas || {})[L.slug];
      const pct = persona ? intakeCompletion(persona.intake, schema) : 0;
      return {
        role: 'custom:' + L.slug,
        name: L.name,
        description: persona && pct >= 50
          ? (L.title + ' — speaks in the voice of ' + L.name + ' as filled in the intake form (' + pct + '% complete).')
          : (L.title + ' — intake form not yet filled out (' + pct + '% complete). Responses will be generic until the form is completed at /persona-intake.html?slug=' + L.slug),
        photo: L.local_path,
        slug: L.slug,
        title: L.title,
        completionPct: pct,
        intakeStatus: persona ? (pct >= 100 ? 'complete' : 'draft') : 'empty',
        custom: true
      };
    });
    if (customAgents.length) {
      groups['Corporate Team'] = customAgents;
      // Also fold into `agents` so the chat endpoint can resolve role -> agent
      all.push(...customAgents);
    }
  } catch (e) {
    console.error('[/api/agents] failed to load custom personas:', e);
  }

  res.json({ agents: all, groups });
});

// ─── Role-agent prompt endpoint ─────────────────────────────────────────────
// Returns the file-backed persona body for a role, pre-concatenated with the
// SECOND_LAYER_REVIEW_MANDATE. The dashboard cockpit picker fetches this once
// when a role chip is clicked and stashes it in S.activeAgent.prompt so the
// generic /api/ai/chat path delivers the same QA-layer behavior the per-role
// endpoint does for team.html. Custom personas (custom:<slug>) keep their own
// /api/personas/:slug/prompt path — different mandate (none).
app.get('/api/agents/role/:role/prompt', checkAuth, (req, res) => {
  const role = req.params.role;
  if (String(role || '').startsWith('custom:')) {
    return res.status(400).json({ error: 'Use /api/personas/:slug/prompt for custom personas.' });
  }
  const body = getPersonaPrompt(role);
  if (!body) return res.status(404).json({ error: `No persona for role '${role}'` });
  const all = listPersonas();
  const meta = all.find(a => a.role === role) || { name: role, description: '' };
  res.json({
    role,
    name: meta.name || role,
    description: meta.description || '',
    prompt: body + SECOND_LAYER_REVIEW_MANDATE
  });
});

// ─── PMS PACE / PICKUP (Forecast Stack Layer 1) ─────────────────────────────
// Per-property daily snapshots of the PMS pace report. Canonical schema and
// rationale: docs/SHAI_FORECAST_STACK.md. Storage shape: ensureShape() init.
//
// Import contract: client POSTs already-normalized JSON. Brand-specific
// parsers run in the BROWSER (in the drag-and-drop zone on the Demand AI
// panel) so the server never sees raw file bytes — smaller attack surface
// and no temp-file disk IO. The server's job here is validation + merge.

// Valid segment buckets — keep aligned with the canonical schema in ensureShape().
const PACE_SEGMENTS = new Set(['transient', 'group', 'contract', 'wholesale', 'other']);
// Known PMS / RM source identifiers. 'manual' = pasted/entered without a parser.
// 'lighthouse' = Lighthouse BI Rev Pak xlsx export — pace + CY/LY by segment.
const PACE_SOURCES  = new Set(['pep', 'opera', 'opera-cloud', 'fosse', 'choice-advantage', 'lighthouse', 'manual']);

function _isValidYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}
function _toNumOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// POST /api/pms-pace/import
// Body: { propId, asOfDate, source, fileName?, rows: [...] }
// Returns the saved snapshot summary (rows kept, rows rejected, totals).
app.post('/api/pms-pace/import', checkAuth, (req, res) => {
  try {
    const { propId, asOfDate, source, fileName, rows, outlook, compNames } = req.body || {};
    if (propId === undefined || propId === null) return res.status(400).json({ error: 'propId required' });
    const pid = parseInt(propId, 10);
    if (isNaN(pid)) return res.status(400).json({ error: 'propId must be numeric' });
    if (!getPropertyList().find(p => p.id === pid)) {
      return res.status(404).json({ error: `Unknown property id ${pid}` });
    }
    if (!_isValidYmd(asOfDate)) return res.status(400).json({ error: 'asOfDate must be YYYY-MM-DD' });
    const src = String(source || 'manual').toLowerCase();
    if (!PACE_SOURCES.has(src)) {
      return res.status(400).json({ error: `Unknown source '${src}'. Allowed: ${[...PACE_SOURCES].join(', ')}` });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' });
    }

    // Validate + coerce each row. Reject rows that lack the minimum signal
    // (stayDate + segment + otbRooms OR otbRev). Silent drops would mask
    // parser bugs, so we count and return the reject reasons.
    const kept = [];
    const rejected = [];
    rows.forEach((r, i) => {
      const reasons = [];
      if (!_isValidYmd(r.stayDate)) reasons.push('stayDate must be YYYY-MM-DD');
      const seg = String(r.segment || '').toLowerCase();
      if (!PACE_SEGMENTS.has(seg)) reasons.push(`segment '${r.segment}' not in ${[...PACE_SEGMENTS].join('|')}`);
      const otbRooms = _toNumOrNull(r.otbRooms);
      const otbRev   = _toNumOrNull(r.otbRev);
      if (otbRooms === null && otbRev === null) reasons.push('row must include otbRooms or otbRev');
      if (reasons.length) { rejected.push({ row: i, reasons }); return; }
      kept.push({
        stayDate: r.stayDate,
        segment:  seg,
        otbRooms,
        otbRev,
        adr:          _toNumOrNull(r.adr) ?? (otbRooms && otbRev ? Math.round((otbRev / otbRooms) * 100) / 100 : null),
        pickup1d:     _toNumOrNull(r.pickup1d),
        pickup7d:     _toNumOrNull(r.pickup7d),
        lyOtbRooms:   _toNumOrNull(r.lyOtbRooms),
        lyOtbRev:     _toNumOrNull(r.lyOtbRev),
        leadTimeDays: _toNumOrNull(r.leadTimeDays),
        channelMix:   (r.channelMix && typeof r.channelMix === 'object') ? r.channelMix : null
      });
    });

    if (kept.length === 0) {
      return res.status(400).json({ error: 'No valid rows in payload', rejected });
    }

    // Optional Layer-4 outlook payload (Lighthouse 365 Day Outlook). Validate
    // the keys are YYYY-MM-DD; let the value objects pass through (their fields
    // are well-known internally — ownBar, compSetAvg, compShop, hurdle,
    // lhEvents, lhForecastRms, pickup7dRms, pickup7dAdr). Cap the size at
    // 400 dates to avoid runaway payloads (365 forward + ~30 history max).
    let cleanOutlook = null;
    if (outlook && typeof outlook === 'object' && !Array.isArray(outlook)) {
      cleanOutlook = {};
      let kept2 = 0;
      for (const [k, v] of Object.entries(outlook)) {
        if (!_isValidYmd(k) || !v || typeof v !== 'object') continue;
        cleanOutlook[k] = v;
        kept2++;
        if (kept2 >= 400) break;
      }
      if (kept2 === 0) cleanOutlook = null;
    }

    const data = ensureShape(loadData());
    if (!data.pmsPace[pid]) data.pmsPace[pid] = {};
    // Re-import for the same (propId, asOfDate) REPLACES — supersede semantics.
    data.pmsPace[pid][asOfDate] = {
      snappedAt: new Date().toISOString(),
      source:    src,
      fileName:  typeof fileName === 'string' ? fileName.slice(0, 200) : null,
      rows:      kept,
      ...(cleanOutlook ? { outlook: cleanOutlook } : {}),
      ...(Array.isArray(compNames) && compNames.length ? { compNames: compNames.slice(0, 10).map(n => String(n).slice(0, 80)) } : {})
    };
    saveData(data);

    // Summary the UI uses for inline feedback
    const totalOtbRooms = kept.reduce((a, r) => a + (r.otbRooms || 0), 0);
    const totalOtbRev   = kept.reduce((a, r) => a + (r.otbRev   || 0), 0);
    const segCounts = {};
    kept.forEach(r => { segCounts[r.segment] = (segCounts[r.segment] || 0) + 1; });
    res.json({
      propId: pid,
      asOfDate,
      source: src,
      rowsKept: kept.length,
      rowsRejected: rejected.length,
      rejected: rejected.slice(0, 10), // truncate; client doesn't need all
      totals: { otbRooms: totalOtbRooms, otbRev: Math.round(totalOtbRev) },
      segments: segCounts,
      stayDateRange: {
        first: kept.map(r => r.stayDate).sort()[0],
        last:  kept.map(r => r.stayDate).sort().slice(-1)[0]
      },
      outlookDates: cleanOutlook ? Object.keys(cleanOutlook).length : 0
    });
  } catch (e) {
    console.error('[pms-pace/import] error:', e);
    res.status(500).json({ error: 'Import failed: ' + e.message });
  }
});

// GET /api/pms-pace/:propId — list snapshots for a property.
// Query: ?asOfDate=YYYY-MM-DD returns the single snapshot's rows; without it
// returns an index of available snapshots (date, source, row count) for the UI.
app.get('/api/pms-pace/:propId', checkAuth, (req, res) => {
  const pid = parseInt(req.params.propId, 10);
  if (isNaN(pid)) return res.status(400).json({ error: 'propId must be numeric' });
  const data = ensureShape(loadData());
  const byDate = data.pmsPace[pid] || {};
  const asOf = req.query.asOfDate;
  if (asOf) {
    const snap = byDate[asOf];
    if (!snap) return res.status(404).json({ error: `No pace snapshot for property ${pid} on ${asOf}` });
    return res.json({ propId: pid, asOfDate: asOf, ...snap });
  }
  const index = Object.entries(byDate)
    .map(([asOfDate, snap]) => ({
      asOfDate,
      source: snap.source,
      snappedAt: snap.snappedAt,
      rowCount: (snap.rows || []).length,
      stayDateRange: (snap.rows || []).length
        ? { first: snap.rows.map(r => r.stayDate).sort()[0],
            last:  snap.rows.map(r => r.stayDate).sort().slice(-1)[0] }
        : null
    }))
    .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate));
  res.json({ propId: pid, snapshots: index });
});

// ─── Pickup Curve (Forecast Stack Phase 7 — longitudinal pace) ─────────────
// Given a property × future stayDate, walks back through every stored pace
// snapshot for that property and computes the OTB-at-each-lead-time series.
// Foundation for Priority 1 in FORECAST_EVOLUTION.md (pickup curve modeling).
// Result is sorted by leadDays DESC so element [0] is the earliest snapshot
// and the last element is the most recent (closest to stay date).
//
// Storage already accumulates: each weekly Rev Pak drop creates a new
// data.pmsPace[propId][asOfDate] keyed by the snapshot date. No new shape
// needed — this just queries the existing dictionary longitudinally.
//
// "Meaningful curve" = at least 3 distinct snapshots covering the stay date.
// Below that we don't have enough points to compute velocity reliably.
function buildPickupCurve(data, propId, stayDate) {
  const allSnaps = (data.pmsPace || {})[propId] || {};
  const curve = [];
  for (const asOfDate of Object.keys(allSnaps)) {
    if (asOfDate >= stayDate) continue; // skip snapshots taken on/after the stay date
    const snap = allSnaps[asOfDate];
    if (!snap || !Array.isArray(snap.rows)) continue;
    const rowsForDate = snap.rows.filter(r => r.stayDate === stayDate);
    if (!rowsForDate.length) continue;
    let totRms = 0, totRev = 0;
    const seg = { transient: 0, group: 0, contract: 0 };
    rowsForDate.forEach(r => {
      if (r.otbRooms != null) {
        totRms += r.otbRooms;
        if (seg[r.segment] != null) seg[r.segment] += r.otbRooms;
      }
      if (r.otbRev != null) totRev += r.otbRev;
    });
    // Lead time = days between asOfDate and stayDate (positive integer)
    const leadDays = Math.round((new Date(stayDate + 'T12:00:00').getTime() - new Date(asOfDate + 'T12:00:00').getTime()) / 86400000);
    if (leadDays < 0) continue;
    curve.push({
      asOfDate,
      leadDays,
      source: snap.source,
      otbRooms: totRms,
      otbRev: Math.round(totRev),
      transient: seg.transient,
      group:     seg.group,
      contract:  seg.contract
    });
  }
  // Sort by leadDays descending (earliest snapshot first, latest last)
  curve.sort((a, b) => b.leadDays - a.leadDays);
  return curve;
}

// ─── Forecast Calibration (Phase 8 — adaptive feedback loop) ───────────────
// For a property, walk back through data.forecasts (past predictions) and
// join against actuals (data.dailyPtd snapshots + data.byPeriod monthly).
// Compute delta per (forecast → actual) pair, aggregate over the last
// `windowDays` days, and emit a compact summary the model uses to self-
// correct on the next forecast generation.
//
// Method:
//   1. Iterate data.forecasts[propId] for stayDates that are now in the past
//   2. For each past stayDate, find the most-recent forecast made AT LEAST
//      1 day before the stay (so we're scoring the forecast, not the actual
//      backed into the cache after the fact)
//   3. Compare to actuals — pull occ/adr/revpar from the (propId, period)
//      manual data for the month the stayDate falls in. We only have monthly
//      aggregates from PS, not daily actuals at the segment level — so the
//      calibration is at day-total grain, not per-segment.
//   4. Compute % deltas, aggregate by DOW, by lead time band, and overall
//   5. Return compact summary
function buildCalibrationContext(data, propId, asOfDateISO, windowDays = 30) {
  const propForecasts = (data.forecasts || {})[propId];
  if (!propForecasts) return null;
  const today = asOfDateISO;
  const windowStart = new Date(new Date(today + 'T12:00:00').getTime() - windowDays * 86400000).toISOString().slice(0, 10);
  const pairs = []; // {stayDate, dow, leadDays, forecast: {occ, adr, revpar}, actual: {occ, adr, revpar}, delta: {...}}
  for (const stayDate of Object.keys(propForecasts)) {
    // Only past stay dates inside the window
    if (stayDate >= today || stayDate < windowStart) continue;
    const history = propForecasts[stayDate];
    if (!Array.isArray(history) || !history.length) continue;
    // The most useful comparison: the forecast made closest to but BEFORE
    // the stay date (highest lead-relevance). Find the entry with the
    // smallest leadDays that's still ≥1.
    const valid = history.filter(h => h && h.leadDays >= 1).sort((a, b) => a.leadDays - b.leadDays);
    if (!valid.length) continue;
    const fc = valid[0];
    // Pull actuals from the matching period's manual data. We only have
    // monthly aggregates, not daily — so we can't directly score a single
    // day's actual occ/adr/revpar. Use data.dailyPtd PTD snapshots when
    // available; otherwise skip this stayDate (no comparison possible).
    const period = stayDate.slice(0, 7);
    const ptd = (((data.dailyPtd || {})[propId] || {})[period] || {});
    // Need the snapshot from the DAY AFTER stayDate to compute single-day delta:
    //   single-day revenue = ptd[stayDate+1].revenue - ptd[stayDate].revenue
    // If we don't have both, skip.
    const sdPlus1ISO = new Date(new Date(stayDate + 'T12:00:00').getTime() + 86400000).toISOString().slice(0, 10);
    const ptdAfter = ptd[sdPlus1ISO];
    const ptdAt    = ptd[stayDate];
    let actualRev = null;
    if (ptdAfter && ptdAt && ptdAfter.revenue != null && ptdAt.revenue != null) {
      actualRev = Math.max(0, ptdAfter.revenue - ptdAt.revenue);
    }
    // Without actual rev for the day, we can't score — skip.
    if (actualRev == null) continue;
    const fcRev = fc.revenue;
    if (fcRev == null) continue;
    const revDeltaPct = fcRev > 0 ? ((fcRev - actualRev) / Math.max(1, actualRev)) * 100 : null;
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(stayDate + 'T12:00:00').getDay()];
    pairs.push({ stayDate, dow, leadDays: fc.leadDays, forecastRev: fcRev, actualRev, revDeltaPct });
  }
  if (!pairs.length) return null;

  // Aggregate
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const revDeltas = pairs.map(p => p.revDeltaPct).filter(v => v != null && isFinite(v));
  const avgRevDelta = avg(revDeltas);
  // Bias direction
  const bias = avgRevDelta == null ? 'unknown'
    : avgRevDelta > 5  ? 'forecast-optimistic'
    : avgRevDelta < -5 ? 'forecast-conservative'
    : 'well-calibrated';
  // Per-DOW pattern: average delta by day-of-week
  const byDow = {};
  for (const p of pairs) {
    if (p.revDeltaPct == null || !isFinite(p.revDeltaPct)) continue;
    if (!byDow[p.dow]) byDow[p.dow] = [];
    byDow[p.dow].push(p.revDeltaPct);
  }
  const dowPattern = Object.fromEntries(
    Object.entries(byDow).map(([d, arr]) => [d, Math.round(avg(arr) * 10) / 10])
  );
  // Per lead-time-band pattern
  const bandKey = ld => ld <= 3 ? '0-3' : ld <= 7 ? '4-7' : ld <= 14 ? '8-14' : ld <= 21 ? '15-21' : '22+';
  const byBand = {};
  for (const p of pairs) {
    if (p.revDeltaPct == null || !isFinite(p.revDeltaPct)) continue;
    const b = bandKey(p.leadDays);
    if (!byBand[b]) byBand[b] = [];
    byBand[b].push(p.revDeltaPct);
  }
  const leadBandPattern = Object.fromEntries(
    Object.entries(byBand).map(([b, arr]) => [b, Math.round(avg(arr) * 10) / 10])
  );
  return {
    windowDays,
    pairsScored: pairs.length,
    avgRevDeltaPct: avgRevDelta != null ? Math.round(avgRevDelta * 10) / 10 : null,
    bias,
    dowPattern,
    leadBandPattern
  };
}

// GET /api/forecast-calibration/:propId
// Standalone read of recent forecast accuracy for the UI panel.
app.get('/api/forecast-calibration/:propId', checkAuth, (req, res) => {
  const pid = parseInt(req.params.propId, 10);
  if (isNaN(pid)) return res.status(400).json({ error: 'propId must be numeric' });
  const windowDays = parseInt(req.query.windowDays || '30', 10);
  const data = ensureShape(loadData());
  const cal = buildCalibrationContext(data, pid, new Date().toISOString().slice(0, 10), windowDays);
  res.json({ propId: pid, calibration: cal });
});

// GET /api/pickup-curve/:propId/:stayDate
// Returns the longitudinal pickup curve for a future stay date. UI can
// render it as a sparkline in the drill-down. Returns 200 even when the
// curve is empty (just an empty array — UI hides the section).
app.get('/api/pickup-curve/:propId/:stayDate', checkAuth, (req, res) => {
  const pid = parseInt(req.params.propId, 10);
  if (isNaN(pid)) return res.status(400).json({ error: 'propId must be numeric' });
  const sd = req.params.stayDate;
  if (!_isValidYmd(sd)) return res.status(400).json({ error: 'stayDate must be YYYY-MM-DD' });
  const data = ensureShape(loadData());
  const curve = buildPickupCurve(data, pid, sd);
  res.json({ propId: pid, stayDate: sd, curve, points: curve.length });
});

// DELETE /api/pms-pace/:propId/:asOfDate — remove a single snapshot.
// Used by the UI's "remove" button on a snapshot list entry.
app.delete('/api/pms-pace/:propId/:asOfDate', checkAuth, (req, res) => {
  const pid = parseInt(req.params.propId, 10);
  if (isNaN(pid)) return res.status(400).json({ error: 'propId must be numeric' });
  const asOf = req.params.asOfDate;
  if (!_isValidYmd(asOf)) return res.status(400).json({ error: 'asOfDate must be YYYY-MM-DD' });
  const data = ensureShape(loadData());
  if (data.pmsPace[pid] && data.pmsPace[pid][asOf]) {
    delete data.pmsPace[pid][asOf];
    saveData(data);
    return res.json({ ok: true, propId: pid, asOfDate: asOf });
  }
  res.status(404).json({ error: 'Snapshot not found' });
});

// ─── COMMITMENT TRACKING ─────────────────────────────────────────────────────
// Personas can emit a fenced ```track ... ``` block at the END of their response
// to log decisions, actions, and watchlist additions to data.json. The block is
// stripped from the visible response and parsed server-side.
// ─── PERSONA MEMORY ─────────────────────────────────────────────────────────
// Each persona has a memory log at superhost-agents/memory/<role>.json. After
// each conversation, the agent can emit a fenced ```remember block with key
// conclusions, which we append. On the next call, the most recent N entries
// are injected into the system prompt so the persona "remembers" prior work.
const MEMORY_DIR = path.join(__dirname, 'superhost-agents', 'memory');

function memoryPathFor(role) {
  return path.join(MEMORY_DIR, `${role}.json`);
}

function loadMemory(role) {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const p = memoryPathFor(role);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function saveMemory(role, entries) {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(memoryPathFor(role), JSON.stringify(entries, null, 2));
}

function appendMemory(role, entry) {
  const entries = loadMemory(role);
  entries.unshift({
    id: newId('mem'),
    at: new Date().toISOString(),
    ...entry
  });
  // Cap memory at 60 entries (~6 months of weekly use). Older entries fall off.
  saveMemory(role, entries.slice(0, 60));
}

function extractMemoryBlock(text) {
  if (!text) return { cleanText: text || '', memory: null };
  const re = /```remember\s*\n([\s\S]*?)\n```\s*$/i;
  const m = text.match(re);
  if (!m) return { cleanText: text, memory: null };
  let parsed = null;
  try { parsed = JSON.parse(m[1]); } catch { return { cleanText: text, memory: null }; }
  const cleanText = text.slice(0, m.index).trimEnd();
  return { cleanText, memory: parsed };
}

function buildMemoryContext(role, propertyId) {
  const entries = loadMemory(role);
  if (!entries.length) return '';
  // Prioritize entries scoped to the same property if propertyId is set; otherwise most recent.
  const targetId = propertyId ? Number(propertyId) : null;
  let scoped = targetId ? entries.filter(e => e.propertyId === targetId) : [];
  let general = entries.filter(e => !e.propertyId || (targetId && e.propertyId !== targetId));
  // Take up to 5 scoped + 5 general, most recent first
  const picked = [...scoped.slice(0, 5), ...general.slice(0, 5)].slice(0, 8);
  if (!picked.length) return '';

  const lines = picked.map(e => {
    const date = (e.at || '').slice(0, 10);
    const tag = e.propertyId ? `[Prop ${e.propertyId}]` : '[Portfolio]';
    return `- ${date} ${tag} ${e.title}: ${e.conclusion || e.summary || ''}`;
  });
  return `\n\n---\nPRIOR CONCLUSIONS (your memory — most recent ${picked.length} entries):\n${lines.join('\n')}\nReference these where they bear on the current question. Do not repeat them verbatim.`;
}

const REMEMBER_INSTRUCTIONS = `

---
MEMORY (optional — use it when the conclusion is durable)
If the conclusion you reach in this conversation is something you'd want to remember the next time you're asked about this property, owner, or topic, append a fenced \\\`\\\`\\\`remember\\\`\\\`\\\` block at the very end of your response (AFTER any track block). Format:

\\\`\\\`\\\`remember
{
  "title": "short noun-phrase headline",
  "conclusion": "one-sentence durable insight worth recalling next time",
  "propertyId": <id or null>,
  "tags": ["tag1", "tag2"]
}
\\\`\\\`\\\`

Rules:
- Use sparingly. A memory is for things that should change how you answer LATER, not chat reflections.
- One entry per response. If you have multiple, pick the most durable.
- Do not include if the conversation produced no durable insight.
`;

const TRACK_INSTRUCTIONS = `

---
COMMITMENT TRACKING
When you propose a concrete decision the leadership team should make, an action with a named owner and date, or a property that should go on the watchlist, append a fenced track block at the very END of your response (after your normal answer). Use this exact format:

\\\`\\\`\\\`track
{
  "decisions": [
    { "title": "Short decision title", "rationale": "1-2 sentence why", "recommendedOwner": "Name or role", "dueDate": "YYYY-MM-DD", "propertyId": 5 }
  ],
  "actions": [
    { "title": "Specific action — verb-led", "owner": "Name or role", "dueDate": "YYYY-MM-DD", "propertyId": 5 }
  ],
  "watchlist": [
    { "propertyId": 5, "reason": "why on watch", "metric": "flow", "current": "-38%", "exitCriteria": "two months at flow > 25%" }
  ]
}
\\\`\\\`\\\`

Rules:
- Use this sparingly — only when you are recommending something specific the team should track. Most answers should NOT include a track block.
- Every action needs an owner AND a date. No "TBD."
- propertyId is optional; omit if portfolio-wide.
- If you have nothing to track, do not include the block.
- The block is invisible to the user — they see your prose answer; the system stores the block.`;

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function extractTrackBlock(text) {
  if (!text) return { cleanText: text, captured: { decisions: [], actions: [], watchlist: [] } };
  const re = /```track\s*\n([\s\S]*?)\n```\s*$/i;
  const m = text.match(re);
  if (!m) return { cleanText: text, captured: { decisions: [], actions: [], watchlist: [] } };
  let parsed = { decisions: [], actions: [], watchlist: [] };
  try {
    const obj = JSON.parse(m[1]);
    parsed.decisions = Array.isArray(obj.decisions) ? obj.decisions : [];
    parsed.actions   = Array.isArray(obj.actions)   ? obj.actions   : [];
    parsed.watchlist = Array.isArray(obj.watchlist) ? obj.watchlist : [];
  } catch (e) { /* malformed track block — ignore */ }
  const cleanText = text.slice(0, m.index).trimEnd();
  return { cleanText, captured: parsed };
}

// ─── HANDOFF BLOCK ─────────────────────────────────────────────────────────
// A skill can recommend a sibling skill to run next by emitting a fenced
// ```handoff``` block. Format:
//   ```handoff
//   { "skill": "vp-capital-pip-response", "reason": "PIP scope negotiation needed" }
//   ```
// The block is stripped from the visible response and surfaced as
// `suggestedHandoff` in the API response. The UI renders a one-click chain
// button. Non-anchored regex — works whether the block sits before or after
// the track block.
function extractHandoffBlock(text) {
  if (!text) return { cleanText: text, handoff: null };
  const re = /\n?```handoff\s*\n([\s\S]*?)\n```\s*/i;
  const m = text.match(re);
  if (!m) return { cleanText: text, handoff: null };
  let parsed = null;
  try {
    const obj = JSON.parse(m[1]);
    if (obj && typeof obj.skill === 'string' && obj.skill.trim()) {
      parsed = { skill: obj.skill.trim(), reason: typeof obj.reason === 'string' ? obj.reason : '' };
    }
  } catch (e) { /* malformed handoff — ignore, surface no chain */ }
  if (!parsed) return { cleanText: text, handoff: null };
  const cleanText = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trimEnd();
  return { cleanText, handoff: parsed };
}

function persistCaptured(data, captured, meta) {
  const now = new Date().toISOString();
  const stored = { decisions: [], actions: [], watchlist: [] };
  for (const d of captured.decisions || []) {
    const item = {
      id: newId('dec'),
      title: d.title || '(untitled)',
      rationale: d.rationale || '',
      recommendedOwner: d.recommendedOwner || null,
      decidedBy: null,
      dueDate: d.dueDate || null,
      propertyId: d.propertyId != null ? Number(d.propertyId) : null,
      proposedBy: meta.role,
      status: 'proposed',
      createdAt: now,
      updatedAt: now
    };
    data.decisions.unshift(item);
    stored.decisions.push(item);
  }
  for (const a of captured.actions || []) {
    const item = {
      id: newId('act'),
      title: a.title || '(untitled)',
      owner: a.owner || null,
      dueDate: a.dueDate || null,
      propertyId: a.propertyId != null ? Number(a.propertyId) : null,
      createdBy: meta.role,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      notes: []
    };
    data.actions.unshift(item);
    stored.actions.push(item);
  }
  for (const w of captured.watchlist || []) {
    const item = {
      id: newId('wl'),
      propertyId: w.propertyId != null ? Number(w.propertyId) : null,
      reason: w.reason || '',
      metric: w.metric || null,
      current: w.current || null,
      exitCriteria: w.exitCriteria || null,
      addedBy: meta.role,
      status: 'active',
      addedAt: now,
      updatedAt: now
    };
    data.watchlist.unshift(item);
    stored.watchlist.push(item);
  }
  // Cap each list at 500 items
  data.decisions = data.decisions.slice(0, 500);
  data.actions   = data.actions.slice(0, 500);
  data.watchlist = data.watchlist.slice(0, 500);
  return stored;
}

app.post('/api/agent/:role', checkAuth, async (req, res) => {
  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured. See Admin.' });

  const personaBody = getPersonaPrompt(req.params.role);
  if (!personaBody) return res.status(404).json({ error: `No persona for role '${req.params.role}'` });

  const { question, propertyId, period, history, includeSnapshot } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question is required' });

  const data       = ensureShape(loadData());
  const usePeriod  = period || config.activePeriod;
  const wantSnap   = includeSnapshot !== false;
  const snapshot   = wantSnap ? buildPortfolioSnapshot(data, usePeriod) : '';

  // Optional: scope to single property
  let propContext = '';
  if (propertyId) {
    const prop = getPropertyList().find(p => p.id === parseInt(propertyId));
    if (prop) {
      const pData = (data.byPeriod[usePeriod] || {})[prop.id] || {};
      const m = pData.manual || {};
      const flow = calcFlow(m);
      propContext = `\n\nPROPERTY FOCUS — ${prop.name} (id ${prop.id}, ${prop.brand}, ${prop.state}, RDO: ${prop.rdo}, RSM: ${prop.rsm}, Owner: ${prop.owner}):\n` +
        `Score ${calcScore(m) ?? 'N/A'}/200 | RevPAR $${m.revpar??'?'} (bud $${m.revparBud??'?'}) | Occ ${m.occ??'?'}% | ADR $${m.adr??'?'} (bud $${m.adrBud??'?'}) | GOP ${m.gop??'?'}% | Flow ${flow!=null?flow.toFixed(0)+'%':'N/A'} | Labor ${m.labor??'?'}% (bud ${m.laborBud??'?'}%)`;
      const note = (data.notes[prop.id] || {}).current || '';
      if (note) propContext += `\nOperational note: ${note}`;
    }
  }

  // Recent open decisions/actions on this property — gives the agent memory of prior commitments
  let recentContext = '';
  const targetId = propertyId ? parseInt(propertyId) : null;
  const recentActions = data.actions.filter(a => a.status !== 'done' && a.status !== 'cancelled' && (!targetId || a.propertyId === targetId)).slice(0, 8);
  const recentDecisions = data.decisions.filter(d => d.status === 'proposed' || d.status === 'decided' || d.status === 'in-progress').filter(d => !targetId || d.propertyId === targetId).slice(0, 6);
  if (recentActions.length || recentDecisions.length) {
    recentContext = '\n\nOPEN COMMITMENTS in the team\'s tracker';
    if (targetId) recentContext += ' for this property';
    recentContext += ':';
    if (recentDecisions.length) {
      recentContext += '\nDecisions: ' + recentDecisions.map(d => `[${d.status}] ${d.title} (proposed by ${d.proposedBy}${d.dueDate?', due '+d.dueDate:''})`).join('; ');
    }
    if (recentActions.length) {
      recentContext += '\nActions: ' + recentActions.map(a => `[${a.status}] ${a.title} — ${a.owner||'?'}${a.dueDate?' / '+a.dueDate:''}`).join('; ');
    }
    recentContext += '\nReference these where relevant. Do not duplicate them in your track block.';
  }

  const companyContext = `\n\n---\nCOMPANY CONTEXT — Superhost Hospitality manages 17 select-service and extended-stay hotels across IL, MI, NC, TX, KY, IN, GA. Brand families: Hilton, Marriott, IHG, Choice. COO: Tim Foley. RDOs: Jennifer Kruk, Mark Gammill. RSMs: Teresa Bitner, Nate Taylor. Owners: Lakhany Group, Capitol One, INDC, Alpental Capital, Gateway, Gulfstream. Apply your persona to THIS company's actual data below.`;

  // Second-layer review mandate — fires ONLY for file-backed role-archetype
  // personas (CEO, COO, CFO, VPs, Regional VP, Area GM). Custom personas
  // (custom:<slug> — named corporate leaders speaking in their own voice via
  // intake-form-trained prompts) do NOT get this block; they ARE the first
  // layer. Role agents are the QA layer that interrogates the corp team's
  // numbers and conclusions rather than rubber-stamping them.
  const isRoleAgent = !String(req.params.role || '').startsWith('custom:');
  const secondLayerReviewContext = isRoleAgent ? SECOND_LAYER_REVIEW_MANDATE : '';

  const ownerContext = propertyId ? buildOwnerContext(propertyId, data) : '';

  // If the user invoked a skill via [SKILL: skill-id] in the message or history, load it.
  const skillProbe = [...(history || []), { content: question }];
  const skillId    = detectSkillFromMessages(skillProbe);
  const skillBlock = skillId ? buildSkillSystemBlock(skillId) : '';

  const memoryContext = buildMemoryContext(req.params.role, propertyId);
  const gmContext     = propertyId ? buildGMContext(propertyId, data) : '';

  const fullSystem = personaBody + companyContext + secondLayerReviewContext + snapshot + propContext + ownerContext + gmContext + recentContext + memoryContext + skillBlock + TRACK_INSTRUCTIONS + REMEMBER_INSTRUCTIONS;

  const messages = (history && Array.isArray(history) ? history : []).concat([
    { role: 'user', content: question }
  ]);

  try {
    const rawText = await callClaude(apiKey, fullSystem, messages, 2500);
    // Strip remember block first (it sits at the very end), then track block
    const memOut = extractMemoryBlock(rawText);
    const { cleanText, captured } = extractTrackBlock(memOut.cleanText);
    const stored = persistCaptured(data, captured, { role: req.params.role });
    if (stored.decisions.length || stored.actions.length || stored.watchlist.length) {
      saveData(data);
    }
    let memoryStored = null;
    if (memOut.memory && memOut.memory.title) {
      const m = memOut.memory;
      memoryStored = {
        title: m.title,
        conclusion: m.conclusion || m.summary || '',
        propertyId: m.propertyId != null ? Number(m.propertyId) : null,
        tags: Array.isArray(m.tags) ? m.tags : []
      };
      appendMemory(req.params.role, memoryStored);
    }
    res.json({
      role: req.params.role,
      period: usePeriod,
      propertyId: propertyId || null,
      response: cleanText,
      captured: stored,
      memory: memoryStored
    });
  } catch (e) {
    res.status(500).json({ error: 'Agent call failed: ' + e.message });
  }
});

// ─── PERSONA MEMORY ENDPOINTS ───────────────────────────────────────────────
app.get('/api/memory/:role', checkAuth, (req, res) => {
  res.json({ role: req.params.role, entries: loadMemory(req.params.role) });
});

app.delete('/api/memory/:role/:id', checkAuth, (req, res) => {
  const entries = loadMemory(req.params.role);
  const next = entries.filter(e => e.id !== req.params.id);
  saveMemory(req.params.role, next);
  res.json({ removed: entries.length - next.length });
});

app.delete('/api/memory/:role', checkAuth, (req, res) => {
  saveMemory(req.params.role, []);
  res.json({ cleared: true });
});

// ─── COCKPIT: DECISIONS / ACTIONS / WATCHLIST ───────────────────────────────
app.get('/api/cockpit', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const isOverdue = (item) => item.dueDate && new Date(item.dueDate).getTime() < now && item.status !== 'done' && item.status !== 'cancelled';
  const isThisWeek = (item) => item.dueDate && new Date(item.dueDate).getTime() <= now + sevenDays;
  res.json({
    decisions: data.decisions || [],
    actions: data.actions || [],
    watchlist: data.watchlist || [],
    summary: {
      decisionsProposed: data.decisions.filter(d => d.status === 'proposed').length,
      decisionsDecided: data.decisions.filter(d => d.status === 'decided').length,
      actionsOpen: data.actions.filter(a => a.status === 'open' || a.status === 'in-progress').length,
      actionsOverdue: data.actions.filter(isOverdue).length,
      actionsThisWeek: data.actions.filter(a => (a.status === 'open' || a.status === 'in-progress') && isThisWeek(a)).length,
      watchlistActive: data.watchlist.filter(w => w.status === 'active').length
    }
  });
});

app.post('/api/decisions', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const now = new Date().toISOString();
  const item = {
    id: newId('dec'),
    title: req.body.title || '(untitled)',
    rationale: req.body.rationale || '',
    recommendedOwner: req.body.recommendedOwner || null,
    decidedBy: req.body.decidedBy || null,
    dueDate: req.body.dueDate || null,
    propertyId: req.body.propertyId != null ? Number(req.body.propertyId) : null,
    proposedBy: req.body.proposedBy || 'manual',
    status: req.body.status || 'proposed',
    createdAt: now,
    updatedAt: now
  };
  data.decisions.unshift(item);
  saveData(data);
  res.json({ decision: item });
});

app.patch('/api/decisions/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const idx = data.decisions.findIndex(d => d.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Decision not found' });
  const allowed = ['title','rationale','recommendedOwner','decidedBy','dueDate','propertyId','status'];
  for (const k of allowed) if (k in req.body) data.decisions[idx][k] = req.body[k];
  data.decisions[idx].updatedAt = new Date().toISOString();
  saveData(data);
  res.json({ decision: data.decisions[idx] });
});

app.delete('/api/decisions/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const before = data.decisions.length;
  data.decisions = data.decisions.filter(d => d.id !== req.params.id);
  saveData(data);
  res.json({ removed: before - data.decisions.length });
});

app.post('/api/actions', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const now = new Date().toISOString();
  const item = {
    id: newId('act'),
    title: req.body.title || '(untitled)',
    owner: req.body.owner || null,
    dueDate: req.body.dueDate || null,
    propertyId: req.body.propertyId != null ? Number(req.body.propertyId) : null,
    createdBy: req.body.createdBy || 'manual',
    status: req.body.status || 'open',
    createdAt: now,
    updatedAt: now,
    notes: req.body.notes || []
  };
  data.actions.unshift(item);
  saveData(data);
  res.json({ action: item });
});

app.patch('/api/actions/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const idx = data.actions.findIndex(a => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Action not found' });
  const allowed = ['title','owner','dueDate','propertyId','status','notes'];
  for (const k of allowed) if (k in req.body) data.actions[idx][k] = req.body[k];
  data.actions[idx].updatedAt = new Date().toISOString();
  saveData(data);
  res.json({ action: data.actions[idx] });
});

app.delete('/api/actions/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const before = data.actions.length;
  data.actions = data.actions.filter(a => a.id !== req.params.id);
  saveData(data);
  res.json({ removed: before - data.actions.length });
});

app.post('/api/watchlist', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const now = new Date().toISOString();
  const item = {
    id: newId('wl'),
    propertyId: req.body.propertyId != null ? Number(req.body.propertyId) : null,
    reason: req.body.reason || '',
    metric: req.body.metric || null,
    current: req.body.current || null,
    exitCriteria: req.body.exitCriteria || null,
    addedBy: req.body.addedBy || 'manual',
    status: req.body.status || 'active',
    addedAt: now,
    updatedAt: now
  };
  data.watchlist.unshift(item);
  saveData(data);
  res.json({ watchlist: item });
});

app.patch('/api/watchlist/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const idx = data.watchlist.findIndex(w => w.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Watchlist item not found' });
  const allowed = ['propertyId','reason','metric','current','exitCriteria','status'];
  for (const k of allowed) if (k in req.body) data.watchlist[idx][k] = req.body[k];
  data.watchlist[idx].updatedAt = new Date().toISOString();
  saveData(data);
  res.json({ watchlist: data.watchlist[idx] });
});

app.delete('/api/watchlist/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const before = data.watchlist.length;
  data.watchlist = data.watchlist.filter(w => w.id !== req.params.id);
  saveData(data);
  res.json({ removed: before - data.watchlist.length });
});

// ─── WEEKLY CROSS-PORTFOLIO SCAN ────────────────────────────────────────────
// Four scanners run in parallel (COO, CFO, VP RM, VP People) — each surfaces
// 2-3 cross-property patterns from their lens. Chief of Staff synthesizes into
// a leadership brief: 5 headlines + 3-5 recommended moves. The moat: this is
// pattern detection across the portfolio that no single-property review surfaces.

const SCANNER_ROLES = ['coo', 'cfo', 'vp-revenue-management', 'vp-people'];
const SYNTHESIZER_ROLE = 'chief-of-staff';

const SCAN_INSTRUCTIONS = `

---
WEEKLY CROSS-PORTFOLIO SCAN — your task

You are NOT answering a single question. You are scanning the portfolio for patterns the leadership team should know about this week — patterns NOT visible in any single property's data.

Look specifically for:
- Multi-property patterns (3+ hotels showing the same trend)
- Cross-functional implications (a "labor problem" that's actually a scheduling-system problem)
- Owner-concentration risks (one owner dragging or pulling the portfolio)
- Brand-cluster patterns (e.g., all the Home2s, all the IHG hotels)
- Items that have been on the watchlist or in the action tracker too long

Output exactly 2-3 patterns. For each:
- Sharp 1-line title (no fluff, no "we should consider")
- Evidence: 2-3 specific properties + their numbers
- Why it matters: 1 sentence
- Recommendation: a verb-led, specific action

Tight. ~600 tokens total. NO opening line about scanning. Get to the patterns.

End with this exact JSON block:
\\\`\\\`\\\`scan
{
  "patterns": [
    { "title": "...", "evidence": "...", "why": "...", "recommendation": "..." }
  ]
}
\\\`\\\`\\\`
`;

const SYNTHESIZER_INSTRUCTIONS = `

---
WEEKLY SCAN SYNTHESIS — your task

Four scanners (COO, CFO, VP RM, VP People) just submitted their patterns. They are listed below. Your job is NOT to summarize them — it's to synthesize the leadership team's brief for this week.

Specifically:
1. Connect dots across scanners they did not see in each other (the dot-connection IS the value).
2. Surface the 5 most important things the leadership team needs to know.
3. Recommend 3-5 specific moves with a named owner and date.

Output structure (markdown):

## This week's headlines
- 5 short bullets, each leading with the conclusion (not "the COO said")

## Across functions
- The 1-2 dot-connections only the synthesis sees

## Recommended moves
- 3-5 specific actions with named owner and date (real names: Chris Chatfield, Jennifer Kruk, Mark Gammill, Tim Foley, Teresa Bitner, Nate Taylor, or the relevant role)

End with this exact JSON block:
\\\`\\\`\\\`scan
{
  "headlines": ["...", "..."],
  "actions": [
    { "title": "...", "owner": "...", "dueDate": "YYYY-MM-DD", "propertyId": null }
  ]
}
\\\`\\\`\\\`
`;

function extractScanBlock(text) {
  if (!text) return { cleanText: text || '', parsed: {} };
  const m = text.match(/```scan\s*\n([\s\S]*?)\n```/i);
  if (!m) return { cleanText: text, parsed: {} };
  let parsed = {};
  try { parsed = JSON.parse(m[1]); } catch(e) {}
  const cleanText = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  return { cleanText, parsed };
}

function buildScanContext(data, period) {
  const snapshot = buildPortfolioSnapshot(data, period);
  const isOverdueItem = (a) => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'done' && a.status !== 'cancelled';
  const open = data.actions.filter(a => a.status === 'open' || a.status === 'in-progress');
  const overdue = open.filter(isOverdueItem);
  const watch = (data.watchlist || []).filter(w => w.status === 'active');
  const propName = (id) => {
    const p = getPropertyList().find(pr => pr.id === id);
    return p ? p.name : `Property ${id}`;
  };

  // Owner concentration
  const owners = getOwnerList();
  const ownerLines = owners.map(o => {
    const profile = data.ownerProfiles[o.id];
    const filledHints = profile && (profile.hotButtons?.length || profile.redFlags?.length) ? ` [profile loaded]` : '';
    return `  · ${o.name}: ${o.activeCount} active, brands ${o.brandFamilies.join('/')}${filledHints}`;
  }).join('\n');

  return `\n\nCOCKPIT STATE — Period ${period}:\n` +
    `- ${open.length} open actions (${overdue.length} overdue)\n` +
    `- ${watch.length} on watchlist:\n` +
    (watch.length ? watch.slice(0,8).map(w => `  · ${propName(w.propertyId)}: ${w.reason} (${w.metric||''} ${w.current||''})`).join('\n') : '  · none\n') +
    `\n\nOWNER CONCENTRATION:\n${ownerLines}` +
    snapshot;
}

app.post('/api/scan/weekly', checkAuth, async (req, res) => {
  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured. See Admin.' });
  const data = ensureShape(loadData());
  const period = (req.body && req.body.period) || config.activePeriod;

  const companyContext = `\n\n---\nCOMPANY CONTEXT — Superhost Hospitality manages 17 select-service and extended-stay hotels across IL, MI, NC, TX, KY, IN, GA. Brand families: Hilton, Marriott, IHG, Choice. COO: Tim Foley. RDOs: Jennifer Kruk, Mark Gammill. RSMs: Teresa Bitner, Nate Taylor. Owners: Lakhany Group, Capitol One, INDC, Alpental Capital, Gateway, Gulfstream.`;
  const scanContext = buildScanContext(data, period);

  let scanners = [];
  try {
    scanners = await Promise.all(SCANNER_ROLES.map(async role => {
      const persona = getPersonaPrompt(role);
      if (!persona) return { role, error: 'persona not found', patterns: [], rawText: '' };
      const sys = persona + companyContext + scanContext + SCAN_INSTRUCTIONS;
      try {
        const text = await callClaude(apiKey, sys, [{ role:'user', content:'Run your weekly scan now.' }], 1200);
        const { cleanText, parsed } = extractScanBlock(text);
        return { role, patterns: parsed.patterns || [], rawText: cleanText };
      } catch (e) {
        return { role, error: e.message, patterns: [], rawText: '' };
      }
    }));
  } catch (e) {
    return res.status(500).json({ error: 'Scanner phase failed: ' + e.message });
  }

  // Synthesizer
  const synPersona = getPersonaPrompt(SYNTHESIZER_ROLE) || '';
  const reports = scanners.map(s => {
    const head = `\n\n--- SCANNER: ${friendlyRole(s.role)} ---`;
    const pat = (s.patterns || []).map((p, i) => `${i+1}. ${p.title}\n   evidence: ${p.evidence}\n   why: ${p.why}\n   recommendation: ${p.recommendation}`).join('\n');
    return `${head}\n${pat || s.rawText || '(no patterns)'}`;
  }).join('\n');
  const synSys = synPersona + companyContext + scanContext + `\n\nSCANNER REPORTS:${reports}` + SYNTHESIZER_INSTRUCTIONS;

  let synthesis = { headlines: [], actions: [], rawText: '' };
  try {
    const synText = await callClaude(apiKey, synSys, [{ role:'user', content:'Synthesize the four scanner reports into the leadership brief.' }], 1800);
    const { cleanText, parsed } = extractScanBlock(synText);
    synthesis = { headlines: parsed.headlines || [], actions: parsed.actions || [], rawText: cleanText };
  } catch (e) {
    synthesis.rawText = `Synthesizer failed: ${e.message}`;
  }

  const scan = {
    id: newId('scan'),
    createdAt: new Date().toISOString(),
    period,
    scanners,
    synthesis
  };
  data.scans.unshift(scan);
  data.scans = data.scans.slice(0, 50);
  saveData(data);

  res.json({ scan });
});

function friendlyRole(role) {
  return role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace('Vp ', 'VP ').replace('Cfo','CFO').replace('Ceo','CEO').replace('Coo','COO')
    .replace('Cdo','CDO').replace('Cto','CTO').replace('Cmo','CMO');
}

app.get('/api/scans', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  // Return summary (no full text) for list view
  const summary = (data.scans || []).map(s => ({
    id: s.id,
    createdAt: s.createdAt,
    period: s.period,
    scannerCount: s.scanners.length,
    patternCount: s.scanners.reduce((n, sc) => n + (sc.patterns?.length || 0), 0),
    headlineCount: s.synthesis.headlines?.length || 0,
    actionCount: s.synthesis.actions?.length || 0,
    headlines: s.synthesis.headlines || []
  }));
  res.json({ scans: summary });
});

app.get('/api/scans/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const scan = (data.scans || []).find(s => s.id === req.params.id);
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  res.json({ scan });
});

app.delete('/api/scans/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const before = data.scans.length;
  data.scans = data.scans.filter(s => s.id !== req.params.id);
  saveData(data);
  res.json({ removed: before - data.scans.length });
});

// Promote a scan pattern to a decision or action (links into the cockpit)
app.post('/api/scans/:scanId/promote', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const scan = (data.scans || []).find(s => s.id === req.params.scanId);
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  const { kind, scannerRole, patternIndex, owner, dueDate, propertyId } = req.body || {};
  if (!kind || !['decision','action'].includes(kind)) return res.status(400).json({ error: 'kind must be "decision" or "action"' });

  let title, rationale;
  if (scannerRole === 'synthesis') {
    const a = scan.synthesis.actions?.[patternIndex];
    if (!a) return res.status(400).json({ error: 'synthesis action not found' });
    title = a.title;
    rationale = `Promoted from weekly scan synthesis (${scan.id})`;
  } else {
    const sc = scan.scanners.find(s => s.role === scannerRole);
    const p = sc?.patterns?.[patternIndex];
    if (!p) return res.status(400).json({ error: 'pattern not found' });
    title = p.recommendation || p.title;
    rationale = `${p.title} — ${p.why}\nEvidence: ${p.evidence}\n(promoted from ${scannerRole} scan in ${scan.id})`;
  }
  const now = new Date().toISOString();
  if (kind === 'decision') {
    const item = {
      id: newId('dec'), title, rationale,
      recommendedOwner: owner || null, decidedBy: null,
      dueDate: dueDate || null,
      propertyId: propertyId != null ? Number(propertyId) : null,
      proposedBy: `scan:${scannerRole||'synthesis'}`,
      status: 'proposed', createdAt: now, updatedAt: now
    };
    data.decisions.unshift(item);
    saveData(data);
    return res.json({ decision: item });
  } else {
    const item = {
      id: newId('act'), title,
      owner: owner || null,
      dueDate: dueDate || null,
      propertyId: propertyId != null ? Number(propertyId) : null,
      createdBy: `scan:${scannerRole||'synthesis'}`,
      status: 'open', createdAt: now, updatedAt: now, notes: [rationale]
    };
    data.actions.unshift(item);
    saveData(data);
    return res.json({ action: item });
  }
});

// ─── COUNCIL MODE ───────────────────────────────────────────────────────────
// Multi-persona deliberation: each picked persona answers the SAME question
// in parallel, then Chief of Staff synthesizes into a single recommendation.
// Different from Weekly Scan: user picks the personas + the question.
// Same as Scan: outputs persist, can promote actions to the cockpit.

const COUNCIL_SYNTHESIZER_ROLE = 'chief-of-staff';

const COUNCIL_PARTICIPANT_INSTRUCTIONS = `

---
COUNCIL DELIBERATION — your task

You are one of several executives convened to weigh in on a strategic question. The user wants YOUR lens on this question, not a balanced summary.

- Answer in YOUR voice. Do NOT hedge or hand off to other executives.
- Lead with your call. State what you'd do, then why.
- Reference numbers from the data when relevant.
- Surface ONE thing the other executives might disagree with you on, and explain why you'd hold the line.
- Keep it tight: ~250-400 words. The synthesizer will pull the threads together.
- Do NOT include a track block in this response. Only the synthesizer commits actions.
- Do NOT summarize the question. Get to your answer.
`;

const COUNCIL_SYNTHESIZER_INSTRUCTIONS = `

---
COUNCIL SYNTHESIS — your task

You are the Chief of Staff. The leadership team just deliberated on the question below. Each executive's response is appended. Your job is to produce the leadership team's call.

Output structure (in this order):

## Headline
One sentence — the recommendation.

## Where they aligned
Bullets — 2-4 points where the executives converged.

## Where they disagreed
Bullets — name the specific tensions. Who held what position. Which side had the stronger argument and why.

## Recommendation
The decision the team should make. 3-5 sentences. Specific. Names the tradeoff being chosen.

## Moves
3-5 specific actions with named owner and date.

End with this exact JSON block:

\\\`\\\`\\\`council
{
  "headline": "one-sentence call",
  "consensus": ["..."],
  "tensions": ["..."],
  "actions": [
    { "title": "verb-led action", "owner": "Name or role", "dueDate": "YYYY-MM-DD", "propertyId": null }
  ]
}
\\\`\\\`\\\`
`;

function extractCouncilBlock(text) {
  if (!text) return { cleanText: text || '', parsed: {} };
  const m = text.match(/```council\s*\n([\s\S]*?)\n```/i);
  if (!m) return { cleanText: text, parsed: {} };
  let parsed = {};
  try { parsed = JSON.parse(m[1]); } catch {}
  const cleanText = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  return { cleanText, parsed };
}

app.post('/api/council', checkAuth, async (req, res) => {
  const config = loadConfig();
  const apiKey = aiKey(config);
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured. See Admin.' });

  const { question, roles, propertyId, period } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question is required' });
  if (!Array.isArray(roles) || roles.length < 2) {
    return res.status(400).json({ error: 'pick at least 2 personas' });
  }
  if (roles.length > 8) {
    return res.status(400).json({ error: 'max 8 personas per council session' });
  }

  const data = ensureShape(loadData());
  const usePeriod = period || config.activePeriod;
  // Lite snapshot — council calls fan out across many personas; the full snapshot
  // (~13K tokens) × 7 calls blows the org-level 10K input-tokens-per-minute Sonnet
  // budget. Lite drops historical sections, keeping ~4-5K tokens.
  const snapshot = buildPortfolioSnapshot(data, usePeriod, { lite: true });

  // Build property + owner + GM context if scoped
  let propContext = '', ownerContext = '', gmContext = '';
  if (propertyId) {
    const prop = getPropertyList().find(p => p.id === parseInt(propertyId));
    if (prop) {
      const pData = (data.byPeriod[usePeriod] || {})[prop.id] || {};
      const m = pData.manual || {};
      const flow = calcFlow(m);
      propContext = `\n\nPROPERTY FOCUS — ${prop.name} (id ${prop.id}, ${prop.brand}, ${prop.state}, RDO: ${prop.rdo}, RSM: ${prop.rsm}, Owner: ${prop.owner}):\n` +
        `Score ${calcScore(m) ?? 'N/A'}/200 | RevPAR $${m.revpar??'?'} (bud $${m.revparBud??'?'}) | Occ ${m.occ??'?'}% | ADR $${m.adr??'?'} (bud $${m.adrBud??'?'}) | GOP ${m.gop??'?'}% | Flow ${flow!=null?flow.toFixed(0)+'%':'N/A'} | Labor ${m.labor??'?'}% (bud ${m.laborBud??'?'}%)`;
      ownerContext = buildOwnerContext(propertyId, data);
      gmContext = buildGMContext(propertyId, data);
    }
  }

  const companyContext = `\n\n---\nCOMPANY CONTEXT — Superhost Hospitality manages 17 select-service and extended-stay hotels across IL, MI, NC, TX, KY, IN, GA. Brand families: Hilton, Marriott, IHG, Choice. COO: Tim Foley. RDOs: Jennifer Kruk, Mark Gammill. RSMs: Teresa Bitner, Nate Taylor. Owners: Lakhany Group, Capitol One, INDC, Alpental Capital, Gateway, Gulfstream.`;
  const sharedContext = companyContext + snapshot + propContext + ownerContext + gmContext;

  // Run participants SEQUENTIALLY — parallel fan-out blows the org-level
  // 10K input-tokens-per-minute Sonnet rate limit. Lite snapshot keeps each
  // call ~5-7K tokens; serial execution + a small inter-call pause keeps the
  // cumulative pace inside the budget. Tradeoff: ~6-8 sec per persona × N
  // personas. For 7 personas that's ~50 sec total — acceptable for a strategic
  // deliberation that produces the call.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const COUNCIL_PACE_MS = 4000; // pause between persona calls
  const participants = [];
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const persona = getPersonaPrompt(role);
    if (!persona) {
      participants.push({ role, response: '', error: 'persona not found' });
      continue;
    }
    const memContext = buildMemoryContext(role, propertyId);
    const sys = persona + sharedContext + memContext + COUNCIL_PARTICIPANT_INSTRUCTIONS;
    try {
      const text = await callClaude(apiKey, sys, [{ role: 'user', content: question }], 1200);
      participants.push({ role, response: (text || '').trim() });
    } catch (e) {
      participants.push({ role, response: '', error: e.message });
    }
    if (i < roles.length - 1) await sleep(COUNCIL_PACE_MS);
  }
  // Brief pause before the synthesizer call to keep the rate-limit window open.
  await sleep(COUNCIL_PACE_MS);

  // Synthesizer
  const synPersona = getPersonaPrompt(COUNCIL_SYNTHESIZER_ROLE) || '';
  const reports = participants.map(p => {
    const head = `\n\n--- ${friendlyRole(p.role).toUpperCase()} ---`;
    return p.error ? `${head}\n[error: ${p.error}]` : `${head}\n${p.response}`;
  }).join('\n');
  const synSys = synPersona + sharedContext +
    `\n\nQUESTION ON THE TABLE:\n${question}` +
    `\n\nEXECUTIVE RESPONSES:${reports}` +
    COUNCIL_SYNTHESIZER_INSTRUCTIONS;

  let synthesis = { headline: '', consensus: [], tensions: [], actions: [], rawText: '' };
  try {
    const synText = await callClaude(apiKey, synSys, [{ role: 'user', content: 'Synthesize the council\'s deliberation into a leadership recommendation.' }], 1800);
    const { cleanText, parsed } = extractCouncilBlock(synText);
    synthesis = {
      headline: parsed.headline || '',
      consensus: parsed.consensus || [],
      tensions: parsed.tensions || [],
      actions: parsed.actions || [],
      rawText: cleanText
    };
  } catch (e) {
    synthesis.rawText = `Synthesizer failed: ${e.message}`;
  }

  const session = {
    id: newId('council'),
    createdAt: new Date().toISOString(),
    question,
    propertyId: propertyId ? Number(propertyId) : null,
    period: usePeriod,
    roles,
    participants,
    synthesis
  };
  data.councils.unshift(session);
  data.councils = data.councils.slice(0, 50);
  saveData(data);

  res.json({ session });
});

app.get('/api/councils', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const summary = (data.councils || []).map(c => ({
    id: c.id,
    createdAt: c.createdAt,
    question: c.question,
    period: c.period,
    propertyId: c.propertyId,
    roles: c.roles,
    headline: c.synthesis?.headline || '',
    actionCount: (c.synthesis?.actions || []).length,
    participantCount: (c.participants || []).length
  }));
  res.json({ councils: summary });
});

app.get('/api/councils/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const session = (data.councils || []).find(c => c.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Council session not found' });
  res.json({ session });
});

app.delete('/api/councils/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const before = data.councils.length;
  data.councils = data.councils.filter(c => c.id !== req.params.id);
  saveData(data);
  res.json({ removed: before - data.councils.length });
});

// ─── WEEKLY STR COMMENTARY ──────────────────────────────────────────────
// Per-property, per-week entries mirroring the PS template form. Manual entry
// for now — PS holds the form internally and isn't API-exposed.
//
// GET    /api/weekly-str-commentary                  — all properties, latest 8 weeks each
// GET    /api/weekly-str-commentary/:propertyId       — one property, full history
// POST   /api/weekly-str-commentary                  — create entry { propertyId, weekEnding, metrics, commentary }
// PUT    /api/weekly-str-commentary/:id               — update entry (find by id across all properties)
// DELETE /api/weekly-str-commentary/:id               — remove entry

app.get('/api/weekly-str-commentary', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const out = {};
  for (const [pid, entries] of Object.entries(data.weeklyStr || {})) {
    if (!Array.isArray(entries)) continue;
    out[pid] = [...entries]
      .sort((a, b) => (b.weekEnding || '').localeCompare(a.weekEnding || ''))
      .slice(0, 8);
  }
  res.json({ weeklyStr: out });
});

app.get('/api/weekly-str-commentary/:propertyId', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const pid = String(Number(req.params.propertyId));
  const entries = (data.weeklyStr[pid] || []).slice().sort((a, b) =>
    (b.weekEnding || '').localeCompare(a.weekEnding || '')
  );
  res.json({ propertyId: Number(pid), entries });
});

app.post('/api/weekly-str-commentary', checkAuth, (req, res) => {
  const { propertyId, weekEnding, metrics, commentary, enteredBy } = req.body || {};
  if (propertyId == null) return res.status(400).json({ error: 'propertyId required' });
  if (!weekEnding || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnding)) {
    return res.status(400).json({ error: 'weekEnding must be YYYY-MM-DD' });
  }
  const prop = getPropertyList().find(p => p.id === Number(propertyId));
  if (!prop) return res.status(400).json({ error: 'unknown propertyId' });

  const data = ensureShape(loadData());
  const pid = String(Number(propertyId));
  if (!data.weeklyStr[pid]) data.weeklyStr[pid] = [];

  // One entry per property per week-ending — replace if exists
  const now = new Date().toISOString();
  const existingIdx = data.weeklyStr[pid].findIndex(e => e.weekEnding === weekEnding);
  if (existingIdx >= 0) {
    const prev = data.weeklyStr[pid][existingIdx];
    data.weeklyStr[pid][existingIdx] = {
      ...prev,
      metrics: metrics || prev.metrics || {},
      commentary: commentary != null ? String(commentary) : prev.commentary || '',
      enteredBy: enteredBy || prev.enteredBy || null,
      updatedAt: now
    };
    saveData(data);
    return res.json({ entry: data.weeklyStr[pid][existingIdx], replaced: true });
  }

  const entry = {
    id: newId('wstr'),
    propertyId: Number(propertyId),
    weekEnding,
    metrics: metrics || {},
    commentary: commentary || '',
    enteredBy: enteredBy || null,
    enteredAt: now,
    updatedAt: now
  };
  data.weeklyStr[pid].unshift(entry);
  // Cap per-property history at 52 weeks
  data.weeklyStr[pid] = data.weeklyStr[pid].slice(0, 52);
  saveData(data);
  res.json({ entry, replaced: false });
});

app.put('/api/weekly-str-commentary/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const { metrics, commentary, weekEnding, enteredBy } = req.body || {};
  for (const pid of Object.keys(data.weeklyStr)) {
    const idx = (data.weeklyStr[pid] || []).findIndex(e => e.id === req.params.id);
    if (idx >= 0) {
      const prev = data.weeklyStr[pid][idx];
      data.weeklyStr[pid][idx] = {
        ...prev,
        metrics: metrics != null ? metrics : prev.metrics,
        commentary: commentary != null ? String(commentary) : prev.commentary,
        weekEnding: weekEnding || prev.weekEnding,
        enteredBy: enteredBy || prev.enteredBy,
        updatedAt: new Date().toISOString()
      };
      saveData(data);
      return res.json({ entry: data.weeklyStr[pid][idx] });
    }
  }
  res.status(404).json({ error: 'entry not found' });
});

app.delete('/api/weekly-str-commentary/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  for (const pid of Object.keys(data.weeklyStr)) {
    const before = (data.weeklyStr[pid] || []).length;
    data.weeklyStr[pid] = (data.weeklyStr[pid] || []).filter(e => e.id !== req.params.id);
    if (data.weeklyStr[pid].length < before) {
      saveData(data);
      return res.json({ removed: before - data.weeklyStr[pid].length });
    }
  }
  res.status(404).json({ error: 'entry not found' });
});

// ─── CUSTOM PERSONAS — INTAKE FORM ───────────────────────────────────────
// 14 corporate leaders from superhosthospitality.com/leadership get their
// own AI personas built from a 10-section intake form. Form is canonical;
// system prompt is generated on demand.
//
// GET  /api/personas/intake-schema           — return the schema (for the form)
// GET  /api/personas/list                    — list all (with completion + photo)
// GET  /api/personas/intake/:slug            — fetch one persona's intake
// POST /api/personas/intake/:slug            — save (full or partial intake)
// DELETE /api/personas/intake/:slug          — clear one persona's intake
// GET  /api/personas/:slug/prompt            — generated Claude system prompt

const PERSONAS_INTAKE_SCHEMA_PATH = path.join(__dirname, 'superhost-agents', 'personas', 'intake-schema.json');
const TEAM_MANIFEST_PATH = path.join(__dirname, 'public', 'brand', 'team', 'manifest.json');

function loadIntakeSchema() {
  try {
    return JSON.parse(fs.readFileSync(PERSONAS_INTAKE_SCHEMA_PATH, 'utf-8'));
  } catch (e) {
    console.error('[personas] failed to load intake schema:', e.message);
    return { sections: [] };
  }
}

function loadTeamManifest() {
  try {
    return JSON.parse(fs.readFileSync(TEAM_MANIFEST_PATH, 'utf-8'));
  } catch (e) {
    return { leaders: [] };
  }
}

// Compute completion as the % of required fields that have non-empty values.
function intakeCompletion(intake, schema) {
  const i = intake || {};
  let required = 0, filled = 0;
  for (const sec of (schema.sections || [])) {
    const sectionData = i[sec.id] || {};
    for (const f of (sec.fields || [])) {
      const isReq = !!f.required;
      const val = sectionData[f.id];
      const hasVal = val != null && val !== '' && !(Array.isArray(val) && val.length === 0);
      if (isReq) required++;
      if (isReq && hasVal) filled++;
    }
  }
  if (required === 0) {
    // No required fields in schema — count any non-empty values to give a signal
    let any = 0, all = 0;
    for (const sec of (schema.sections || [])) {
      const sectionData = i[sec.id] || {};
      for (const f of (sec.fields || [])) {
        all++;
        const val = sectionData[f.id];
        if (val != null && val !== '' && !(Array.isArray(val) && val.length === 0)) any++;
      }
    }
    return all === 0 ? 0 : Math.round((any / all) * 100);
  }
  return Math.round((filled / required) * 100);
}

// ─── Intake -> system prompt generator ───────────────────────────────────
// Produces a coherent narrative system prompt — NOT a list of fields. The
// shape mirrors how an executive describes themselves: identity first, then
// how they read data, then voice, then constraints. Empty sections are
// omitted so a half-filled intake still produces a usable persona.
function buildPersonaPrompt(persona) {
  if (!persona || !persona.intake) {
    return `You are a Superhost Hospitality leader. The intake form for this persona has not yet been completed — your responses will be generic until the profile is filled out at /persona-intake.html?slug=${persona?.slug || ''}.`;
  }
  const i = persona.intake;
  const id = i.identity || {};
  const auth = i.authority || {};
  const data = i.data || {};
  const own = i.ownership || {};
  const voice = i.voice || {};
  const dec = i.decisions || {};
  const pri = i.priorities || {};
  const samp = i.samples || {};
  const cons = i.constraints || {};
  const pers = i.personal || {};

  const name = id.preferredName || id.fullName || persona.name || 'this leader';
  const title = id.title || persona.title || 'a leader at Superhost';
  const lines = [];

  // ── Identity ────────────────────────────────────────────────────────────
  lines.push(`You are ${id.fullName || persona.name || name}, ${title} at Superhost Hospitality.`);
  if (id.preferredName && id.preferredName !== id.fullName) lines.push(`Most people call you ${id.preferredName}.`);
  if (id.reportsTo) lines.push(`You report to ${id.reportsTo}.`);
  if (id.directReports) lines.push(`Your direct reports: ${id.directReports.replace(/\n/g, '; ')}`);
  const tenureBits = [];
  if (id.yearsInRole) tenureBits.push(`${id.yearsInRole} years in your current role`);
  if (id.yearsAtSuperhost) tenureBits.push(`${id.yearsAtSuperhost} years with Superhost`);
  if (id.yearsInIndustry) tenureBits.push(`${id.yearsInIndustry} years in hospitality`);
  if (tenureBits.length) lines.push(`Tenure: ${tenureBits.join(' / ')}.`);
  if (id.geoScope) lines.push(`Scope: ${id.geoScope}.`);
  if (id.brandFamilies?.length) lines.push(`Brand families you know best: ${id.brandFamilies.join(', ')}.`);
  if (id.credentials) lines.push(`Credentials: ${id.credentials}.`);

  // ── Authority ───────────────────────────────────────────────────────────
  if (auth.primaryDomains?.length || auth.unilateralAuthority || auth.escalationRequired || auth.deferToOthers) {
    lines.push('\n# What you own and what you don\'t');
    if (auth.primaryDomains?.length) lines.push(`Primary domains: ${auth.primaryDomains.join(', ')}.`);
    if (auth.unilateralAuthority) lines.push(`You can decide unilaterally on: ${auth.unilateralAuthority}`);
    if (auth.escalationRequired) lines.push(`Decisions that require Samir / Ash / board sign-off: ${auth.escalationRequired}`);
    if (auth.deferToOthers) lines.push(`You always defer on: ${auth.deferToOthers}`);
    if (auth.vendorRelationships) lines.push(`Vendor / partner relationships you personally manage: ${auth.vendorRelationships}`);
  }

  // ── How you read data ───────────────────────────────────────────────────
  if (data.topMetric1 || data.topMetric2 || data.topMetric3 || data.actionThreshold) {
    lines.push('\n# How you read data');
    const tops = [data.topMetric1, data.topMetric2, data.topMetric3].filter(Boolean);
    if (tops.length) lines.push(`When a report lands on your desk, your eyes go to (in order):\n${tops.map((t,i)=>`  ${i+1}. ${t}`).join('\n')}`);
    if (data.actionThreshold) lines.push(`\nAction thresholds: ${data.actionThreshold}`);
    if (data.analyticalSequence) lines.push(`Analytical sequence: ${data.analyticalSequence}.`);
    if (data.comparisonsRanked?.length) lines.push(`Comparisons that matter most (in order): ${data.comparisonsRanked.join(' > ')}.`);
    if (data.reportPetPeeves) lines.push(`Pet peeves in any report: ${data.reportPetPeeves}`);
    if (data.commonAnalyticalErrors) lines.push(`Common analytical errors you call out: ${data.commonAnalyticalErrors}`);
  }

  // ── Ownership-facing approach ───────────────────────────────────────────
  if (own.reportingCadence || own.formatPreference || own.ownerPushbackResponse) {
    lines.push('\n# How you talk to ownership');
    if (own.reportingCadence) lines.push(`Default reporting cadence: ${own.reportingCadence}.`);
    if (own.formatPreference) lines.push(`Format preference: ${own.formatPreference}.`);
    if (own.detailPreference) lines.push(`Detail level: ${own.detailPreference}.`);
    if (own.badNewsDelivery) lines.push(`Bad-news delivery style: ${own.badNewsDelivery}.`);
    if (own.openingLineDefault) lines.push(`Your default opener for an owner update: "${own.openingLineDefault}"`);
    if (own.ownerPushbackResponse) lines.push(`When an owner pushes back: ${own.ownerPushbackResponse}`);
    if (own.neverInWriting) lines.push(`What you never put in writing to owners: ${own.neverInWriting}`);
    if (own.ownerSpecificStyle) lines.push(`Owner-specific calibration:\n${own.ownerSpecificStyle}`);
  }

  // ── Voice ───────────────────────────────────────────────────────────────
  if (voice.sentenceLength || voice.formality || voice.phrasesYouUse || voice.phrasesYouAvoid) {
    lines.push('\n# Voice — how you sound in writing');
    if (voice.sentenceLength) lines.push(`Sentence length: ${voice.sentenceLength}.`);
    if (voice.formality != null) lines.push(`Formality: ${voice.formality}/10 (1 = casual, 10 = lender-grade formal).`);
    if (voice.jargonLevel) lines.push(`Industry / brand jargon: ${voice.jargonLevel}.`);
    if (voice.humorStyle) lines.push(`Humor: ${voice.humorStyle}.`);
    if (voice.emotionalRegister) lines.push(`Emotional register: ${voice.emotionalRegister}.`);
    if (voice.selfDescription3Words) lines.push(`Three-word self-description: ${voice.selfDescription3Words}.`);
    if (voice.openingClosingStyle) lines.push(`Opening / closing style: ${voice.openingClosingStyle}`);
    if (voice.phrasesYouUse) lines.push(`\nPhrases you use:\n${voice.phrasesYouUse}`);
    if (voice.phrasesYouAvoid) lines.push(`\nPhrases you NEVER use:\n${voice.phrasesYouAvoid}`);
  }

  // ── Decisions ───────────────────────────────────────────────────────────
  if (dec.riskTolerance || dec.decisionSpeed || dec.preDecisionInfo || dec.disagreementStyle || dec.decisionWalkthrough) {
    lines.push('\n# How you decide');
    if (dec.riskTolerance != null) lines.push(`Risk tolerance: ${dec.riskTolerance}/10.`);
    if (dec.decisionSpeed) lines.push(`Decision speed: ${dec.decisionSpeed}.`);
    if (dec.preDecisionInfo) lines.push(`Information you need before deciding: ${dec.preDecisionInfo}`);
    if (dec.disagreementStyle) lines.push(`How you communicate disagreement: ${dec.disagreementStyle}`);
    if (dec.decisionWalkthrough) lines.push(`\nA recent decision in your own words (use this as a model for how you reason):\n${dec.decisionWalkthrough}`);
  }

  // ── Priorities ──────────────────────────────────────────────────────────
  if (pri.priority1 || pri.frustration1 || pri.wouldChange || pri.propertiesExtraAttention) {
    lines.push('\n# Strategic priorities right now');
    const prios = [pri.priority1, pri.priority2, pri.priority3].filter(Boolean);
    if (prios.length) lines.push(`Top priorities:\n${prios.map((p,i)=>`  ${i+1}. ${p}`).join('\n')}`);
    const frus = [pri.frustration1, pri.frustration2, pri.frustration3].filter(Boolean);
    if (frus.length) lines.push(`Top frustrations:\n${frus.map((p,i)=>`  ${i+1}. ${p}`).join('\n')}`);
    if (pri.wouldChange) lines.push(`Things you'd change with a free hand: ${pri.wouldChange}`);
    if (pri.propertiesExtraAttention) lines.push(`Properties getting extra attention: ${pri.propertiesExtraAttention}`);
    if (pri.ownerInsight) lines.push(`Owner-specific insight: ${pri.ownerInsight}`);
  }

  // ── Voice training samples ──────────────────────────────────────────────
  if (samp.diagnosisExample || samp.ownerEmailSample || samp.gmConversationSample || samp.memoOpenerSample) {
    lines.push('\n# Reference samples in your voice');
    lines.push('These are written examples of how you actually sound. Match this register, sentence length, and approach in everything you produce.');
    if (samp.diagnosisExample) lines.push(`\n**Diagnosis walkthrough — sudden 10% RevPAR drop at one property:**\n${samp.diagnosisExample}`);
    if (samp.ownerEmailSample) lines.push(`\n**Owner email reply — owner asks why GOP missed plan:**\n${samp.ownerEmailSample}`);
    if (samp.gmConversationSample) lines.push(`\n**Conversation with a GM — turnover spiked 6 points:**\n${samp.gmConversationSample}`);
    if (samp.memoOpenerSample) lines.push(`\n**Memo opener to leadership:**\n${samp.memoOpenerSample}`);
    if (samp.boardSlideSample) lines.push(`\n**Board / leadership team talking points:**\n${samp.boardSlideSample}`);
  }

  // ── Constraints (the fence — high priority in the prompt) ───────────────
  lines.push('\n# Constraints — what you must NEVER do in this voice');
  if (cons.neverOpine) lines.push(`Topics you never opine on (defer to a real person): ${cons.neverOpine}`);
  if (cons.alwaysEscalate) lines.push(`Topics that always require human escalation: ${cons.alwaysEscalate}`);
  if (cons.confidentialityLines) lines.push(`Confidentiality boundaries: ${cons.confidentialityLines}`);
  if (cons.standardDisclaimers) lines.push(`Standard disclaimers you always include: ${cons.standardDisclaimers}`);
  if (cons.doNotImpersonateScenarios) lines.push(`Scenarios where you must explicitly say "this needs the actual ${name}": ${cons.doNotImpersonateScenarios}`);
  // Always include a default safety line
  lines.push(`\nIf asked anything outside the scope you've defined for yourself above — or anything legally / financially binding — explicitly say so and recommend the user reach the actual ${name} directly.`);

  // ── Personal touches (lighter) ──────────────────────────────────────────
  const personalBits = [];
  if (pers.industryHero) personalBits.push(`Industry hero / mentor: ${pers.industryHero}.`);
  if (pers.bestBook) personalBits.push(`Book you'd hand a new GM: ${pers.bestBook}.`);
  if (pers.mostOverusedWord) personalBits.push(`A word you know you overuse: "${pers.mostOverusedWord}".`);
  if (pers.communicationChannel) personalBits.push(`Preferred channel: ${pers.communicationChannel}.`);
  if (pers.personalNote) personalBits.push(pers.personalNote);
  if (personalBits.length) {
    lines.push('\n# Personal — small things to inform tone');
    lines.push(personalBits.join(' '));
  }

  // ── Operating rules for the persona ─────────────────────────────────────
  lines.push('\n# Operating rules');
  lines.push(`- Always answer in ${name}'s voice — sentence length, vocabulary, register, opening / closing patterns.`);
  lines.push('- When citing portfolio data, prefer the live snapshot below over generic industry knowledge.');
  lines.push('- Numbers before narrative on any owner-facing draft. Bad news first.');
  lines.push(`- If you'd reach for a phrase in the "phrases I avoid" list, rewrite it.`);
  lines.push('- If the question crosses into a constraint above, say so explicitly and route the user to the right person.');

  return lines.join('\n');
}

app.get('/api/personas/intake-schema', checkAuth, (req, res) => {
  res.json(loadIntakeSchema());
});

const INTAKE_EXCLUDE_SLUGS = new Set(['ashraf-ash-lakhany', 'samir-lakhany']);

app.get('/api/personas/list', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const schema = loadIntakeSchema();
  const manifest = loadTeamManifest();
  const list = (manifest.leaders || []).filter(L => !INTAKE_EXCLUDE_SLUGS.has(L.slug)).map(L => {
    const persona = (data.personas || {})[L.slug] || null;
    const pct = persona ? intakeCompletion(persona.intake, schema) : 0;
    return {
      slug: L.slug,
      name: L.name,
      title: L.title,
      photo: L.local_path,
      hasIntake: !!persona,
      completionPct: pct,
      status: persona ? (pct >= 100 ? 'complete' : 'draft') : 'empty',
      updatedAt: persona?.updatedAt || null
    };
  });
  res.json({ personas: list, schemaVersion: schema?.meta?.version || 1, count: list.length });
});

app.get('/api/personas/intake/:slug', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const slug = req.params.slug;
  const persona = (data.personas || {})[slug];
  const schema = loadIntakeSchema();
  // Build a starter shell so the form always has a structure to render against
  const empty = {};
  for (const sec of (schema.sections || [])) {
    empty[sec.id] = {};
    for (const f of (sec.fields || [])) empty[sec.id][f.id] = '';
  }
  // Pre-fill from manifest + corporate contacts when no intake exists yet
  const manifest = loadTeamManifest();
  const m = (manifest.leaders || []).find(L => L.slug === slug);
  const corp = (data.contacts || {}).corporate || {};
  const corpRec = corp[slug] || null;
  if (!persona && m) {
    empty.identity = empty.identity || {};
    if (m.name) empty.identity.fullName = m.name;
    if (m.title) empty.identity.title = m.title;
  }
  res.json({
    slug,
    name: persona?.name || m?.name || slug,
    title: persona?.title || m?.title || '',
    photo: m?.local_path || null,
    contact: corpRec ? { email: corpRec.email, cell: corpRec.cell, department: corpRec.department } : null,
    intake: persona?.intake || empty,
    completionPct: persona ? intakeCompletion(persona.intake, schema) : 0,
    status: persona ? (intakeCompletion(persona.intake, schema) >= 100 ? 'complete' : 'draft') : 'empty',
    updatedAt: persona?.updatedAt || null,
    schemaVersion: schema?.meta?.version || 1
  });
});

app.post('/api/personas/intake/:slug', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const schema = loadIntakeSchema();
  const slug = req.params.slug;
  const manifest = loadTeamManifest();
  const m = (manifest.leaders || []).find(L => L.slug === slug);
  if (!m && !req.body.allowUnlistedSlug) {
    return res.status(404).json({ error: `slug '${slug}' not in /brand/team/manifest.json — pass allowUnlistedSlug:true to override` });
  }
  const incoming = req.body.intake || {};
  // Merge by section: replace each provided section, leave unprovided sections alone
  const existing = (data.personas[slug]?.intake) || {};
  const merged = { ...existing };
  for (const [secId, secData] of Object.entries(incoming)) {
    merged[secId] = { ...(existing[secId] || {}), ...secData };
  }
  const now = new Date().toISOString();
  data.personas[slug] = {
    slug,
    name: m?.name || req.body.name || slug,
    title: m?.title || req.body.title || '',
    photo: m?.local_path || null,
    intake: merged,
    intakeSchemaVersion: schema?.meta?.version || 1,
    completionPct: intakeCompletion(merged, schema),
    updatedAt: now,
    createdAt: data.personas[slug]?.createdAt || now
  };
  saveData(data);
  res.json({ ok: true, persona: data.personas[slug] });
});

app.delete('/api/personas/intake/:slug', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const slug = req.params.slug;
  if (!data.personas[slug]) return res.status(404).json({ error: 'not found' });
  delete data.personas[slug];
  saveData(data);
  res.json({ ok: true });
});

app.get('/api/personas/:slug/prompt', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const slug = req.params.slug;
  const persona = (data.personas || {})[slug];
  if (!persona) return res.status(404).json({ error: 'no persona for slug ' + slug });
  res.json({
    slug,
    name: persona.name,
    title: persona.title,
    completionPct: persona.completionPct,
    prompt: buildPersonaPrompt(persona)
  });
});

// ─── HOTEL CONTACT ROSTER (read-only) ────────────────────────────────────
// Source of truth is the Drive sheet → exported to xlsx → imported via
// tools-import-contacts.py. These endpoints just expose the cached blob.
//
// GET /api/contacts                       — top-level: corporate roster + meta
// GET /api/contacts/property/:id          — one property's full contact record
// GET /api/contacts/corporate             — flat corporate-people array
// GET /api/contacts/lookup/:nameSlug      — find a corporate person by slug
//                                           (slug = lowercase, hyphen-separated)

app.get('/api/contacts', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const c = data.contacts || {};
  res.json({
    meta: c._meta || null,
    propertyCount: Object.keys(c.property || {}).length,
    corporateCount: Object.keys(c.corporate || {}).length,
    unmappedCount: Object.keys(c.unmapped || {}).length
  });
});

app.get('/api/contacts/property/:id', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const c = data.contacts || {};
  const rec = (c.property || {})[String(req.params.id)];
  if (!rec) return res.status(404).json({ error: 'no contact record for property ' + req.params.id });
  // Resolve corporate-support names → corporate roster entries (so the UI can
  // show email/cell next to a name like "Jennifer Kruk" without a second call).
  const corp = c.corporate || {};
  const resolveName = (name) => {
    if (!name) return null;
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return corp[slug] || null;
  };
  const supportResolved = {};
  for (const [role, name] of Object.entries(rec.support || {})) {
    supportResolved[role] = { name: name || null, contact: resolveName(name) };
  }
  // Resolve owner contact name → corporate roster entry (if it happens to match)
  let ownerContactResolved = null;
  if (rec.owner && rec.owner.contact) {
    ownerContactResolved = resolveName(rec.owner.contact);
  }
  res.json({
    propertyId: Number(req.params.id),
    contact: rec,
    supportResolved,
    ownerContactResolved
  });
});

// Bulk: all property contact records in one call (used by /contacts.html
// to render the full grid without 17+ round-trips).
app.get('/api/contacts/all-properties', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const c = data.contacts || {};
  const corp = c.corporate || {};
  const resolveName = (name) => {
    if (!name) return null;
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return corp[slug] || null;
  };
  const list = getPropertyList().map(p => {
    const rec = (c.property || {})[String(p.id)] || null;
    if (!rec) return { propertyId: p.id, name: p.name, brand: p.brand, state: p.state, active: p.active, contact: null };
    const supportResolved = {};
    for (const [role, name] of Object.entries(rec.support || {})) {
      supportResolved[role] = { name: name || null, contact: resolveName(name) };
    }
    const ownerContactResolved = (rec.owner && rec.owner.contact) ? resolveName(rec.owner.contact) : null;
    return {
      propertyId: p.id,
      name: p.name,
      brand: p.brand,
      state: p.state,
      active: p.active,
      contact: rec,
      supportResolved,
      ownerContactResolved
    };
  });
  res.json({ properties: list, count: list.length, meta: c._meta || null });
});

app.get('/api/contacts/corporate', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const corp = (data.contacts || {}).corporate || {};
  // Flat array, sorted by department then name — friendlier for a list UI
  const list = Object.entries(corp).map(([slug, rec]) => ({ slug, ...rec }));
  list.sort((a, b) => (a.department || 'zz').localeCompare(b.department || 'zz')
                     || (a.name || '').localeCompare(b.name || ''));
  res.json({ contacts: list, count: list.length });
});

app.get('/api/contacts/lookup/:nameSlug', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const corp = (data.contacts || {}).corporate || {};
  const rec = corp[req.params.nameSlug];
  if (!rec) return res.status(404).json({ error: 'no corporate contact for slug ' + req.params.nameSlug });
  res.json({ slug: req.params.nameSlug, contact: rec });
});

// Promote a council action to cockpit
app.post('/api/councils/:id/promote', checkAuth, (req, res) => {
  const data = ensureShape(loadData());
  const session = (data.councils || []).find(c => c.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Council session not found' });
  const { kind, actionIndex, owner, dueDate, propertyId } = req.body || {};
  if (!['decision','action'].includes(kind)) return res.status(400).json({ error: 'kind must be "decision" or "action"' });
  const a = session.synthesis.actions?.[actionIndex];
  if (!a) return res.status(400).json({ error: 'action not found' });

  const now = new Date().toISOString();
  const finalOwner = owner || a.owner || null;
  const finalDate  = dueDate || a.dueDate || null;
  const finalProp  = propertyId != null ? Number(propertyId) : (a.propertyId != null ? Number(a.propertyId) : session.propertyId || null);

  if (kind === 'decision') {
    const item = {
      id: newId('dec'), title: a.title,
      rationale: `Promoted from council session ${session.id}: "${session.question}"`,
      recommendedOwner: finalOwner, decidedBy: null,
      dueDate: finalDate, propertyId: finalProp,
      proposedBy: `council:${session.id}`,
      status: 'proposed', createdAt: now, updatedAt: now
    };
    data.decisions.unshift(item);
    saveData(data);
    return res.json({ decision: item });
  } else {
    const item = {
      id: newId('act'), title: a.title,
      owner: finalOwner, dueDate: finalDate, propertyId: finalProp,
      createdBy: `council:${session.id}`,
      status: 'open', createdAt: now, updatedAt: now,
      notes: [`From council: "${session.question}"`]
    };
    data.actions.unshift(item);
    saveData(data);
    return res.json({ action: item });
  }
});

// ── AUTO-REFRESH ────────────────────────────────────────────────────────────
// Daily schedule, anchored at 6:30 AM local time, every 4 hours after that:
//   06:30, 10:30, 14:30, 18:30, 22:30, 02:30 (next day)
const REFRESH_HOURS  = [2, 6, 10, 14, 18, 22];
const REFRESH_MINUTE = 30;

function nextRefreshAt(from = new Date()) {
  // Build candidate Date objects for each hour in the schedule (today + tomorrow)
  // and return the earliest that is strictly in the future.
  const candidates = [];
  for (const offsetDays of [0, 1]) {
    for (const h of REFRESH_HOURS) {
      const d = new Date(from);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(h, REFRESH_MINUTE, 0, 0);
      if (d > from) candidates.push(d);
    }
  }
  candidates.sort((a, b) => a - b);
  return candidates[0];
}

async function autoRefresh() {
  const config = loadConfig();
  if (!config.profitsword.username || !config.profitsword.password) {
    console.log(`[Auto-Refresh ${new Date().toLocaleString()}] Skipped — no ProfitSword credentials configured`);
    return;
  }
  // Always derive period from the actual calendar — never trust config.activePeriod.
  // Historical bug: hardcoded "2026-04" in config caused April-only refreshes well into May.
  const today = new Date();
  const period = currentPeriod();
  const periods = [period];
  // Prior-month catch-up: during the first 5 days of a new month, also refresh the
  // prior month so late-posting PS entries (commissions, F&B, expenses) update too.
  // Without this, the prior month's books are frozen on day 1 even though PS keeps writing.
  if (today.getDate() <= 5) {
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    periods.unshift(prevPeriod); // prior first, current last (so current is the latest write)
  }
  for (const p of periods) {
    console.log(`[Auto-Refresh ${new Date().toLocaleString()}] Starting refresh for ${p}…`);
    try {
      const result = await refreshAllProperties(p);
      console.log(`[Auto-Refresh] ${p} done — ${result.success.length} OK, ${result.failed.length} failed`);
      if (result.failed.length) console.log(`[Auto-Refresh] ${p} failed:`, result.failed.map(f => f.name).join(', '));
    } catch (e) {
      console.log(`[Auto-Refresh] ${p} error:`, e.message);
    }
  }
}

function scheduleNextRefresh() {
  const next = nextRefreshAt();
  const delay = next - new Date();
  const hrs = Math.floor(delay / 3600000);
  const mins = Math.floor((delay % 3600000) / 60000);
  // Spell out target period in the log so any future stale-period regression is obvious.
  const today = new Date();
  const periodPlan = today.getDate() <= 5
    ? `${currentPeriod()} (+ prior month — first 5 days catch-up)`
    : currentPeriod();
  console.log(`[Auto-Refresh] Next run scheduled for ${next.toLocaleString()} (in ${hrs}h ${mins}m). Will pull: ${periodPlan}`);
  setTimeout(async () => {
    await autoRefresh();
    scheduleNextRefresh();
  }, delay);
}

// Bind 127.0.0.1 by default — only expose the hub on every interface when
// HUB_BIND_ALL=1 is explicitly set. Prevents accidental network exposure on
// dev machines where the hub serves owner data over Wi-Fi.
const BIND_HOST = process.env.HUB_BIND_ALL === '1' ? '0.0.0.0' : '127.0.0.1';
const httpServer = app.listen(PORT, BIND_HOST, () => {
  console.log(`\n🏨  Superhost Executive Hub v3.0  →  http://localhost:${PORT}  (bound ${BIND_HOST})`);
  console.log(`   AI:   ${process.env.ANTHROPIC_API_KEY?'✓ Claude key loaded from .env':'Enter Claude API key in Admin  (console.anthropic.com)'}`);
  console.log(`   Auth: ${process.env.HUB_PIN?'✓ PIN required':'open (set HUB_PIN in .env to enable)'}`);
  const slotList = REFRESH_HOURS.slice().sort((a,b)=>a-b).map(h => `${String(h).padStart(2,'0')}:${String(REFRESH_MINUTE).padStart(2,'0')}`).join(', ');
  console.log(`   Auto: Daily refresh at ${slotList} (every 4h from 06:30, local time)\n`);
  scheduleNextRefresh();
});

// EADDRINUSE handling — log clearly and exit so the wrapper's port-check is
// reinforced by a backup at the application layer. Without this, a second
// process firing during the wrapper's race window crashes silently.
httpServer.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} already in use — another hub instance is running. Exiting.`);
  } else {
    console.error('[FATAL] HTTP server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown — drain in-flight saves before exiting so the atomic write
// queue completes. Handles SIGTERM (Task Scheduler stop), SIGINT (Ctrl+C).
async function shutdown(signal) {
  console.log(`\n[shutdown] Received ${signal} — draining writes…`);
  try {
    await _dataWriteQueue;       // wait for any pending data.json writes
    httpServer.close();
    console.log('[shutdown] Clean exit.');
    process.exit(0);
  } catch (e) {
    console.error('[shutdown] Drain failed:', e);
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Last-resort handlers — log and survive instead of silently crashing on async
// errors that escape try/catch.
process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', err => {
  console.error('[unhandledRejection]', err);
});
