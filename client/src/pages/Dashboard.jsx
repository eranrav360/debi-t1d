import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, recordSensorChange } from '../api'
import { useGlucose } from '../hooks/useGlucose'
import { GL, Sparkline, SensorPie, AskDebi, TabBar } from '../components/Bits'
import { IconMeal, IconSyringe, IconCamera, IconHeart, IconBolt, IconArrow, IconChev } from '../components/Icons'

const SENSOR_DAYS = 10

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
  if (mins < 1)  return 'עכשיו'
  if (mins === 1) return 'לפני דקה'
  return `לפני ${mins} דקות`
}

function sensorDaysLeft(latest) {
  if (!latest) return null
  const changed = new Date(latest.changed_at.replace(' ', 'T'))
  const expires = new Date(changed.getTime() + SENSOR_DAYS * 24 * 60 * 60 * 1000)
  const msLeft = expires - Date.now()
  return Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)))
}

function fmtTime(dt) {
  if (!dt) return ''
  return dt.slice(11, 16)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [replacingSensor, setReplacingSensor] = useState(false)

  const { currentReading, history, stats: glucoseStats, isStale, isConnected } = useGlucose({ historyHours: 3 })

  useEffect(() => {
    getDashboard().then(setData)
  }, [])

  async function handleSensorReplace() {
    setReplacingSensor(true)
    await recordSensorChange()
    const fresh = await getDashboard()
    setData(fresh)
    setReplacingSensor(false)
  }

  // Sparkline values: chronological order (history is newest-first from API)
  const sparkValues = [...history].reverse().map(r => r.value)
  const glColor = currentReading ? GL.color(currentReading.value) : 'var(--ink-4)'
  const dir = currentReading ? trendDir(currentReading.trend) : 'flat'

  // Today's timeline: merge novorapid + tregludec events sorted latest-first
  const today_novorapid = data?.today_novorapid || []
  const today_tregludec = data?.today_tregludec || null
  const timelineEvents = [
    ...today_novorapid.map(r => ({
      type: r.total_carbs > 0 ? 'meal' : 'inj',
      time: fmtTime(r.recorded_at),
      title: r.total_carbs > 0 ? 'ארוחה' : 'הזרקת נובורפיד',
      sub: r.meal_items?.map(m => m.food_name).join(', ') || (r.total_carbs > 0 ? `${r.total_carbs}ג׳ פחמימות` : ''),
      dose: `${r.dose_given} יח׳ נובורפיד`,
      ts: r.recorded_at || '',
    })),
    ...(today_tregludec ? [{
      type: 'long',
      time: '07:00',
      title: 'טרגלודק',
      sub: 'מנה יומית',
      dose: `${today_tregludec.dose} יח׳`,
      ts: (today_tregludec.recorded_date || '') + 'T07:00',
    }] : []),
  ].sort((a, b) => (b.ts > a.ts ? 1 : -1))

  const daysLeft = sensorDaysLeft(data?.latest_sensor)
  const today = new Date()
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const todayLabel = `${dayNames[today.getDay()]}, ${today.getDate()} ב${monthNames[today.getMonth()]}`

  const stats = data?.stats || {}

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

        {/* Live glucose card */}
        <div className="card" style={{ padding: 18, position: 'relative' }}>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div className="col" style={{ gap: 4 }}>
              <span className="label">סוכר עכשיו</span>
              {currentReading ? (
                <>
                  <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 2 }}>
                    <span className="bignum" style={{ fontSize: 76, color: glColor, lineHeight: 0.9, opacity: isStale ? 0.5 : 1 }}>
                      {currentReading.value}
                    </span>
                    <div className="col" style={{ alignItems: 'flex-start', gap: 2 }}>
                      <IconArrow dir={dir} size={22} color={glColor} stroke={2.6}/>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>mg/dL</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <span className={`pill ${GL.pillClass(currentReading.value)}`}>{GL.label(currentReading.value)}</span>
                    <span className="muted" style={{ fontSize: 12 }}>· {minsAgo(currentReading.timestamp)}</span>
                    {isStale && <span className="pill pill-warn">ישן</span>}
                    {!isConnected && !isStale && <span className="muted" style={{ fontSize: 11 }}>סריקה</span>}
                  </div>
                </>
              ) : (
                <div className="muted" style={{ fontSize: 15, paddingTop: 8 }}>⏳ ממתין לנתוני חיישן...</div>
              )}
            </div>

            {/* Sparkline */}
            {sparkValues.length > 1 && (
              <div style={{ textAlign: 'left', direction: 'ltr', flexShrink: 0 }}>
                <Sparkline values={sparkValues} width={130} height={58} color={glColor} band={[70, 180]} fill last/>
                <div style={{ direction: 'rtl', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>3 שעות אחרונות</div>
              </div>
            )}
          </div>
        </div>

        {/* TIR bar (24h) */}
        {glucoseStats && glucoseStats.readings > 0 && (() => {
          const low = glucoseStats.lowPct ?? 0
          const high = glucoseStats.highPct ?? 0
          const inRange = Math.max(0, 100 - low - high)
          return (
            <div>
              <div className="row-between" style={{ marginBottom: 6 }}>
                <span className="label">זמן בטווח · 24 שעות</span>
                <span className="tnum muted" style={{ fontSize: 11 }}>70–180 mg/dL</span>
              </div>
              <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 12, gap: 2 }}>
                {low > 0    && <div style={{ flex: low,     background: 'var(--cold)' }}/>}
                {inRange > 0 && <div style={{ flex: inRange, background: 'var(--good)' }}/>}
                {high > 0   && <div style={{ flex: high,    background: 'var(--warn)' }}/>}
              </div>
              <div className="row" style={{ marginTop: 6, gap: 14, fontSize: 11, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--cold)' }}>נמוך {low}%</span>
                <span style={{ color: 'var(--good)', fontWeight: 700 }}>בטווח {inRange}%</span>
                <span style={{ color: 'var(--warn)' }}>גבוה {high}%</span>
              </div>
            </div>
          )
        })()}

        {/* Quick tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--gap)' }}>
          <QuickTile icon={IconMeal}    label="ארוחה"   sub="חישוב מנה"         tint="var(--brand-tint)"  color="var(--brand)"   onClick={() => navigate('/meal')} />
          <QuickTile icon={IconSyringe} label="הזרקה"   sub="נובו / טרגלודק"   tint="var(--good-soft)"  color="var(--good)"    onClick={() => navigate('/injection')} />
          <QuickTile icon={IconCamera}  label="צילום"   sub="זיהוי פחמימות"    tint="#F2EBDD"           color="var(--ink-3)"   onClick={() => navigate('/camera')} />
        </div>

        {/* Tregludec warning */}
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

        {/* Today's timeline */}
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

        {/* Hypo warning */}
        {stats.hypo_warning && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r)',
            background: 'var(--cold-soft)', border: '1px solid var(--cold)',
            fontSize: 13, color: '#3F6584',
          }}>
            ⚠️ {stats.hypo_warning}
          </div>
        )}

        {/* Sensor card */}
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
            <button
              onClick={handleSensorReplace}
              disabled={replacingSensor}
              style={{
                border: '1px solid var(--hair)', background: 'var(--card)',
                borderRadius: 999, padding: '6px 12px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)',
              }}
            >
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

function QuickTile({ icon: Ico, label, sub, tint, color, onClick, beta }) {
  return (
    <div className="card" onClick={onClick}
         style={{ padding: 14, cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, background: tint, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
      }}>
        <Ico size={20} stroke={1.8}/>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{sub}</div>
      {beta && (
        <span style={{
          position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700,
          letterSpacing: '0.06em', background: 'var(--ink)', color: '#fff',
          padding: '2px 6px', borderRadius: 999,
        }}>BETA</span>
      )}
    </div>
  )
}

const ICOMAP = {
  meal: { Ico: IconMeal,    color: 'var(--brand)',  bg: 'var(--brand-tint)' },
  inj:  { Ico: IconSyringe, color: 'var(--brand)',  bg: 'var(--brand-tint)' },
  long: { Ico: IconBolt,    color: 'var(--ink-2)',  bg: 'var(--bg-warm)' },
}

function TimelineEvent({ ev }) {
  const { Ico, color, bg } = ICOMAP[ev.type] || ICOMAP.meal
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
        {ev.sub && <span className="muted" style={{ fontSize: 12 }}>{ev.sub}</span>}
        {ev.dose && <span style={{ fontSize: 12, color: 'var(--brand-deep)', fontWeight: 600, marginTop: 1 }}>{ev.dose}</span>}
      </div>
    </div>
  )
}
