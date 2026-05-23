/**
 * Dexcom Glucose API Server
 *
 * REST endpoints + SSE real-time stream for glucose readings.
 * Polls the DB every 10 s to detect new readings written by dexcom-poller,
 * then pushes them to all connected SSE clients and runs alert checks.
 *
 * Endpoints:
 *   GET  /api/glucose/latest
 *   GET  /api/glucose/history?hours=24
 *   GET  /api/glucose/stats?hours=24
 *   GET  /api/glucose/stream          ← SSE
 *   GET  /api/glucose/rules
 *   PUT  /api/glucose/rules/:id
 *   POST /api/glucose/rules/:id/test
 *
 * Env vars: DATABASE_URL, PORT_DEXCOM, CORS_ORIGINS,
 *           WAHA_URL, WAHA_KEY, WAHA_GROUP_ID
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const alerts  = require('./services/alert-manager');

// ─── Setup ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : '*',
}));

const db = new Pool({ connectionString: process.env.DATABASE_URL });
alerts.init(db);

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
       )::int                  AS "timeInRangePct",
       ROUND(
         100.0 * SUM(CASE WHEN value < 70 THEN 1 ELSE 0 END)
               / NULLIF(COUNT(*), 0)
       )::int                  AS "lowPct",
       ROUND(
         100.0 * SUM(CASE WHEN value > 180 THEN 1 ELSE 0 END)
               / NULLIF(COUNT(*), 0)
       )::int                  AS "highPct"
     FROM glucose_readings
     WHERE timestamp >= NOW() - ($1 || ' hours')::interval`,
    [hours]
  );
  return rows[0];
}

function isStale(timestamp, maxMinutes = 10) {
  if (!timestamp) return true;
  return (Date.now() - new Date(timestamp).getTime()) > maxMinutes * 60_000;
}

// ─── Glucose REST endpoints ────────────────────────────────────────────────────

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

// ─── Alert rules endpoints ─────────────────────────────────────────────────────

app.get('/api/glucose/rules', async (req, res) => {
  try {
    const rules = await alerts.getRules();
    res.json({ rules });
  } catch (err) {
    console.error('[dexcom-server] GET /rules:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/glucose/rules/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { threshold, duration_minutes, cooldown_minutes, enabled } = req.body;
    const patch = {};
    if (threshold           !== undefined) patch.threshold           = parseInt(threshold);
    if (duration_minutes    !== undefined) patch.duration_minutes    = parseInt(duration_minutes);
    if (cooldown_minutes    !== undefined) patch.cooldown_minutes    = parseInt(cooldown_minutes);
    if (enabled             !== undefined) patch.enabled             = Boolean(enabled);
    const rule = await alerts.updateRule(id, patch);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule });
  } catch (err) {
    console.error('[dexcom-server] PUT /rules/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/glucose/rules/:id/test', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Use the latest real reading so the test message shows an actual value
    const [reading] = await queryLatest(1);
    if (!reading) return res.status(400).json({ error: 'No readings available for test' });
    await alerts.testRule(id, reading);
    res.json({ ok: true, message: 'Test notification sent' });
  } catch (err) {
    console.error('[dexcom-server] POST /rules/:id/test:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Food vision — analyse dish photo and estimate carbs ──────────────────────

app.post('/api/glucose/vision', async (req, res) => {
  const { image, mimeType = 'image/jpeg' } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image (base64) required' });

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROK_API_KEY not configured' });

  const dataUrl = `data:${mimeType};base64,${image}`;

  try {
    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-4-fast-non-reasoning',
        messages: [
          {
            role: 'system',
            content: `אתה מומחה תזונה מיומן בניהול סוכרת סוג 1.
נתח תמונת מנה והחזר JSON בלבד (ללא markdown, ללא טקסט נוסף) בפורמט הזה:
{"foods":["שם מזון"],"carbs":NUMBER,"confidence":"high|medium|low","note":"הערה אופציונלית"}
- foods: רשימת רכיבי המנה בעברית
- carbs: סך הפחמימות בגרמים לכל המנה (מספר שלם)
- confidence: high=ניתן לזהות בבירור, medium=הערכה סבירה, low=קשה לזהות
- note: הערה קצרה אם יש אי-ודאות גבוהה (אופציונלי, השמט אם אין)`,
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: 'אמוד את כמות הפחמימות במנה זו.' },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!grokRes.ok) {
      const detail = await grokRes.text();
      console.error('[dexcom-server] Vision API error:', grokRes.status, detail);
      return res.status(502).json({ error: 'Vision API error', status: grokRes.status });
    }

    const data = await grokRes.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() || '{}';

    // Strip markdown code fences if present
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      console.error('[dexcom-server] Vision JSON parse error, raw:', raw);
      parsed = { foods: [], carbs: 0, confidence: 'low', note: 'לא הצלחתי לנתח את התמונה' };
    }

    res.json({
      foods:      Array.isArray(parsed.foods) ? parsed.foods : [],
      carbs:      typeof parsed.carbs === 'number' ? Math.round(parsed.carbs) : 0,
      confidence: parsed.confidence || 'medium',
      note:       parsed.note || null,
    });
  } catch (err) {
    console.error('[dexcom-server] /vision error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Debi AI chat (Grok) ──────────────────────────────────────────────────────

app.post('/api/glucose/chat', async (req, res) => {
  const { message, context, history = [] } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message required' });
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROK_API_KEY not configured on server' });
  }

  // Build patient-context block from live data sent by the frontend
  const ctxLines = [];
  if (context?.glucose)    ctxLines.push(`סוכר נוכחי: ${context.glucose} mg/dL`);
  if (context?.icr)        ctxLines.push(`יחס אינסולין-פחמימות (ICR): 1:${context.icr} — יחידה אחת לכל ${context.icr}ג׳ פחמימות`);
  if (context?.isf)        ctxLines.push(`רגישות לאינסולין (ISF): יחידה מורידה ${context.isf} mg/dL`);
  if (context?.tregludec)  ctxLines.push(`טרגלודק: ${context.tregludec} יח׳ ביום`);
  const patientBlock = ctxLines.length
    ? `\n\nנתוני תהל ברגע זה:\n${ctxLines.join('\n')}\n\nהשתמשי בנתונים אלה לחישובים מדויקים.`
    : '';

  // Sanitise conversation history — keep last 10 turns, only user/assistant roles
  const priorTurns = Array.isArray(history)
    ? history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-10)
    : [];

  try {
    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          {
            role: 'system',
            content: `אתה דבי — עוזרת ניהול סוכרת ידידותית עבור תהל, ילדה עם סוכרת סוג 1.
אמא שואלת אותך שאלות על ניהול האינסולין והתזונה של תהל.
ענה תמיד בעברית, בצורה תמציתית (1–3 משפטים בלבד).
התמחותך: ערכי פחמימות במזונות (בגרמים), מינון אינסולין, ניהול רמת סוכר.
לשאלות על פחמימות — ציין ישירות את הגרמים, למשל: "המבורגר 220 גרם מכיל כ-30 גרם פחמימות".
לשאלות על מינון — חשבי לפי ה-ICR וה-ISF של תהל, והתחשבי בסוכר הנוכחי שלה.
היי ישירה ומעשית — ללא הסתייגויות רפואיות ארוכות.${patientBlock}`,
          },
          ...priorTurns,
          { role: 'user', content: String(message).trim() },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!grokRes.ok) {
      const detail = await grokRes.text();
      console.error('[dexcom-server] Grok API error:', grokRes.status, detail);
      return res.status(502).json({ error: 'Grok API error', status: grokRes.status });
    }

    const data = await grokRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'לא הצלחתי לענות';
    res.json({ reply });
  } catch (err) {
    console.error('[dexcom-server] /chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE stream ────────────────────────────────────────────────────────────────

const sseClients = new Set();

app.get('/api/glucose/stream', async (req, res) => {
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  try {
    const [reading] = await queryLatest(1);
    if (reading) {
      res.write(sseMsg({ type: 'reading', reading, isStale: isStale(reading.timestamp) }));
    }
  } catch (_) { /* non-fatal */ }

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
      `SELECT id, timestamp, value, trend,
              trend_arrow AS "trendArrow", created_at AS "createdAt"
       FROM   glucose_readings
       WHERE  id > $1
       ORDER  BY id ASC`,
      [lastSeenId ?? 0]
    );

    for (const reading of rows) {
      lastSeenId = reading.id;
      console.log(`[dexcom-server] New reading: ${reading.value} mg/dL ${reading.trendArrow}`);
      broadcast({ type: 'reading', reading, isStale: false });
      // Fire-and-forget — alert errors never block the polling loop
      alerts.check(reading).catch(err =>
        console.error('[dexcom-server] alert check error:', err.message)
      );
    }
  } catch (err) {
    console.error('[dexcom-server] checkForNewReadings error:', err.message);
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT_DEXCOM) || 3009;

app.listen(PORT, async () => {
  console.log(`[dexcom-server] Listening on :${PORT}`);
  await alerts.ensureTables();
  await initLastSeen();
  setInterval(checkForNewReadings, 60_000); // 60 s — lets Neon compute go idle between readings
});
