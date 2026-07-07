import { useEffect, useState } from 'react'
import { getStatistics } from '../api'
import { ScreenShell, SectionHeader } from '../components/ScreenShell'

const RANGES = [
  { id: '24h',  label: '24ש׳',   hours: 24   },
  { id: '7d',   label: '7 ימים',  hours: 168  },
  { id: '30d',  label: '30 ימים', hours: 720  },
  { id: '90d',  label: '90 ימים', hours: 2160 },
]

const CHART_DAYS   = [7, 30, 90]
const CHART_LABELS = { 7: 'שבוע', 30: 'חודש', 90: '3 חודשים' }

const BASE         = (import.meta.env.VITE_API_URL || '') + '/api'
const GLUCOSE_BASE = (import.meta.env.VITE_API_URL || '') + '/api/glucose'

export default function Statistics() {
  const [stats, setStats]           = useState(null)
  const [range, setRange]           = useState('24h')
  const [tirStats, setTirStats]     = useState(null)
  const [loadingTIR, setLoadingTIR] = useState(false)

  const [chartDays, setChartDays]   = useState(30)
  const [injData, setInjData]       = useState(null)
  const [injLoading, setInjLoading] = useState(true)

  useEffect(() => { getStatistics().then(setStats) }, [])

  useEffect(() => {
    const hours = RANGES.find(r => r.id === range)?.hours || 168
    setLoadingTIR(true)
    fetch(`${GLUCOSE_BASE}/stats?hours=${hours}`)
      .then(r => r.json())
      .then(d => { setTirStats(d.stats ?? null); setLoadingTIR(false) })
      .catch(() => setLoadingTIR(false))
  }, [range])

  useEffect(() => {
    setInjLoading(true)
    Promise.all([
      fetch(`${BASE}/novorapid?limit=300`).then(r => r.json()),
      fetch(`${BASE}/tregludec?limit=90`).then(r => r.json()),
    ])
      .then(([novo, treg]) => {
        const novoByDate = {}
        for (const r of novo) {
          const d = (r.recorded_at || '').slice(0, 10)
          if (d) novoByDate[d] = (novoByDate[d] || 0) + (r.dose_given || 0)
        }
        const tregByDate = {}
        for (const r of treg) {
          if (r.recorded_date) tregByDate[r.recorded_date] = r.dose
        }
        setInjData({ novoByDate, tregByDate })
      })
      .catch(() => {})
      .finally(() => setInjLoading(false))
  }, [])

  const low     = tirStats?.lowPct  ?? 0
  const high    = tirStats?.highPct ?? 0
  const inRange = Math.max(0, 100 - low - high)

  return (
    <>
      {/* Print CSS — hides the app, shows only the chart */}
      <style>{`
        @media print {
          .app { visibility: hidden !important; }
          #inj-chart-print { display: block !important; visibility: visible !important; }
          #inj-chart-print * { visibility: visible !important; }
          #inj-chart-print {
            position: fixed; top: 20px; left: 20px; right: 20px;
            background: white; padding: 20px;
            font-family: Arial, Helvetica, sans-serif;
            border-radius: 12px;
          }
        }
      `}</style>

      {/* Print-only chart output */}
      <div id="inj-chart-print" style={{ display: 'none' }}>
        <div style={{ textAlign: 'right', direction: 'rtl', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>מינוני אינסולין</div>
          <div style={{ fontSize: 12, color: '#888' }}>{chartDays} ימים אחרונים</div>
        </div>
        {injData && (
          <InjectionChart novoByDate={injData.novoByDate} tregByDate={injData.tregByDate} days={chartDays} forPrint/>
        )}
        <div style={{ display: 'flex', gap: 20, marginTop: 14, justifyContent: 'center', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 12, background: '#D97420', borderRadius: 3, display: 'inline-block', opacity: 0.8 }}/>
            נובורפיד — סה״כ יומי (יח׳)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 14, height: 2, background: '#4338CA', display: 'inline-block' }}/>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4338CA', display: 'inline-block' }}/>
            </span>
            טרגלודק — מנה יומית (יח׳)
          </span>
        </div>
      </div>

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
                <div className="col" style={{ gap: 4 }}>
                  {tirStats.avg != null && (
                    <div className="row" style={{ alignItems: 'baseline', gap: 5 }}>
                      <span className="tnum" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{tirStats.avg}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>mg/dL</span>
                      {tirStats.readings > 0 && (
                        <>
                          <span style={{ color: 'var(--hair)', fontSize: 13 }}>·</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{tirStats.readings} קריאות</span>
                        </>
                      )}
                    </div>
                  )}
                  {tirStats.avg == null && tirStats.readings > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{tirStats.readings} קריאות</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
                {low > 0 &&     <div style={{ flex: low,     background: 'var(--low)' }}/>}
                {inRange > 0 && <div style={{ flex: inRange, background: 'var(--good)' }}/>}
                {high > 0 &&    <div style={{ flex: high,    background: 'var(--warn)' }}/>}
              </div>
              <div className="row" style={{ marginTop: 10, gap: 14, fontSize: 11, flexWrap: 'wrap' }}>
                <LegendDot color="var(--warn)"  label="גבוה"  v={`${high}%`}/>
                <LegendDot color="var(--good)"  label="בטווח" v={`${inRange}%`}/>
                <LegendDot color="var(--low)"   label="נמוך"  v={`${low}%`}/>
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
              value={stats.icr_effective ? `1:${stats.icr_effective}` : '—'}
              sub={stats.icr_override ? 'ידני' : (stats.icr ? `${stats.data_points?.icr || 0} מדידות` : 'ברירת מחדל')}
              badge={stats.icr_override ? 'ידני' : null}
              confidence={stats.confidence}
            />
            <ParamCard
              label="ISF"
              hint="רגישות"
              value={stats.isf_effective ? String(stats.isf_effective) : '—'}
              sub={stats.isf_override ? 'ידני' : (stats.isf ? `${stats.data_points?.isf || 0} מדידות` : 'ברירת מחדל')}
              badge={stats.isf_override ? 'ידני' : null}
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

        {/* ── Injection trend chart ── */}
        <div className="card" style={{ padding: 16 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="label">מינוני אינסולין</span>
            <button
              onClick={() => window.print()}
              style={{
                border: '1px solid var(--hair)', background: 'var(--bg)',
                borderRadius: 8, padding: '5px 10px', fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🖨️ ייצוא PDF
            </button>
          </div>

          {/* Day-range pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {CHART_DAYS.map(d => (
              <button key={d} onClick={() => setChartDays(d)} style={{
                border: '1px solid var(--hair)', borderRadius: 999,
                padding: '5px 12px', fontFamily: 'inherit', fontSize: 11,
                background: chartDays === d ? 'var(--ink)' : 'transparent',
                color: chartDays === d ? '#fff' : 'var(--ink-2)',
                fontWeight: chartDays === d ? 700 : 400, cursor: 'pointer',
              }}>
                {CHART_LABELS[d]}
              </button>
            ))}
          </div>

          {/* Chart */}
          {injLoading ? (
            <div className="muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: 13 }}>טוען...</div>
          ) : injData ? (
            <InjectionChart novoByDate={injData.novoByDate} tregByDate={injData.tregByDate} days={chartDays}/>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>אין נתוני הזרקות</div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 18, marginTop: 12, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-2)' }}>
              <span style={{ width: 12, height: 10, borderRadius: 2, background: '#D97420', opacity: 0.8, display: 'inline-block', flexShrink: 0 }}/>
              נובורפיד
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <span style={{ width: 10, height: 2, background: '#4338CA', display: 'inline-block' }}/>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4338CA', display: 'inline-block' }}/>
              </span>
              טרגלודק
            </div>
          </div>
        </div>

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
    </>
  )
}

// ── Injection trend SVG chart ─────────────────────────────────────────────────

function InjectionChart({ novoByDate, tregByDate, days }) {
  const pad2 = n => String(n).padStart(2, '0')

  // Build date array using LOCAL time (matches DB dates stored in Israel TZ)
  const today = new Date()
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  })

  const novoVals = dates.map(d => novoByDate[d] || 0)
  const tregVals = dates.map(d => tregByDate[d] ?? null)

  const allVals = [...novoVals, ...tregVals.filter(v => v != null)]
  const rawMax  = allVals.length ? Math.max(...allVals) : 10
  const yMax    = Math.max(10, Math.ceil(rawMax / 5) * 5 + 5)

  // SVG layout
  const W = 320, H = 150
  const PL = 28, PR = 8, PT = 8, PB = 22
  const cW = W - PL - PR
  const cH = H - PT - PB

  const xStep = cW / dates.length
  const toY   = v  => PT + cH - (v / yMax) * cH
  const toX   = i  => PL + (i + 0.5) * xStep

  // How often to label the X axis
  const xLabelEvery = days <= 7 ? 1 : days <= 14 ? 2 : days <= 30 ? 5 : 15

  // Tregludec line path
  const tregPts = tregVals.map((v, i) => v != null ? [toX(i), toY(v)] : null)
  const connPts  = tregPts.filter(Boolean)
  const tregPath = connPts.length > 1
    ? connPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    : ''

  const yTicks = [0, Math.round(yMax / 2), yMax]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Gridlines + Y labels */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={toY(v)} y2={toY(v)}
            stroke="var(--hair)" strokeWidth={0.5}/>
          <text x={PL - 3} y={toY(v) + 4} textAnchor="end"
            fontSize={8} fill="var(--ink-3)" fontFamily="monospace">{v}</text>
        </g>
      ))}

      {/* NovoRapid bars */}
      {novoVals.map((v, i) => {
        if (!v) return null
        const bw = Math.max(1.5, xStep * 0.6)
        const x  = PL + i * xStep + (xStep - bw) / 2
        const bh = (v / yMax) * cH
        return (
          <rect key={i} x={x} y={toY(v)} width={bw} height={bh}
            fill="#D97420" opacity={0.8} rx={1.5}/>
        )
      })}

      {/* Tregludec connecting line */}
      {tregPath && (
        <path d={tregPath} fill="none" stroke="#4338CA" strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round"/>
      )}

      {/* Tregludec dots */}
      {tregPts.map((p, i) => p && (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#4338CA"/>
      ))}

      {/* X axis date labels */}
      {dates.map((d, i) => {
        if (i % xLabelEvery !== 0) return null
        const [, m, day] = d.split('-')
        return (
          <text key={i} x={toX(i)} y={H - 5} textAnchor="middle"
            fontSize={7.5} fill="var(--ink-3)">{`${day}/${m}`}</text>
        )
      })}
    </svg>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function LegendDot({ color, label, v }) {
  return (
    <div className="row" style={{ gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }}/>
      <span style={{ color: 'var(--ink-2)' }}>{label}</span>
      <span className="tnum" style={{ fontWeight: 700 }}>{v}</span>
    </div>
  )
}

function ParamCard({ label, hint, value, sub, confidence, badge }) {
  const confColor = confidence === 'high' ? 'var(--good)' : confidence === 'medium' ? 'var(--warn)' : 'var(--ink-4)'
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="col" style={{ gap: 3 }}>
        <div className="row" style={{ gap: 5, alignItems: 'center' }}>
          <span className="label">{label}</span>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
              color: 'var(--brand-deep)', background: 'var(--brand-tint)',
              padding: '2px 6px', borderRadius: 999,
            }}>{badge}</span>
          )}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
      </div>
      <div className="bignum tnum" style={{ fontSize: 32, fontWeight: 500, color: 'var(--ink)' }}>{value}</div>
      <span style={{ fontSize: 11, color: badge ? 'var(--brand-deep)' : confColor }}>{sub}</span>
    </div>
  )
}
