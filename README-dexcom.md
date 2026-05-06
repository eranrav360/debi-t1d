# Dexcom Share API Integration

Real-time glucose readings from the Dexcom Share API, stored in Neon and served
to the Debi frontend via REST + SSE.

## Architecture

```
Dexcom Share API
      │  (every 5 min)
      ▼
dexcom-poller (PM2)          — polls Dexcom, writes to glucose_readings table
      │
      ▼ (Neon DB)
dexcom-server (PM2, :3008)   — REST + SSE, reads from DB every 10 s
      │
      ▼ (Nginx proxies /api/glucose/*)
React frontend               — useGlucose() hook, SSE stream
```

## Setup

### 1. Copy and fill in credentials

```bash
cp .env.example .env
# Edit .env — set DEXCOM_USERNAME, DEXCOM_PASSWORD, DEXCOM_SERVER
```

`DEXCOM_SERVER` must be `ous` for Israeli / non-US accounts.

### 2. Install Node dependencies

```bash
cd /home/ubuntu/apps/debi/dexcom
npm install
```

### 3. Start the PM2 processes

```bash
cd /home/ubuntu/apps/debi
pm2 start ecosystem.config.js --only dexcom-poller,dexcom-server
pm2 save
```

The poller will:
1. Create the `glucose_readings` table if it doesn't exist
2. Authenticate with Dexcom Share
3. Fetch the latest reading immediately, then every 5 minutes

### 4. Verify

```bash
# Live logs from both services
pm2 logs dexcom-poller
pm2 logs dexcom-server

# Quick API check
curl https://debi.144-24-171-177.sslip.io/api/glucose/latest | jq .
```

### 5. Nginx config

Add this block inside the `server { }` block in `/etc/nginx/sites-available/debi`
(see `nginx-debi.conf` for context):

```nginx
# Dexcom glucose API — proxied to Express on :3008
location /api/glucose/ {
    proxy_pass         http://127.0.0.1:3008;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection '';      # keep-alive for SSE
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_buffering    off;               # critical for SSE
    proxy_cache        off;
    proxy_read_timeout 3600s;             # hold SSE connections open
}
```

Then: `sudo nginx -t && sudo systemctl reload nginx`

---

## API Reference

### `GET /api/glucose/latest`
```json
{
  "reading": {
    "id": 42,
    "timestamp": "2026-05-04T08:15:00Z",
    "value": 115,
    "trend": "Flat",
    "trendArrow": "→"
  },
  "isStale": false
}
```

### `GET /api/glucose/history?hours=24`
Returns an array of readings for the last N hours (max 168).

### `GET /api/glucose/stats?hours=24`
```json
{
  "stats": {
    "avg": 121,
    "min": 68,
    "max": 195,
    "readings": 288,
    "timeInRangePct": 78
  },
  "hours": 24
}
```

### `GET /api/glucose/stream` (SSE)
Event stream. Each event:
```
data: {"type":"reading","reading":{...},"isStale":false}
```
Plus `: heartbeat` comments every 25 s.

---

## Frontend usage

```jsx
import { useGlucose } from '../hooks/useGlucose'

function GlucoseWidget() {
  const { currentReading, stats, isStale, isConnected } = useGlucose()

  if (!currentReading) return <div>Waiting for reading…</div>

  return (
    <div style={{ color: isStale ? 'gray' : 'inherit' }}>
      <span style={{ fontSize: 48, fontWeight: 800 }}>{currentReading.value}</span>
      <span> mg/dL {currentReading.trendArrow}</span>
      {isStale && <span> · stale</span>}
      {isConnected ? ' 🟢' : ' 🟡 polling'}
    </div>
  )
}
```

---

## Alert thresholds

Configure in `.env` or `ecosystem.config.js`:

| Variable            | Default | Meaning              |
|---------------------|---------|----------------------|
| `ALERT_URGENT_LOW`  | 55      | Urgent hypoglycemia  |
| `ALERT_LOW`         | 70      | Low alert            |
| `ALERT_HIGH`        | 180     | High alert           |
| `ALERT_URGENT_HIGH` | 250     | Urgent hyperglycemia |

Alerts fire at most once every 15 minutes per type.
Set `ALERT_WEBHOOK_URL` to POST alert payloads to Slack, Make, IFTTT, etc.
