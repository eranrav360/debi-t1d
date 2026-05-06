module.exports = {
  apps: [
    // ── Flask/Gunicorn backend ────────────────────────────────────────────────
    {
      name: 'debi',
      script: '/home/ubuntu/apps/debi/venv/bin/gunicorn',
      args: 'app:app --bind 0.0.0.0:3007 --workers 2 --timeout 60',
      cwd: '/home/ubuntu/apps/debi',
      interpreter: 'none',
      env: {
        PORT: 3007,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://neondb_owner:npg_m4LVCpBWgI6v@ep-purple-heart-agybciws-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        CORS_ORIGINS: 'https://debi.144-24-171-177.sslip.io,https://debi-t1d.vercel.app',
      },
    },

    // ── Dexcom Share poller ───────────────────────────────────────────────────
    // Polls Dexcom every 5 min and writes glucose_readings to Neon.
    // Set DEXCOM_USERNAME / DEXCOM_PASSWORD in .env before starting.
    {
      name: 'dexcom-poller',
      script: 'dexcom/services/dexcom-poller.js',
      cwd: '/home/ubuntu/apps/debi',
      interpreter: 'node',
      restart_delay: 10_000,  // wait 10 s before auto-restart on crash
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://neondb_owner:npg_m4LVCpBWgI6v@ep-purple-heart-agybciws-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        // Dexcom credentials — set these or they will be read from .env
        DEXCOM_SERVER: 'ous',   // 'us' for US accounts, 'ous' for outside US
        // DEXCOM_USERNAME and DEXCOM_PASSWORD should live in .env (not committed)
      },
    },

    // ── Dexcom Express API + SSE server ────────────────────────────────────────
    {
      name: 'dexcom-server',
      script: 'dexcom/server.js',
      cwd: '/home/ubuntu/apps/debi',
      interpreter: 'node',
      env: {
        PORT_DEXCOM: 3008,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://neondb_owner:npg_m4LVCpBWgI6v@ep-purple-heart-agybciws-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        CORS_ORIGINS: 'https://debi.144-24-171-177.sslip.io,https://debi-t1d.vercel.app',
        // Alert thresholds (optional — these are the defaults)
        ALERT_URGENT_LOW:  55,
        ALERT_LOW:         70,
        ALERT_HIGH:        180,
        ALERT_URGENT_HIGH: 250,
        // ALERT_WEBHOOK_URL: 'https://hooks.example.com/glucose-alert'
      },
    },
  ],
}
