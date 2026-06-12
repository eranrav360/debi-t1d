import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReport } from '../api'
import { TabBar } from '../components/Bits'
import { IconChev } from '../components/Icons'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`
}

const TYPE_STYLE = {
  'ארוחה + הזרקה':  { bg: '#FFF0E6', color: '#D97420' },
  'הזרקת נובורפיד': { bg: '#E8F8EE', color: '#208040' },
  'טרגלודק':         { bg: '#EEF2FF', color: '#4338CA' },
  'ארוחה חופשית':   { bg: '#FEF9C3', color: '#92400E' },
}

const PRESETS = [
  { label: 'שבוע',    days: 7  },
  { label: 'חודש',    days: 30 },
  { label: '3 חודשים', days: 90 },
]

const COL_HEADERS = ['תאריך', 'שעה', 'סוג אירוע', 'סוכר mg/dL', 'מינון יח׳', 'תוכן']

export default function ReportPage() {
  const navigate = useNavigate()
  const [from,    setFrom]    = useState(() => daysAgoStr(7))
  const [to,      setTo]      = useState(todayStr)
  const [events,  setEvents]  = useState(null)
  const [loading, setLoading] = useState(false)

  async function fetchReport() {
    if (!from || !to) return
    setLoading(true)
    setEvents(null)
    try {
      const data = await getReport(from, to)
      setEvents(Array.isArray(data.events) ? data.events : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  // ── Table (shared between screen and print) ──────────────────────────────
  function ReportTable() {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: 13 }}>
        <thead>
          <tr>
            {COL_HEADERS.map(h => (
              <th key={h} style={{
                padding: '8px 10px', background: 'var(--bg-warm)',
                borderBottom: '2px solid var(--hair)', textAlign: 'right',
                whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-2)', fontWeight: 700,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const s = TYPE_STYLE[ev.type] || { bg: 'var(--bg-warm)', color: 'var(--ink-2)' }
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)' }}>
                <td style={TD}>{fmtDate(ev.date)}</td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{ev.time || '—'}</td>
                <td style={TD}>
                  <span style={{
                    background: s.bg, color: s.color,
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>{ev.type}</span>
                </td>
                <td style={{ ...TD, textAlign: 'center', fontFamily: 'monospace' }}>{ev.sugar ?? '—'}</td>
                <td style={{ ...TD, textAlign: 'center', fontFamily: 'monospace' }}>{ev.dose != null ? `${ev.dose}` : '—'}</td>
                <td style={{ ...TD, color: 'var(--ink-2)', maxWidth: 220, wordBreak: 'break-word' }}>{ev.content || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <>
      {/* ── Print CSS ───────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; font-family: Arial, sans-serif; direction: rtl; }
          #rpt-header { display: block !important; padding: 0 0 10px; border-bottom: 2px solid #333; margin-bottom: 12px; }
          #rpt-table  { display: block !important; }
          #rpt-table table { width: 100%; border-collapse: collapse; font-size: 10px; direction: rtl; }
          #rpt-table th { background: #F3F4F6 !important; font-weight: 700; border: 1px solid #D1D5DB; padding: 5px 7px; text-align: right; }
          #rpt-table td { border: 1px solid #E5E7EB; padding: 4px 7px; text-align: right; vertical-align: top; }
          #rpt-table tr:nth-child(even) td { background: #F9FAFB; }
          span[data-badge] { border: 1px solid currentColor !important; background: white !important; }
          @page { size: A4 landscape; margin: 1.5cm 1.5cm 1.5cm 1.5cm; }
        }
        @media screen {
          #rpt-header, #rpt-table { display: none; }
        }
      `}</style>

      {/* ── Print-only output (invisible on screen) ─────────────────────────── */}
      <div id="rpt-header">
        <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>דוח אירועים — תהל</h2>
        <p style={{ margin: 0, fontSize: 11, color: '#555' }}>
          {fmtDate(from)} עד {fmtDate(to)} · {events?.length ?? 0} אירועים
        </p>
      </div>
      <div id="rpt-table">
        {events && events.length > 0 && <ReportTable/>}
      </div>

      {/* ── Screen UI ───────────────────────────────────────────────────────── */}
      <div className="app no-print">

        {/* Header */}
        <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => navigate(-1)} style={{
            border: 0, background: 'var(--card)', borderRadius: 999, width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <IconChev size={18}/>
          </button>
          <span className="serif" style={{ fontSize: 18, fontWeight: 500 }}>דוח תקופתי</span>
          <div style={{ width: 38 }}/>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '8px var(--pad) 140px', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

          {/* ── Date range card ── */}
          <div className="card" style={{ padding: 16 }}>
            <span className="label" style={{ marginBottom: 12, display: 'block' }}>טווח תאריכים</span>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>מ-</span>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={DATE_INPUT}/>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>עד</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={DATE_INPUT}/>
              </div>
            </div>

            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESETS.map(p => (
                <button key={p.days} onClick={() => { setFrom(daysAgoStr(p.days)); setTo(todayStr()) }} style={{
                  border: '1px solid var(--hair)', background: 'var(--bg)',
                  borderRadius: 999, padding: '5px 12px', fontFamily: 'inherit',
                  fontSize: 12, cursor: 'pointer', color: 'var(--ink-2)',
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div className="muted" style={{ textAlign: 'center', padding: 24 }}>טוען נתונים…</div>
          )}

          {/* ── Results ── */}
          {events && !loading && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label">{events.length} אירועים</span>
                <span className="muted" style={{ fontSize: 12 }}>{fmtDate(from)} – {fmtDate(to)}</span>
              </div>

              {events.length === 0 ? (
                <div className="card" style={{ padding: 28, textAlign: 'center' }}>
                  <span className="muted">לא נמצאו אירועים בטווח הזה</span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                  <ReportTable/>
                </div>
              )}
            </>
          )}
        </div>
        </div>

        {/* ── Sticky CTAs ── */}
        <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 5, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events && events.length > 0 && (
            <button onClick={() => window.print()} style={{
              width: '100%', padding: 14, fontSize: 15, border: 'none',
              background: 'var(--ink)', color: '#fff', borderRadius: 14,
              fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer',
            }}>
              🖨️ ייצוא PDF
            </button>
          )}
          <button className="btn btn-brand" style={{ width: '100%', padding: 14, fontSize: 15 }}
                  onClick={fetchReport} disabled={loading || !from || !to}>
            {loading ? 'טוען…' : '📊 הפק דוח'}
          </button>
        </div>

        <TabBar active="more"/>
      </div>
    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const TD = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--hair)',
  whiteSpace: 'nowrap',
}

const DATE_INPUT = {
  width: '100%', border: '1.5px solid var(--hair)', borderRadius: 10,
  padding: '9px 10px', fontFamily: 'inherit', fontSize: 14,
  background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
  boxSizing: 'border-box',
}
