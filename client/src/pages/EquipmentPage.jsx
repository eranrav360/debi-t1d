import { useState, useEffect } from 'react'
import { ScreenShell } from '../components/ScreenShell'

const BASE = import.meta.env.VITE_API_BASE || ''
const CYCLE = 90

function daysUntil(iso) {
  if (!iso) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due   = new Date(iso); due.setHours(0,0,0,0)
  return Math.round((due - today) / 86_400_000)
}

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function EquipmentPage() {
  const [records,  setRecords]  = useState([])
  const [nextDue,  setNextDue]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [notes,    setNotes]    = useState('')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/equipment`)
      const d = await r.json()
      setRecords(d.records || [])
      setNextDue(d.next_due || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRecord() {
    setSaving(true)
    try {
      await fetch(`${BASE}/api/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      setNotes('')
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const days   = daysUntil(nextDue)
  const urgent = days !== null && days <= 14
  const overdue = days !== null && days < 0

  const statusColor = overdue
    ? 'var(--bad)'
    : urgent
      ? 'var(--warn)'
      : 'var(--good)'

  const statusBg = overdue
    ? 'var(--bad-soft, #FFEAEA)'
    : urgent
      ? 'var(--warn-soft)'
      : 'var(--good-soft)'

  let daysLabel = ''
  if (days === null)    daysLabel = 'לא נרשם איסוף עדיין'
  else if (overdue)     daysLabel = `באיחור של ${-days} ימים`
  else if (days === 0)  daysLabel = 'היום!'
  else                  daysLabel = `בעוד ${days} ימים`

  return (
    <ScreenShell title="ציוד רפואי" sub="קופת חולים · כל 3 חודשים" tab="more">

      {/* Status card */}
      <div className="card" style={{ background: statusBg, border: `1.5px solid ${statusColor}`, padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: statusColor, fontWeight: 600, marginBottom: 4 }}>
          איסוף ציוד הבא
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: statusColor, marginBottom: 2 }}>
          {nextDue ? fmt(nextDue) : '—'}
        </div>
        <div style={{ fontSize: 15, color: statusColor, fontWeight: 500 }}>
          {daysLabel}
        </div>
      </div>

      {/* Record collection */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: 'var(--brand)', color: '#fff',
            border: 0, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          📦 קלטתי ציוד היום
        </button>
      ) : (
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group">
            <label>הערות (אופציונלי)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="למשל: חיישנים, עטים, מחסניות..."
              rows={2}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRecord}
              disabled={saving}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                background: 'var(--brand)', color: '#fff',
                border: 0, fontSize: 15, fontWeight: 700,
                cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'שומר...' : 'אישור'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNotes('') }}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'var(--card)', color: 'var(--ink-2)',
                border: '1.5px solid var(--hair)', fontSize: 15,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {!loading && records.length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          <span className="label" style={{ paddingInline: 4 }}>היסטוריית איסוף</span>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {records.map((r, i) => {
              const colDate = String(r.collected_at).slice(0, 10)
              const nextForThis = (() => {
                const d = new Date(colDate)
                d.setDate(d.getDate() + CYCLE)
                return fmt(d.toISOString().slice(0, 10))
              })()
              return (
                <div key={r.id}>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(colDate)}</div>
                        {r.notes ? <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{r.notes}</div> : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'left', marginTop: 2 }}>
                        הבא: {nextForThis}
                      </div>
                    </div>
                  </div>
                  {i < records.length - 1 && <hr className="hr" style={{ marginInline: 14 }}/>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="muted" style={{ textAlign: 'center', fontSize: 13, paddingTop: 8 }}>
          לא נרשמו איסופים עדיין
        </div>
      )}

    </ScreenShell>
  )
}
