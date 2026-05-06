/**
 * Dexcom Glucose API Server
 *
 * REST endpoints + SSE real-time stream for glucose readings.
 * Polls the DB every 10 s to detect new readings written by dexcom-poller,
 * then pushes them to all connected SSE clients and runs alert checks.
 *
 * Endpoints:
 *   GET /api/glucose/latest
 *   GET /api/glucose/history?hours=24
 *   GET /api/glucose/stats?hours=24
 *   GET /api/glucose/stream          ← SSE
 *
 * Env vars: DATABASE_URL, PORT_DEXCOM, CORS_ORIGINS
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const alerts  = require('./services/alert-manager');

// ─── Setup ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : '*',
}));

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── DB helpers ────────────────────────────────────────────────────────────────

async function queryLatest(limit = 1) {
  const { rows } = await db.query(
    `SELECT id, timestamp, value, trend,
            trend_arrow  AS "trendArrow",
            created_at   AS "createdAt"
     FROM   glucose_readings
     ORDER  BY timestamp DESC
     LIMIT  $1`,
    [limit]
  );
  return rows;
}

async function queryHistory(hours) {
  const { rows } = await db.query(
    `SELECT id, timestamp, value, trend, trend_arrow AS "trendArrow"
     FROM   glucose_readings
     WHERE  timestamp >= NOW() - ($1 || ' hours')::interval
     ORDER  BY timestamp ASC`,
    [hours]
  );
  return rows;
}

async function queryStats(hours) {
  const { rows } = await db.query(
    `SELECT
       ROUND(AVG(value))::int  AS avg,
       MIN(value)              AS min,
       MAX(value)              AS max,
       COUNT(*)::int           AS readings,
       ROUND(
         100.0 * SUM(CASE WHEN value BETWEEN 70 AND 180 THEN 1 ELSE 0 END)
               / NULLIF(COUNT(*), 0)
       )::int                  AS "timeInRangePct"
     FROM glucose_readings
     WHERE timestamp >= NOW() - ($1 || ' hours')::interval`,
    [hours]
  );
  return rows[0];
}

function isStale(timestamp, maxMinutes = 12) {
  if (!timestamp) return true;
  return (Date.now() - new Date(timestamp).getTime()) > maxMinutes * 60_000;
}

// ─── REST endpoints ────────────────────────────────────────────────────────────

app.get('/api/glucose/latest', async (req, res) => {
  try {
    const [reading] = await queryLatest(1);
    if (!reading) return res.json({ reading: null, isStale: true });
    res.json({ reading, isStale: isStale(reading.timestamp) });
  } catch (err) {
    console.error('[dexcom-server] /latest:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/glucose/history', async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 168);
    const readings = await queryHistory(hours);
    res.json({ readings, hours });
  } catch (err) {
    console.error('[dexcom-server] /history:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/glucose/stats', async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 168);
    const stats = await queryStats(hours);
    res.json({ stats, hours });
  } catch (err) {
    console.error('[dexcom-server] /stats:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── SSE stream ────────────────────────────────────────────────────────────────

const sseClients = new Set();

app.get('/api/glucose/stream', async (req, res) => {
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',   // disable Nginx response buffering
  });
  res.flushHeaders();

  // Send the latest reading immediately so the client doesn't wait up to 10 s
  try {
    const [reading] = await queryLatest(1);
    if (reading) {
      res.write(sseMsg({ type: 'reading', reading, isStale: isStale(reading.timestamp) }));
    }
  } catch (_) { /* non-fatal */ }

  // Heartbeat every 25 s — keeps the connection alive through proxies
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);

  sseClients.add(res);
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

function sseMsg(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function broadcast(payload) {
  const msg = sseMsg(payload);
  for (const client of sseClients) {
    try { client.write(msg); } catch (_) { sseClients.delete(client); }
  }
}

// ─── DB polling loop (detects new readings from dexcom-poller) ─────────────────

let lastSeenId = null;

async function initLastSeen() {
  try {
    const [r] = await queryLatest(1);
    lastSeenId = r?.id ?? null;
    if (r) console.log(`[dexcom-server] Last known reading: ${r.value} mg/dL @ ${r.timestamp}`);
    else    console.log('[dexcom-server] No readings in DB yet');
  } catch (err) {
    console.error('[dexcom-server] initLastSeen error:', err.message);
  }
}

async function checkForNewReadings() {
  try {
    const { rows } = await db.query(
      `SELECT id, timestamp, value, trend, trend_arrow AS "trendArrow", created_at AS "createdAt"
       FROM   glucose_readings
       WHERE  id > $1
       ORDER  BY id ASC`,
      [lastSeenId ?? 0]
    );

    for (const reading of rows) {
      lastSeenId = reading.id;
      console.log(`[dexcom-server] New reading detected: ${reading.value} mg/dL ${reading.trendArrow}`);

      // Push to all SSE clients
      broadcast({ type: 'reading', reading, isStale: false });

      // Check alert thresholds
      alerts.check(reading);
    }
  } catch (err) {
    console.error('[dexcom-server] checkForNewReadings error:', err.message);
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT_DEXCOM) || 3008;

app.listen(PORT, async () => {
  console.log(`[dexcom-server] Listening on :${PORT}`);
  await initLastSeen();
  setInterval(checkForNewReadings, 10_000); // poll DB every 10 s
});
