/**
 * Alert Manager — DB-backed rules with WhatsApp notifications via WAHA.
 *
 * Rules live in the `alert_rules` table and are editable via the admin API.
 * Each rule has:
 *   condition_type   'BELOW' | 'ABOVE'
 *   threshold        glucose level in mg/dL
 *   duration_minutes 0 = fire immediately on a single reading
 *                    >0 = ALL readings in the last N minutes must breach threshold
 *   cooldown_minutes minimum gap between repeated alerts for this rule
 *
 * Env vars (see .env.example): WAHA_URL, WAHA_KEY, WAHA_GROUP_ID
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fetch = require('node-fetch');

const WAHA_URL      = process.env.WAHA_URL      || 'https://waha.raviv360.com';
const WAHA_KEY      = process.env.WAHA_KEY;
const WAHA_GROUP_ID = process.env.WAHA_GROUP_ID || '120363321560243969@g.us';

// Injected by server.js via init()
let db = null;

// ─── Bootstrap ─────────────────────────────────────────────────────────────────

function init(pgPool) {
  db = pgPool;
}

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id               SERIAL      PRIMARY KEY,
      name             TEXT        NOT NULL,
      name_he          TEXT        NOT NULL,
      condition_type   TEXT        NOT NULL,
      threshold        INTEGER     NOT NULL,
      duration_minutes INTEGER     NOT NULL DEFAULT 0,
      cooldown_minutes INTEGER     NOT NULL DEFAULT 15,
      enabled          BOOLEAN     NOT NULL DEFAULT true,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id        SERIAL      PRIMARY KEY,
      rule_id   INTEGER     REFERENCES alert_rules(id) ON DELETE CASCADE,
      fired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      value     INTEGER,
      message   TEXT
    )
  `);

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_alert_history_rule
     ON alert_history (rule_id, fired_at DESC)`
  );

  // Seed default rules once
  const { rowCount } = await db.query('SELECT 1 FROM alert_rules LIMIT 1');
  if (rowCount === 0) {
    await db.query(`
      INSERT INTO alert_rules
        (name, name_he, condition_type, threshold, duration_minutes, cooldown_minutes)
      VALUES
        ('Urgent Low',     'סוכר נמוך דחוף',   'BELOW',      60,   0,  15),
        ('Low Sustained',  'סוכר נמוך ממושך',  'BELOW',      70,  10,  15),
        ('High Sustained', 'סוכר גבוה ממושך',  'ABOVE',     180, 120,  30),
        ('Rapid Drop',     'ירידה מהירה',       'RAPID_DROP', 20,   0,  15)
    `);
    console.log('[alert-manager] Default rules seeded');
  } else {
    // Add the rapid-drop rule to existing deployments if not already present
    await db.query(`
      INSERT INTO alert_rules (name, name_he, condition_type, threshold, duration_minutes, cooldown_minutes)
      SELECT 'Rapid Drop', 'ירידה מהירה', 'RAPID_DROP', 20, 0, 15
      WHERE NOT EXISTS (SELECT 1 FROM alert_rules WHERE condition_type = 'RAPID_DROP')
    `);
  }
}

// ─── Rules CRUD ────────────────────────────────────────────────────────────────

async function getRules() {
  const { rows } = await db.query(`
    SELECT
      r.id,
      r.name,
      r.name_he          AS "nameHe",
      r.condition_type   AS "conditionType",
      r.threshold,
      r.duration_minutes AS "durationMinutes",
      r.cooldown_minutes AS "cooldownMinutes",
      r.enabled,
      r.updated_at       AS "updatedAt",
      h.fired_at         AS "lastFiredAt",
      h.value            AS "lastFiredValue"
    FROM alert_rules r
    LEFT JOIN LATERAL (
      SELECT fired_at, value
      FROM   alert_history
      WHERE  rule_id = r.id
      ORDER  BY fired_at DESC
      LIMIT  1
    ) h ON true
    ORDER BY r.id
  `);
  return rows;
}

async function updateRule(id, patch) {
  const ALLOWED = ['threshold', 'duration_minutes', 'cooldown_minutes', 'enabled'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED.includes(k)) continue;
    sets.push(`${k} = $${vals.length + 1}`);
    vals.push(v);
  }
  if (!sets.length) throw new Error('No valid fields to update');
  vals.push(id);
  const { rows } = await db.query(
    `UPDATE alert_rules SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

// ─── Alert evaluation ──────────────────────────────────────────────────────────

async function getLastFired(ruleId) {
  const { rows } = await db.query(
    `SELECT fired_at FROM alert_history
     WHERE rule_id = $1 ORDER BY fired_at DESC LIMIT 1`,
    [ruleId]
  );
  return rows[0]?.fired_at ?? null;
}

// Returns false if should not fire, or a truthy value (may carry extra data).
// For RAPID_DROP: returns the drop amount (a number) so callers can embed it in the message.
async function shouldFire(rule, reading) {
  if (!rule.enabled) return false;

  // Cooldown
  const lastFired = await getLastFired(rule.id);
  if (lastFired) {
    const elapsed = Date.now() - new Date(lastFired).getTime();
    if (elapsed < rule.cooldown_minutes * 60_000) return false;
  }

  const { condition_type: type, threshold, duration_minutes: dur } = rule;

  // Rapid drop: compare current reading against the immediately preceding one
  if (type === 'RAPID_DROP') {
    const { rows } = await db.query(
      `SELECT value FROM glucose_readings
       WHERE  timestamp < $1
       ORDER  BY timestamp DESC LIMIT 1`,
      [reading.timestamp]
    );
    if (!rows[0]) return false;
    const drop = rows[0].value - reading.value;
    return drop >= threshold ? drop : false; // return the drop amount when firing
  }

  if (dur === 0) {
    // Immediate: single reading triggers the rule
    if (type === 'BELOW' && reading.value < threshold) return true;
    if (type === 'ABOVE' && reading.value > threshold) return true;
    return false;
  }

  // Sustained: every reading in the last `dur` minutes must breach the threshold
  const { rows } = await db.query(
    `SELECT value FROM glucose_readings
     WHERE  timestamp >= NOW() - ($1 || ' minutes')::interval
     ORDER  BY timestamp DESC`,
    [dur]
  );

  if (rows.length < 2) return false; // not enough data yet

  if (type === 'BELOW') return rows.every(r => r.value < threshold);
  if (type === 'ABOVE') return rows.every(r => r.value > threshold);
  return false;
}

// ─── WhatsApp via WAHA ─────────────────────────────────────────────────────────

function buildMessage(rule, reading) {
  const v     = reading.value;
  const arrow = reading.trend_arrow || reading.trendArrow || '';
  const dur   = rule.duration_minutes;

  if (rule.condition_type === 'RAPID_DROP') {
    const drop = reading.dropAmount ? ` (ירד ${reading.dropAmount} נקודות)` : '';
    return `📉 *דבי* - ירידה מהירה בסוכר!${drop}\n${v} mg/dL ${arrow}`;
  }
  if (rule.condition_type === 'BELOW' && dur === 0) {
    return `🚨 *דבי* - סוכר נמוך מאוד!\n${v} mg/dL ${arrow}`;
  }
  if (rule.condition_type === 'BELOW' && dur > 0) {
    return `⚠️ *דבי* - סוכר נמוך יותר מ-${dur} דקות\n${v} mg/dL ${arrow}`;
  }
  if (rule.condition_type === 'ABOVE' && dur > 0) {
    const timeStr = dur >= 60 ? `${dur / 60} שעות` : `${dur} דקות`;
    return `📈 *דבי* - סוכר גבוה יותר מ-${timeStr}\n${v} mg/dL ${arrow}`;
  }
  return `⚠️ *דבי* - ${rule.name_he}\n${v} mg/dL ${arrow}`;
}

async function sendWhatsApp(text) {
  if (!WAHA_KEY) {
    console.warn('[alert-manager] WAHA_KEY not set — skipping WhatsApp');
    return;
  }
  try {
    const res = await fetch(`${WAHA_URL}/api/sendText`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body:    JSON.stringify({ chatId: WAHA_GROUP_ID, text, session: 'default' }),
    });
    if (!res.ok) {
      console.warn(`[alert-manager] WAHA ${res.status}: ${await res.text()}`);
    } else {
      console.log('[alert-manager] WhatsApp sent:', text.split('\n')[0]);
    }
  } catch (err) {
    console.error('[alert-manager] WhatsApp delivery failed:', err.message);
  }
}

async function fireAlert(rule, reading, testMode = false) {
  const message = buildMessage(rule, reading);
  console.log(`[alert-manager] ${testMode ? '[TEST] ' : ''}${rule.name_he} — ${reading.value} mg/dL`);
  await sendWhatsApp(testMode ? `🧪 *בדיקה* — ${message}` : message);
  if (!testMode) {
    await db.query(
      `INSERT INTO alert_history (rule_id, value, message) VALUES ($1, $2, $3)`,
      [rule.id, reading.value, message]
    );
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Check a new reading against all enabled rules.
 * Called by server.js on every new reading — fire and forget.
 *
 * NOTE: getRules() returns camelCase keys for the REST API; the internal
 * helpers (shouldFire / buildMessage) expect snake_case.  Normalise here.
 */
async function check(reading) {
  if (!db) return;
  try {
    const rules = await getRules();
    for (const rule of rules) {
      const r = {
        ...rule,
        condition_type:   rule.conditionType,
        duration_minutes: rule.durationMinutes,
        cooldown_minutes: rule.cooldownMinutes,
        name_he:          rule.nameHe,
      };
      const result = await shouldFire(r, reading);
      if (result) {
        // For RAPID_DROP, shouldFire returns the drop amount; embed it in the reading
        const augmented = typeof result === 'number' ? { ...reading, dropAmount: result } : reading;
        await fireAlert(r, augmented);
      }
    }
  } catch (err) {
    console.error('[alert-manager] check error:', err.message);
  }
}

/**
 * Send a test WhatsApp for a specific rule using the given (or latest) reading.
 */
async function testRule(ruleId, reading) {
  const { rows } = await db.query(
    `SELECT id, name, name_he, condition_type, threshold,
            duration_minutes, cooldown_minutes, enabled
     FROM alert_rules WHERE id = $1`,
    [ruleId]
  );
  if (!rows[0]) throw new Error('Rule not found');
  await fireAlert(rows[0], reading, true /* testMode */);
}

module.exports = { init, ensureTables, check, getRules, updateRule, testRule };
