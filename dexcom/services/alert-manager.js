/**
 * Alert Manager
 *
 * Checks each new glucose reading against configurable thresholds.
 * Applies a 15-minute per-type debounce to avoid notification floods.
 * Ships with a webhook channel; register additional channels via onAlert().
 *
 * Env vars (see .env.example):
 *   ALERT_URGENT_LOW, ALERT_LOW, ALERT_HIGH, ALERT_URGENT_HIGH, ALERT_WEBHOOK_URL
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fetch = require('node-fetch');

// ─── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  urgentLow:  Number(process.env.ALERT_URGENT_LOW)  || 55,
  low:        Number(process.env.ALERT_LOW)          || 70,
  high:       Number(process.env.ALERT_HIGH)         || 180,
  urgentHigh: Number(process.env.ALERT_URGENT_HIGH)  || 250,
};

const DEBOUNCE_MS   = 15 * 60 * 1000; // 15 minutes
const WEBHOOK_URL   = process.env.ALERT_WEBHOOK_URL;

// ─── State ─────────────────────────────────────────────────────────────────────

const lastFiredAt = {};   // { [alertType]: timestamp }
const subscribers = [];   // registered callbacks

// ─── Classification ────────────────────────────────────────────────────────────

/**
 * Returns an alert descriptor for the given glucose value, or null if in range.
 */
function classify(value) {
  if (value <= THRESHOLDS.urgentLow)  return { type: 'urgent_low',  severity: 'urgent',  label: '🚨 URGENT LOW'  };
  if (value <= THRESHOLDS.low)        return { type: 'low',         severity: 'warning', label: '⚠️ LOW'          };
  if (value >= THRESHOLDS.urgentHigh) return { type: 'urgent_high', severity: 'urgent',  label: '🚨 URGENT HIGH' };
  if (value >= THRESHOLDS.high)       return { type: 'high',        severity: 'warning', label: '⚠️ HIGH'         };
  return null;
}

function isDebounced(type) {
  const last = lastFiredAt[type];
  return last && (Date.now() - last) < DEBOUNCE_MS;
}

// ─── Channels ──────────────────────────────────────────────────────────────────

async function sendWebhook(alert) {
  if (!WEBHOOK_URL) return;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(alert),
    });
    if (!res.ok) console.warn(`[alert-manager] Webhook responded ${res.status}`);
  } catch (err) {
    console.error('[alert-manager] Webhook delivery failed:', err.message);
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a callback that fires on every (non-debounced) alert.
 * cb(alert) where alert = { type, severity, label, value, trendArrow, timestamp, thresholds }
 */
function onAlert(cb) {
  subscribers.push(cb);
}

/**
 * Check a reading and fire alerts if thresholds are breached.
 * Call this from the server's polling loop each time a new reading is detected.
 *
 * @param {{ value: number, trend_arrow: string, timestamp: string }} reading
 */
function check(reading) {
  const classification = classify(reading.value);
  if (!classification) return;
  if (isDebounced(classification.type)) return;

  lastFiredAt[classification.type] = Date.now();

  const alert = {
    ...classification,
    value:      reading.value,
    trendArrow: reading.trend_arrow,
    timestamp:  reading.timestamp,
    thresholds: { ...THRESHOLDS },
  };

  console.log(`[alert-manager] ${alert.label}: ${alert.value} mg/dL ${alert.trendArrow}`);

  // Fire all channels (don't await — fire and forget)
  sendWebhook(alert);
  for (const cb of subscribers) {
    try { cb(alert); } catch (e) {
      console.error('[alert-manager] Subscriber error:', e.message);
    }
  }
}

/**
 * Returns a copy of the current threshold config (useful for API responses).
 */
function getThresholds() {
  return { ...THRESHOLDS };
}

module.exports = { check, onAlert, getThresholds };
