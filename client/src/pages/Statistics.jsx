import { useEffect, useState } from 'react'
import { getStatistics } from '../api'
import { ScreenShell, SectionHeader } from '../components/ScreenShell'
import { Sparkline } from '../components/Bits'

const RANGES = [
  { id: '24h',  label: '24ש׳',  hours: 24   },
  { id: '7d',   label: '7 ימים', hours: 168  },
  { id: '30d',  label: '30 ימים', hours: 720  },
  { id: '90d',  label: '90 ימים', hours: 2160 },
]

const GLUCOSE_BASE = (import.meta.env.VITE_API_URL || '') + '/api/glucose'

export default function Statistics() {
  const [stats, setStats]           = useState(null)
  const [range, setRange]           = useState('7d')
  const [tirStats, setTirStats]     = useState(null)
  const [loadingTIR, setLoadingTIR] = useState(false)

  // Core stats (ICR, ISF, Tregludec)
  useEffect(() => { getStatistics().then(setStats) }, [])

  // TIR stats for selected range
  useEffect(() => {
    const hours = RANGES.find(r => r.id === range)?.hours || 168
    setLoadingTIR(true)
    fetch(`${GLUCOSE_BASE}/stats?hours=${hours}`)
      .then(r => r.json())
      .then(d => { setTirStats(d.stats ?? null); setLoadingTIR(false) })
      .catch(() => setLoadingTIR(false))
  }, [range])

  const low     = tirStats?.lowPct  ?? 0
  const high    = tirStats?.highPct ?? 0
  const inRange = Math.max(0, 100 - low - high)

  return (
    <ScreenShell title="סטטיסטיקה" sub="ICR · ISF · זמן בטווח" tab="stats">

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, background: 'var(--card)', borderRadius: 999, padding: 4, boxShadow: 'var(--sh-1)' }}>
        {RANGES.map(r => (
          <button key={r.id} onClick={() => setRange(r.id)} style={{
            flex: 1, border: 0, padding: '8px 10px', borderRadius: 999,
            background: range === r.id ? 'var(--ink)' : 'transparent',
            color: range === r.id ? '#fff' : 'var(--ink-2)',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>{r.label}</button>
        ))}
      </div>

      {/* Tregludec recommendation hero */}
      {stats?.tregludec_recommendation && !stats?.hypo_warning && (
        <div style={{
          padding: 18, borderRadius: 24,
          background: 'linear-gradient(160deg, #FEF1E6 0%, #F8E5D2 100%)',
          border: '0.5px solid rgba(215,116,83,0.18)',
        }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <span className="pill pill-brand">המלצה</span>
            <span className="muted" style={{ fontSize: 11 }}>· מבוסס מגמת בסיס</span>
          </div>
          <div className="serif" style={{ fontSize: 20, lineHeight: 1.3, fontWeight: 500, marginBottom: 6 }}>
            {stats.tregludec_recommendation}
          </div>
          {stats.fasting_avg && (
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              סוכר בצום ממוצע: {stats.fasting_avg} mg/dL
            </div>
          )}
        </div>
      )}

      {/* Hypo warning */}
      {stats?.hypo_warning && (
        <div style={{ padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--cold-soft)', border: '1px solid var(--cold)', fontSize: 13, color: '#3F6584' }}>
          ⚠️ {stats.hypo_warning}
        </div>
      )}

      {/* Time in Range */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="label">זמן בטווח</span>
          <span className="tnum muted" style={{ fontSize: 11 }}>70–180 mg/dL</span>
        </div>
        {loadingTIR ? (
          <div className="muted" style={{ textAlign: 'center', padding: '12px 0', fontSize: 13 }}>טוען...</div>
        ) : tirStats ? (
          <>
            <div className="row" style={{ alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span className="bignum tnum" style={{ fontSize: 56, color: 'var(--good)', fontWeight: 500 }}>{inRange}%</span>
              {tirStats.readings > 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{tirStats.readings} קריאות</span>
              )}
            </div>
            {/* TIR bar */}
            <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
              {low > 0 &&     <div style={{ flex: low,     background: 'var(--cold)' }}/>}
              {inRange > 0 && <div style={{ flex: inRange, background: 'var(--good)' }}/>}
              {high > 0 &&    <div style={{ flex: high,    background: 'var(--warn)' }}/>}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 14, fontSize: 11, flexWrap: 'wrap' }}>
              <LegendDot color="var(--warn)"  label="גבוה"   v={`${high}%`}/>
              <LegendDot color="var(--good)"  label="בטווח"  v={`${inRange}%`}/>
              <LegendDot color="var(--cold)"  label="נמוך"   v={`${low}%`}/>
            </div>
          </>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>אין נתוני חיישן לתקופה זו</div>
        )}
      </div>

      {/* ICR + ISF */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
          <ParamCard
            label="ICR"
            hint="יחס פחמימות"
            value={stats.icr ? `1:${stats.icr}` : '—'}
            sub={stats.icr ? `${stats.data_points?.icr || 0} מדידות` : 'ברירת מחדל 1:15'}
            confidence={stats.confidence}
          />
          <ParamCard
            label="ISF"
            hint="רגישות"
            value={stats.isf ? String(stats.isf) : '—'}
            sub={stats.isf ? `${stats.data_points?.isf || 0} מדידות` : 'ברירת מחדל 50'}
            confidence={stats.confidence}
          />
        </div>
      )}

      {/* Tregludec card */}
      {stats && (
        <div className="card" style={{ padding: 16 }}>
          <SectionHeader title="טרגלודק"/>
          <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 10, marginBottom: 4 }}>
            <span className="bignum tnum" style={{ fontSize: 40, color: 'var(--brand-deep)', fontWeight: 500 }}>
              {stats.tregludec_current ? `${stats.tregludec_current}` : '—'}
            </span>
            {stats.tregludec_current && (
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--brand-deep)' }}>יח׳ / יום</span>
            )}
          </div>
          {stats.fasting_avg && (
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              סוכר בצום ממוצע: <strong style={{ color: stats.fasting_avg > 130 ? 'var(--warn)' : stats.fasting_avg < 80 ? 'var(--cold)' : 'var(--good)' }}>{stats.fasting_avg}</strong> mg/dL
            </div>
          )}
          {!stats.tregludec_current && (
            <div className="muted" style={{ fontSize: 12 }}>רשמי מינון טרגלודק כדי לקבל המלצות</div>
          )}
        </div>
      )}

      {/* Free meals */}
      {stats && stats.free_meal_count > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <SectionHeader title="ארוחות ללא הזרקה"/>
          <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span className="bignum tnum" style={{ fontSize: 40, color: 'var(--brand-deep)', fontWeight: 500 }}>
              {stats.free_meal_excursion > 0 ? `+${stats.free_meal_excursion}` : stats.free_meal_excursion}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>mg/dL ממוצע</span>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{stats.free_meal_count} מדידות עם סוכר לפני ואחרי</div>
        </div>
      )}

    </ScreenShell>
  )
}

function LegendDot({ color, label, v }) {
  return (
    <div className="row" style={{ gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }}/>
      <span style={{ color: 'var(--ink-2)' }}>{label}</span>
      <span className="tnum" style={{ fontWeight: 700 }}>{v}</span>
    </div>
  )
}

function ParamCard({ label, hint, value, sub, confidence }) {
  const confColor = confidence === 'high' ? 'var(--good)' : confidence === 'medium' ? 'var(--warn)' : 'var(--ink-4)'
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="col" style={{ gap: 1 }}>
        <span className="label">{label}</span>
        <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
      </div>
      <div className="bignum tnum" style={{ fontSize: 32, fontWeight: 500, color: 'var(--ink)' }}>{value}</div>
      <span style={{ fontSize: 11, color: confColor }}>{sub}</span>
    </div>
  )
}
