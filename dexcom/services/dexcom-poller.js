/**
 * Dexcom Share API Poller
 *
 * Polls the Dexcom Share API every 5 minutes, auto-refreshes the session token
 * when it expires, and writes each new reading to the glucose_readings table.
 * On startup, backfills up to DEXCOM_HISTORY_MONTHS (default 6) of history
 * using 30-day chunks to work around the Dexcom Share API's per-call window limit.
 *
 * Env vars required (see .env.example):
 *   DEXCOM_USERNAME, DEXCOM_PASSWORD, DEXCOM_SERVER (us | ous), DATABASE_URL,
 *   DEXCOM_HISTORY_MONTHS (optional, default 6, max 6)
 *
 * Never crashes on transient API errors — logs and retries next interval.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fetch  = require('node-fetch');
const { Pool } = require('pg');

// ─── Constants ─────────────────────────────────────────────────────────────────

const SERVERS = {
  us:  'https://share2.dexcom.com',
  ous: 'https://shareous1.dexcom.com',
};

// Official Dexcom Share application ID (public, same across all Share clients)
const APP_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';

const BASE_URL        = SERVERS[(process.env.DEXCOM_SERVER || 'us').toLowerCase()] || SERVERS.us;
const USERNAME        = process.env.DEXCOM_USERNAME;
const PASSWORD        = process.env.DEXCOM_PASSWORD;
const POLL_INTERVAL    = 5 * 60 * 1000;  // 5 minutes
// Dexcom Share API max window per call: 1440 minutes / 288 readings (24 h).
// For deeper history we use cumulative calls — each call asks for "everything up
// to N days back" and we slice off the part we already processed in the prior call.
const HISTORY_MONTHS   = Math.min(parseInt(process.env.DEXCOM_HISTORY_MONTHS) || 6, 6);
const READINGS_PER_DAY = 288; // one reading every 5 minutes

const TREND_ARROW_MAP = {
  None:           '?',
  DoubleUp:       '↑↑',
  SingleUp:       '↑',
  FortyFiveUp:    '↗',
  Flat:           '→',
  FortyFiveDown:  '↘',
  SingleDown:     '↓',
  DoubleDown:     '↓↓',
  NotComputable:  '?',
  RateOutOfRange: '⚠',
};

// Numeric index → trend name (Dexcom sometimes returns an integer)
const TREND_NAMES = [
  'None', 'DoubleUp', 'SingleUp', 'FortyFiveUp', 'Flat',
  'FortyFiveDown', 'SingleDown', 'DoubleDown', 'NotComputable', 'RateOutOfRange',
];

// ─── State ─────────────────────────────────────────────────────────────────────

let accountId = null;
let sessionId = null;

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── DB setup ──────────────────────────────────────────────────────────────────

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS glucose_readings (
      id           SERIAL      PRIMARY KEY,
      timestamp    TIMESTAMPTZ NOT NULL UNIQUE,
      value        INTEGER     NOT NULL,
      trend        TEXT,
      trend_arrow  TEXT,
      raw_payload  JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_glucose_ts ON glucose_readings (timestamp DESC)`
  );
  console.log('[dexcom-poller] glucose_readings table ready');
}

// ─── Dexcom auth ───────────────────────────────────────────────────────────────

async function fetchAccountId() {
  const res = await fetch(
    `${BASE_URL}/ShareWebServices/Services/General/AuthenticatePublisherAccount`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ accountName: USERNAME, password: PASSWORD, applicationId: APP_ID }),
    }
  );
  if (!res.ok) throw new Error(`AuthenticatePublisherAccount ${res.status}: ${await res.text()}`);
  const id = await res.json();
  if (!id || id === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Invalid Dexcom credentials — check DEXCOM_USERNAME / DEXCOM_PASSWORD');
  }
  return id;
}

async function fetchSessionId(acctId) {
  const res = await fetch(
    `${BASE_URL}/ShareWebServices/Services/General/LoginPublisherAccountById`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ accountId: acctId, password: PASSWORD, applicationId: APP_ID }),
    }
  );
  if (!res.ok) throw new Error(`LoginPublisherAccountById ${res.status}: ${await res.text()}`);
  const sid = await res.json();
  if (!sid || sid === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Session ID invalid — credentials rejected');
  }
  return sid;
}

async function authenticate() {
  console.log('[dexcom-poller] Authenticating with Dexcom Share…');
  accountId = await fetchAccountId();
  sessionId = await fetchSessionId(accountId);
  console.log('[dexcom-poller] Session acquired');
}

// ─── Reading fetch ─────────────────────────────────────────────────────────────

function parseWt(wt) {
  // Dexcom returns "Date(1234567890000)" or "Date(1234567890000+0000)"
  const ms = parseInt(String(wt).replace(/Date\((\d+)[^)]*\)/, '$1'), 10);
  return new Date(ms);
}

function normalizeTrend(raw) {
  if (typeof raw === 'number') return TREND_NAMES[raw] || 'Unknown';
  return raw || 'Unknown';
}

/**
 * Fetch up to `maxCount` readings from the last `minutes` minutes.
 * Returns them newest-first (Dexcom's natural order).
 */
async function fetchReadings(maxCount, minutes = 1440) {
  const url =
    `${BASE_URL}/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues` +
    `?sessionId=${sessionId}&minutes=${minutes}&maxCount=${maxCount}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (res.status === 500) {
    const body = await res.text();
    if (body.includes('SessionNotValid') || body.includes('SessionIdNotFound')) {
      const err = new Error('SESSION_EXPIRED');
      err.sessionExpired = true;
      throw err;
    }
    throw new Error(`Dexcom API 500: ${body}`);
  }

  if (!res.ok) throw new Error(`ReadPublisherLatestGlucoseValues ${res.status}`);

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchLatestReading() {
  const readings = await fetchReadings(1);
  return readings[0] ?? null;
}

// ─── Persist ───────────────────────────────────────────────────────────────────

async function persistReading(raw) {
  const ts    = parseWt(raw.WT);
  const trend = normalizeTrend(raw.Trend);
  const arrow = TREND_ARROW_MAP[trend] || '?';

  const { rows } = await db.query(
    `INSERT INTO glucose_readings (timestamp, value, trend, trend_arrow, raw_payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (timestamp) DO NOTHING
     RETURNING *`,
    [ts, raw.Value, trend, arrow, raw]
  );
  return rows[0] || null; // null → duplicate, already stored
}

// ─── History backfill ──────────────────────────────────────────────────────────

/**
 * On startup, backfill up to DEXCOM_HISTORY_MONTHS (default 6) of readings.
 *
 * The Dexcom Share API has no date-range parameter — it only exposes
 * "the last N readings within the last M minutes."  To reach data older than
 * 24 h we must expand both maxCount and minutes cumulatively.  We do this in
 * 30-day chunks:
 *
 *   Chunk 1: ask for everything in the last 30 days  (43 200 min / 8 640 readings)
 *   Chunk 2: ask for everything in the last 60 days  (86 400 min / 17 280 readings)
 *   …
 *   Chunk 6: ask for everything in the last 180 days (259 200 min / 51 840 readings)
 *
 * Between calls the response array grows cumulatively.  We only process the
 * *new* tail (readings beyond what we already saw in the previous call) so each
 * reading is inserted exactly once.  ON CONFLICT DO NOTHING makes re-runs safe.
 *
 * A 2-second pause between chunks keeps us polite toward the Dexcom servers.
 */
async function backfillHistory() {
  const CHUNK_DAYS = 30;
  const totalDays  = HISTORY_MONTHS * 30;
  const totalChunks = Math.ceil(totalDays / CHUNK_DAYS);

  console.log(
    `[dexcom-poller] Backfilling last ${HISTORY_MONTHS} month(s) ` +
    `(~${totalDays} days) in ${totalChunks} chunk(s)…`
  );

  let totalSaved = 0;
  let prevLength = 0; // how many readings the previous chunk call returned

  for (let chunk = 1; chunk <= totalChunks; chunk++) {
    const daysBack = chunk * CHUNK_DAYS;
    const minutes  = daysBack * 24 * 60;
    const maxCount = daysBack * READINGS_PER_DAY;

    let readings;
    try {
      readings = await fetchReadings(maxCount, minutes);
    } catch (err) {
      if (err.sessionExpired) {
        console.warn('[dexcom-poller] Session expired during backfill — re-authenticating…');
        await authenticate();
        readings = await fetchReadings(maxCount, minutes);
      } else {
        console.error(`[dexcom-poller] Backfill chunk ${chunk} error:`, err.message);
        break;
      }
    }

    // The API returns newest-first.  Slice off the portion we already processed
    // (the "front" of the array) to get only the newly-reached older readings.
    const newSlice = readings.slice(prevLength);

    if (!newSlice.length) {
      console.log(`[dexcom-poller] No more data at ~${daysBack} days — backfill done early`);
      break;
    }

    // Insert oldest-first (reverse the newest-first slice)
    for (const raw of [...newSlice].reverse()) {
      const row = await persistReading(raw);
      if (row) totalSaved++;
    }

    console.log(
      `[dexcom-poller] Chunk ${chunk}/${totalChunks} (~${daysBack} days): ` +
      `${newSlice.length} fetched, ${totalSaved} total saved`
    );

    prevLength = readings.length;

    // Stop early if the API returned fewer readings than the chunk window could hold
    // (means we've hit the beginning of available data)
    if (newSlice.length < CHUNK_DAYS * READINGS_PER_DAY * 0.1) {
      console.log('[dexcom-poller] Sparse results — likely reached start of available data');
      break;
    }

    if (chunk < totalChunks) {
      await new Promise(r => setTimeout(r, 2000)); // polite pause between chunks
    }
  }

  console.log(`[dexcom-poller] Backfill complete: ${totalSaved} new readings saved`);
}

// ─── Poll ──────────────────────────────────────────────────────────────────────

async function poll() {
  try {
    const raw = await fetchLatestReading();
    if (!raw) {
      console.log('[dexcom-poller] No reading returned');
      return;
    }

    const saved = await persistReading(raw);
    if (saved) {
      console.log(
        `[dexcom-poller] Saved: ${saved.value} mg/dL  ${saved.trend_arrow}  ` +
        `${new Date(saved.timestamp).toISOString()}`
      );
    } else {
      console.log('[dexcom-poller] Duplicate reading — skipped');
    }
  } catch (err) {
    if (err.sessionExpired) {
      console.warn('[dexcom-poller] Session expired — re-authenticating…');
      try {
        await authenticate();
        await poll(); // retry immediately after re-auth
      } catch (authErr) {
        console.error('[dexcom-poller] Re-auth failed:', authErr.message);
      }
    } else {
      // Log and continue — never crash on transient errors
      console.error('[dexcom-poller] Poll error:', err.message);
    }
  }
}

// ─── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  if (!USERNAME || !PASSWORD) {
    console.error('[dexcom-poller] FATAL: DEXCOM_USERNAME and DEXCOM_PASSWORD must be set');
    process.exit(1);
  }

  await ensureTable();
  await authenticate();
  await backfillHistory();             // one-time catch-up on startup
  await poll();                        // then fetch the very latest
  setInterval(poll, POLL_INTERVAL);
  console.log(`[dexcom-poller] Polling every ${POLL_INTERVAL / 60_000} minutes`);
}

start().catch(err => {
  console.error('[dexcom-poller] Fatal startup error:', err.message);
  process.exit(1);
});
