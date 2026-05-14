import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, recordSensorChange } from '../api'
import { useGlucose } from '../hooks/useGlucose'
import { useLandscape } from '../hooks/useLandscape'
import { GL, Sparkline, SensorPie, AskDebi, TabBar } from '../components/Bits'
import { IconMeal, IconSyringe, IconCamera, IconBolt, IconArrow } from '../components/Icons'

const SENSOR_DAYS = 10
const GLUC_BASE   = (import.meta.env.VITE_API_URL || '') + '/api/glucose'
const TREND_OPTS  = [1, 3, 6, 12, 24]

function trendDir(trend) {
  if (!trend) return 'flat'
  if (/DoubleUp/i.test(trend))               return 'rapidUp'
  if (/SingleUp|FortyFiveUp/i.test(trend))   return 'up'
  if (/DoubleDown/i.test(trend))             return 'rapidDown'
  if (/FortyFiveDown|SingleDown/i.test(trend)) return 'down'
  return 'flat'
}

function minsAgo(timestamp) {
  if (!timestamp) return null
  const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000)
  if (mins < 1)   return 'עכשיו'
  if (mins === 1) return 'לפני דקה'
  return `לפני ${mins} דקות`
}

function sensorDaysLeft(latest) {
  if (!latest) return null
  const changed = new Date(latest.changed_at.replace(' ', 'T'))
  const expires = new Date(changed.getTime() + SENSOR_DAYS * 24 * 60 * 60 * 1000)
  const msLeft  = expires - Date.now()
  return Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)))
}

function fmtTime(dt) {
  if (!dt) return ''
  return dt.slice(11, 16)
}

export default function Dashboard() {
  const navigate    = useNavigate()
  const isLandscape = useLandscape()

  const [data,            setData]            = useState(null)
  const [replacingSensor, setReplacingSensor] = useState(false)
  const [trendHours,      setTrendHours]      = useState(3)
  const [trendHistory,    setTrendHistory]    = useState([])

  const { currentReading, stats: glucoseStats, isStale, isConnected } = useGlucose()

  useEffect(() => { getDashboard().then(setData) }, [])

  useEffect(() => {
    fetch(`${GLUC_BASE}/history?hours=${trendHours}`)
      .then(r => r.json())
      .then(d => setTrendHistory(d.readings ?? []))
      .catch(() => {})
  }, [trendHours, currentReading?.id])

  async function handleSensorReplace() {
    setReplacingSensor(true)
    await recordSensorChange()
    const fresh = await getDashboard()
    setData(fresh)
    setReplacingSensor(false)
  }

  const sparkValues = trendHistory.map(r => r.value)
  const glColor     = currentReading ? GL.color(currentReading.value) : 'var(--ink-4)'
  const dir         = currentReading ? trendDir(currentReading.trend) : 'flat'

  const today_novorapid = data?.today_novorapid || []
  const today_tregludec = data?.today_tregludec || null
  const timelineEvents  = [
    ...today_novorapid.map(r => ({
      type:  r.total_carbs > 0 ? 'meal' : 'inj',
      time:  fmtTime(r.recorded_at),
      title: r.total_carbs > 0 ? 'ארוחה' : 'הזרקת נובורפיד',
      sub:   r.meal_items?.map(m => m.food_name).join(', ') || (r.total_carbs > 0 ? `${r.total_carbs}ג׳ פחמימות` : ''),
      dose:  `${r.dose_given} יח׳ נובורפיד`,
      ts:    r.recorded_at || '',
    })),
    ...(today_tregludec ? [{
      type: 'long', time: '07:00', title: 'טרגלודק', sub: 'מנה יומית',
      dose: `${today_tregludec.dose} יח׳`,
      ts: (today_tregludec.recorded_date || '') + 'T07:00',
    }] : []),
  ].sort((a, b) => (b.ts > a.ts ? 1 : -1))

  const daysLeft   = sensorDaysLeft(data?.latest_sensor)
  const today      = new Date()
  const dayNames   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const todayLabel = `${dayNames[today.getDay()]}, ${today.getDate()} ב${monthNames[today.getMonth()]}`
  const stats      = data?.stats || {}

  // ── TIR helper (shared between both layouts) ─────────────────────────────
  const tirLow     = glucoseStats?.lowPct  ?? 0
  const tirHigh    = glucoseStats?.highPct ?? 0
  const tirInRange = Math.max(0, 100 - tirLow - tirHigh)

  // ── Sparkline widths ──────────────────────────────────────────────────────
  const sparkPortrait  = Math.max(200, window.innerWidth - 64)
  // In landscape: right panel is ~57% of screen width minus padding
  const sparkLandscape = Math.max(160, Math.round(window.innerWidth * 0.56) - 32)

  // ════════════════════════════════════════════════════════════════
  //  LANDSCAPE layout
  // ════════════════════════════════════════════════════════════════
  if (isLandscape) {
    return (
      <div className="app">

        {/* Compact header */}
        <div style={{
          padding: '5px 14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0, borderBottom: '0.5px solid var(--hair)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>היום של תהל</span>
          <span className="muted" style={{ fontSize: 11 }}>{todayLabel}</span>
        </div>

        {/* Two-column body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', paddingBottom: 50 }}>

          {/* ── LEFT: Glucose + Quick tiles ── */}
          <div style={{
            width: '43%', borderLeft: '0.5px solid var(--hair)',
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '8px 10px', overflow: 'auto',
          }}>

            {/* Glucose card */}
            <div className="card" style={{ padding: '10px 14px' }}>
              {currentReading ? (
                isStale ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                      ⚠️ חיישן חסר או בעיה בתקשורת
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                      קריאה אחרונה:{' '}
                      <strong style={{ color: GL.color(currentReading.value) }}>{currentReading.value} mg/dL</strong>
                      {' · '}{minsAgo(currentReading.timestamp)}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row" style={{ alignItems: 'center', gap: 6 }}>
                      <span className="bignum" style={{ fontSize: 62, color: glColor }}>
                        {currentReading.value}
                      </span>
                      <IconArrow dir={dir} size={34} color={glColor} stroke={2.2}/>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>mg/dL</span>
                      <span className={`pill ${GL.pillClass(currentReading.value)}`} style={{ fontSize: 10 }}>
                        {GL.label(currentReading.value)}
                      </span>
                      <span className="muted" style={{ fontSize: 11 }}>{minsAgo(currentReading.timestamp)}</span>
                    </div>
                  </>
                )
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>⏳ ממתין…</span>
              )}
            </div>

            {/* Quick tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <QuickTile compact icon={IconMeal}    label="ארוחה" tint="var(--brand-tint)" color="var(--brand)"  onClick={() => navigate('/meal')} />
              <QuickTile compact icon={IconSyringe} label="הזרקה" tint="var(--good-soft)"  color="var(--good)"   onClick={() => navigate('/injection')} />
              <QuickTile compact icon={IconCamera}  label="צילום"  tint="#F2EBDD"           color="var(--ink-3)"  onClick={() => navigate('/camera')} />
            </div>

            {/* Tregludec warning — compact */}
            {data && !data.today_tregludec && (
              <div style={{
                padding: '7px 10px', borderRadius: 10,
                background: 'var(--warn-soft)', border: '1px solid #e0b87a',
                fontSize: 11, color: '#7a5a15', fontWeight: 600,
              }}>
                ⚠️ טרגלודק לא נרשם היום
              </div>
            )}
          </div>

          {/* ── RIGHT: Sparkline + TIR + Timeline ── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
            padding: '8px 10px', overflow: 'auto',
          }}>

            {/* Trend card */}
            <div className="card" style={{ padding: '10px 12px' }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <span className="label" style={{ fontSize: 11 }}>מגמת סוכר</span>
                <div className="row" style={{ gap: 3 }}>
                  {TREND_OPTS.map(h => (
                    <button key={h} onClick={() => setTrendHours(h)} style={{
                      border:     `1px solid ${trendHours === h ? 'var(--brand)' : 'var(--hair)'}`,
                      background:  trendHours === h ? 'var(--brand-tint)' : 'transparent',
                      color:       trendHours === h ? 'var(--brand-deep)' : 'var(--ink-3)',
                      borderRadius: 999, padding: '2px 6px',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{h}ש׳</button>
                  ))}
                </div>
              </div>
              <div style={{ direction: 'ltr' }}>
                {sparkValues.length > 1 ? (
                  <Sparkline
                    values={sparkValues} width={sparkLandscape} height={72}
                    color={glColor} band={[70, 180]} ticks={[70, 180, 250]} fill last
                  />
                ) : (
                  <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="muted" style={{ fontSize: 12 }}>ממתין לנתונים…</span>
                  </div>
                )}
              </div>
            </div>

            {/* TIR bar */}
            {glucoseStats && glucoseStats.readings > 0 && (
              <div>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span className="label" style={{ fontSize: 11 }}>זמן בטווח · 24ש׳</span>
                  <div className="row" style={{ gap: 10, fontSize: 11 }}>
                    <span style={{ color: 'var(--low)' }}>נמוך {tirLow}%</span>
                    <span style={{ color: 'var(--good)', fontWeight: 700 }}>בטווח {tirInRange}%</span>
                    <span style={{ color: 'var(--warn)' }}>גבוה {tirHigh}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 8, gap: 2 }}>
                  {tirLow     > 0 && <div style={{ flex: tirLow,     background: 'var(--low)' }}/>}
                  {tirInRange > 0 && <div style={{ flex: tirInRange, background: 'var(--good)' }}/>}
                  {tirHigh    > 0 && <div style={{ flex: tirHigh,    background: 'var(--warn)' }}/>}
                </div>
              </div>
            )}

            {/* Today's timeline — compact */}
            {timelineEvents.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {timelineEvents.slice(0, 3).map((ev, i) => (
                  <div key={i}>
                    <TimelineEvent ev={ev} compact/>
                    {i < Math.min(timelineEvents.length, 3) - 1 && <hr className="hr" style={{ marginInline: 10 }}/>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <TabBar active="home"/>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  //  PORTRAIT layout (original)
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="app">

      {/* Header */}
      <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div className="col" style={{ gap: 0 }}>
          <span className="muted" style={{ fontSize: 13 }}>שלום אמא 👋</span>
          <span style={{ fontSize: 22, fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}>היום של תהל</span>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 999, background: 'var(--brand-tint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--brand-deep)', fontWeight: 700, fontSize: 16, flexShrink: 0,
        }}>א</div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px var(--pad) 130px', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

        {/* ── Live glucose card ── */}
        <div className="card" style={{ padding: 18 }}>
          <span className="label">סוכר עכשיו</span>
          {currentReading ? (
            isStale ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                  ⚠️ חיישן חסר או בעיה בתקשורת
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  קריאה אחרונה: <strong style={{ color: GL.color(currentReading.value) }}>{currentReading.value} mg/dL</strong>
                  {' · '}{minsAgo(currentReading.timestamp)}
                </div>
              </div>
            ) : (
              <>
                <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="bignum" style={{ fontSize: 76, color: glColor, lineHeight: 1 }}>
                    {currentReading.value}
                  </span>
                  <IconArrow dir={dir} size={44} color={glColor} stroke={2.2}/>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>mg/dL</span>
                  <span className={`pill ${GL.pillClass(currentReading.value)}`}>{GL.label(currentReading.value)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{minsAgo(currentReading.timestamp)}</span>
                  {!isConnected && <span className="muted" style={{ fontSize: 11 }}>סריקה</span>}
                </div>
              </>
            )
          ) : (
            <div className="muted" style={{ fontSize: 15, paddingTop: 8 }}>⏳ ממתין לנתוני חיישן...</div>
          )}
        </div>

        {/* ── Quick tiles ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--gap)' }}>
          <QuickTile icon={IconMeal}    label="ארוחה" sub="חישוב מנה"       tint="var(--brand-tint)" color="var(--brand)"  onClick={() => navigate('/meal')} />
          <QuickTile icon={IconSyringe} label="הזרקה" sub="נובו / טרגלודק" tint="var(--good-soft)"  color="var(--good)"   onClick={() => navigate('/injection')} />
          <QuickTile icon={IconCamera}  label="צילום"  sub="זיהוי פחמימות"  tint="#F2EBDD"           color="var(--ink-3)"  onClick={() => navigate('/camera')} />
        </div>

        {/* ── Trend sparkline widget ── */}
        <div className="card" style={{ padding: 16 }}>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <span className="label">מגמת סוכר</span>
            <div className="row" style={{ gap: 5 }}>
              {TREND_OPTS.map(h => (
                <button key={h} onClick={() => setTrendHours(h)} style={{
                  border:      `1px solid ${trendHours === h ? 'var(--brand)' : 'var(--hair)'}`,
                  background:  trendHours === h ? 'var(--brand-tint)' : 'transparent',
                  color:       trendHours === h ? 'var(--brand-deep)' : 'var(--ink-3)',
                  borderRadius: 999, padding: '3px 9px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}>{h}ש׳</button>
              ))}
            </div>
          </div>
          <div style={{ direction: 'ltr' }}>
            {sparkValues.length > 1 ? (
              <Sparkline
                values={sparkValues} width={sparkPortrait} height={90}
                color={glColor} band={[70, 180]} ticks={[50, 70, 180, 250, 300]} fill last
              />
            ) : (
              <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="muted" style={{ fontSize: 13 }}>ממתין לנתונים…</span>
              </div>
            )}
          </div>
        </div>

        {/* ── TIR bar (24 h) ── */}
        {glucoseStats && glucoseStats.readings > 0 && (
          <div>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span className="label">זמן בטווח · 24 שעות</span>
              <span className="tnum muted" style={{ fontSize: 11 }}>70–180 mg/dL</span>
            </div>
            <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 12, gap: 2 }}>
              {tirLow     > 0 && <div style={{ flex: tirLow,     background: 'var(--low)' }}/>}
              {tirInRange > 0 && <div style={{ flex: tirInRange, background: 'var(--good)' }}/>}
              {tirHigh    > 0 && <div style={{ flex: tirHigh,    background: 'var(--warn)' }}/>}
            </div>
            <div className="row" style={{ marginTop: 6, gap: 14, fontSize: 11, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--low)' }}>נמוך {tirLow}%</span>
              <span style={{ color: 'var(--good)', fontWeight: 700 }}>בטווח {tirInRange}%</span>
              <span style={{ color: 'var(--warn)' }}>גבוה {tirHigh}%</span>
            </div>
          </div>
        )}

        {/* ── Tregludec warning ── */}
        {data && !data.today_tregludec && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r)',
            background: 'var(--warn-soft)', border: '1px solid #e0b87a',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div className="col" style={{ flex: 1, gap: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7a5a15' }}>טרגלודק לא נרשם היום</span>
              <span className="muted" style={{ fontSize: 12 }}>רשמי בדף ההזרקה →</span>
            </div>
          </div>
        )}

        {/* ── Today's timeline ── */}
        {timelineEvents.length > 0 && (
          <div>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="label">ציר היום</span>
              <span className="muted" style={{ fontSize: 12 }}>{todayLabel}</span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {timelineEvents.map((ev, i) => (
                <div key={i}>
                  <TimelineEvent ev={ev}/>
                  {i < timelineEvents.length - 1 && <hr className="hr" style={{ marginInline: 14 }}/>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Hypo warning ── */}
        {stats.hypo_warning && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r)',
            background: 'var(--low-soft)', border: '1px solid var(--low)',
            fontSize: 13, color: '#7a3020',
          }}>
            ⚠️ {stats.hypo_warning}
          </div>
        )}

        {/* ── Sensor card ── */}
        {data && (
          <div className="card card-warm row-between" style={{ padding: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <SensorPie daysLeft={daysLeft ?? SENSOR_DAYS} total={SENSOR_DAYS}/>
              <div className="col" style={{ gap: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>חיישן Dexcom</span>
                {daysLeft !== null
                  ? <span className="muted" style={{ fontSize: 12 }}>נותרו {daysLeft} ימים</span>
                  : <span className="muted" style={{ fontSize: 12, color: 'var(--bad)' }}>לא נרשמה החלפה</span>}
              </div>
            </div>
            <button onClick={handleSensorReplace} disabled={replacingSensor} style={{
              border: '1px solid var(--hair)', background: 'var(--card)',
              borderRadius: 999, padding: '6px 12px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)',
            }}>
              {replacingSensor ? '...' : 'החלפתי 🔄'}
            </button>
          </div>
        )}

      </div>

      {/* Floating Ask Debi */}
      <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 4 }}>
        <AskDebi/>
      </div>

      <TabBar active="home"/>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickTile({ icon: Ico, label, sub, tint, color, onClick, compact = false }) {
  return (
    <div className="card" onClick={onClick}
         style={{ padding: compact ? 10 : 14, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{
        width: compact ? 28 : 36, height: compact ? 28 : 36,
        borderRadius: compact ? 8 : 12, background: tint, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: compact ? 6 : 10,
      }}>
        <Ico size={compact ? 15 : 20} stroke={1.8}/>
      </div>
      <div style={{ fontSize: compact ? 11 : 14, fontWeight: 700 }}>{label}</div>
      {!compact && sub && <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

const ICOMAP = {
  meal: { Ico: IconMeal,    color: 'var(--brand)',  bg: 'var(--brand-tint)' },
  inj:  { Ico: IconSyringe, color: 'var(--brand)',  bg: 'var(--brand-tint)' },
  long: { Ico: IconBolt,    color: 'var(--ink-2)',  bg: 'var(--bg-warm)'    },
}

function TimelineEvent({ ev, compact = false }) {
  const { Ico, color, bg } = ICOMAP[ev.type] || ICOMAP.meal
  if (compact) {
    return (
      <div className="row" style={{ padding: '8px 10px', gap: 8, alignItems: 'center' }}>
        <span className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, minWidth: 32 }}>{ev.time}</span>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Ico size={14} stroke={1.8}/>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
        <span style={{ fontSize: 11, color: 'var(--brand-deep)', fontWeight: 600, flexShrink: 0 }}>{ev.dose}</span>
      </div>
    )
  }
  return (
    <div className="row" style={{ padding: '14px 14px', gap: 12, alignItems: 'flex-start' }}>
      <span className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, minWidth: 38, paddingTop: 4 }}>
        {ev.time}
      </span>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ico size={18} stroke={1.8}/>
      </div>
      <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{ev.title}</div>
        {ev.sub  && <span className="muted" style={{ fontSize: 12 }}>{ev.sub}</span>}
        {ev.dose && <span style={{ fontSize: 12, color: 'var(--brand-deep)', fontWeight: 600, marginTop: 1 }}>{ev.dose}</span>}
      </div>
    </div>
  )
}
