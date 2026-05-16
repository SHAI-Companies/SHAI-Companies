/*
 * M3 Connector — placeholder module.
 *
 * Status: NOT YET CONNECTED. M3 API access has not been provisioned for this tenant.
 * Tier 2 (Balance Sheet) and Tier 3 (General Ledger) integrations land here once enabled.
 *
 * What's needed to enable:
 *   1. M3 API access provisioned by the M3 customer success team (paid add-on at most tiers)
 *   2. M3 tenant URL (typically https://<tenant>.m3as.com)
 *   3. API credentials (OAuth client_id/client_secret OR API key)
 *   4. Property mapping: M3 entity IDs → SHAI property IDs (one-time config in tagMap-style structure)
 *
 * Once those land, fill in the functions below — getBalanceSheet, getTrialBalance, getJournalEntries.
 * The endpoints in server.js (/api/m3/*) call these. Until enabled, they return 501 Not Implemented
 * and the dashboard falls back to manual-entry data.
 *
 * See docs/INTEGRATION_REQUESTS.md for the M3 ask format.
 */

const config = {
  // Loaded from config.json at runtime — see m3Config()
};

function m3Config() {
  // Centralized config loader so callers don't have to know where M3 creds live
  const cfg = require('../../config.json');
  return cfg.m3 || { enabled: false };
}

function isEnabled() {
  const c = m3Config();
  return !!(c.enabled && c.baseUrl && (c.apiKey || (c.clientId && c.clientSecret)));
}

/**
 * Fetch a property's balance sheet for a given period from M3.
 * @param {string} m3PropId — M3 entity ID (mapped from SHAI property ID via config.m3.tagMap)
 * @param {string} period — YYYY-MM (point-in-time at end of period)
 * @returns {Promise<object>} Balance sheet line items keyed by USGL category, OR null if not enabled
 */
async function getBalanceSheet(/* m3PropId, period */) {
  if (!isEnabled()) return null;
  // TODO: call M3 endpoint. Likely something like:
  //   POST {baseUrl}/api/v3/reports/balanceSheet
  //   Body: { entityId: m3PropId, asOfDate: period+'-LAST_DAY_OF_MONTH' }
  //   Auth: Bearer token (refresh via /oauth/token)
  // Returns: structured BS object matching our internal schema (see SCHEMA constant below)
  throw new Error('M3 connector not implemented — provision M3 API access first');
}

/**
 * Fetch a property's trial balance for a given period.
 * Used for full GL reconciliation — Tier 3.
 */
async function getTrialBalance(/* m3PropId, period */) {
  if (!isEnabled()) return null;
  throw new Error('M3 connector not implemented');
}

/**
 * Fetch journal entries for a property and date range.
 * Used for Tier 3 (General Ledger detail view).
 */
async function getJournalEntries(/* m3PropId, fromDate, toDate */) {
  if (!isEnabled()) return null;
  throw new Error('M3 connector not implemented');
}

/**
 * Test connectivity. Returns { ok, message, latencyMs } or { ok:false, error }.
 */
async function testConnection() {
  const c = m3Config();
  if (!c.enabled) return { ok: false, error: 'M3 disabled in config' };
  if (!c.baseUrl) return { ok: false, error: 'M3 baseUrl not set' };
  if (!c.apiKey && !(c.clientId && c.clientSecret)) return { ok: false, error: 'M3 credentials not set' };
  // TODO: call a lightweight M3 endpoint (e.g. /api/health or /api/me) and report status
  return { ok: false, error: 'M3 connector not implemented — placeholder only' };
}

// USGL Balance Sheet schema — what getBalanceSheet should return once implemented.
// Manual entry conforms to this same shape so the renderer doesn't care about source.
const SCHEMA = {
  asOfDate: 'YYYY-MM-DD',
  source: 'm3 | manual',
  // ASSETS — Current
  cash: 0,
  ar: 0,                  // Trade accounts receivable
  prepaid: 0,
  inventory: 0,
  otherCurrentAssets: 0,
  // ASSETS — Property & Equipment
  land: 0,
  building: 0,
  ffe: 0,                 // Furniture, Fixtures & Equipment
  accumDepreciation: 0,   // negative number expected (contra-asset)
  // ASSETS — Other
  intangibles: 0,
  deposits: 0,
  otherAssets: 0,
  // LIABILITIES — Current
  ap: 0,                  // Trade accounts payable
  accruedWages: 0,
  accruedExpenses: 0,
  currentLTD: 0,          // Current portion of long-term debt
  otherCurrentLiab: 0,
  // LIABILITIES — Long-Term
  longTermDebt: 0,
  deferredTax: 0,
  otherLTL: 0,
  // EQUITY
  ownerCapital: 0,
  retainedEarnings: 0,
  currentYearIncome: 0
};

module.exports = {
  isEnabled,
  testConnection,
  getBalanceSheet,
  getTrialBalance,
  getJournalEntries,
  SCHEMA
};
