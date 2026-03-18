import { useState } from 'react'
import { recordFreeMeal, updateFreeMealPostSugar } from '../api'
import SugarBadge from '../components/SugarBadge'

function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function FreeMeal() {
  const [recordedAt, setRecordedAt] = useState(nowLocal())
  const [carbs, setCarbs] = useState('')
  const [preSugar, setPreSugar] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(null)
  const [postSugar, setPostSugar] = useState('')
  const [postUpdated, setPostUpdated] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!preSugar || saving) return
    setSaving(true)
    const result = await recordFreeMeal({
      recorded_at: recordedAt.replace('T', ' '),
      carbs: parseFloat(carbs) || 0,
      pre_sugar: parseInt(preSugar),
      notes
    })
    setSaved(result)
    setSaving(false)
  }

  async function handleUpdatePost() {
    if (!saved || !postSugar) return
    await updateFreeMealPostSugar(saved.id, parseInt(postSugar))
    setPostUpdated(true)
    setPostSugar('')
  }

  function startNew() {
    setSaved(null)
    setPostUpdated(false)
    setRecordedAt(nowLocal())
    setCarbs('')
    setPreSugar('')
    setNotes('')
  }

  return (
    <div className="page">
      <h1 className="page-title">🥗 ארוחה ללא הזרקה</h1>

      {saved && !postUpdated && (
        <div className="card" style={{ borderColor: 'var(--success)', borderWidth: 2 }}>
          <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 8 }}>
            ✓ הארוחה נרשמה!
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 4 }}>
            סוכר לפני: <SugarBadge value={parseInt(preSugar)} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 12 }}>
            עדכן רמת סוכר שעה לאחר מכן:
          </div>
          <div className="form-row">
            <input
              type="number"
              value={postSugar}
              onChange={e => setPostSugar(e.target.value)}
              placeholder="mg/dL"
              className="input input-num"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleUpdatePost()}
            />
            <button onClick={handleUpdatePost} disabled={!postSugar} className="btn btn-primary">
              עדכן
            </button>
            <button onClick={startNew} className="btn btn-outline btn-sm">
              ארוחה חדשה
            </button>
          </div>
        </div>
      )}

      {postUpdated && (
        <div className="alert alert-success">
          ✓ הסוכר עודכן בהצלחה!
          <button onClick={startNew} className="btn btn-outline btn-sm" style={{ marginRight: 10 }}>ארוחה חדשה</button>
        </div>
      )}

      {!saved && (
        <div className="card">
          <div className="card-title">פרטי הארוחה</div>

          <div className="form-group">
            <label>תאריך ושעה</label>
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={e => setRecordedAt(e.target.value)}
              className="input"
            />
          </div>

          <div className="form-group">
            <label>סוכר לפני אכילה (mg/dL)</label>
            <input
              type="number"
              value={preSugar}
              onChange={e => setPreSugar(e.target.value)}
              placeholder="לדוג' 110"
              className="input input-num"
            />
          </div>

          <div className="form-group">
            <label>פחמימות (גרם) — אופציונלי</label>
            <input
              type="number"
              value={carbs}
              onChange={e => setCarbs(e.target.value)}
              placeholder="לדוג' 30"
              className="input input-num"
            />
          </div>

          <div className="form-group">
            <label>הערות (אופציונלי)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="מה אכלת?"
              className="input"
              rows={2}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!preSugar || saving}
            className="btn btn-success"
            style={{ width: '100%', marginTop: 8 }}
          >
            {saving ? 'שומר...' : 'שמור ✓'}
          </button>
        </div>
      )}

      <div className="alert alert-info" style={{ fontSize: 13 }}>
        ℹ️ רשמי כאן ארוחות שבהן <strong>לא הזרקת אינסולין</strong> — למשל ארוחות דלות פחמימות.
        מדידת הסוכר לפני ואחרי שעה תאפשר להבין את תגובת הגוף ללא אינסולין.
      </div>
    </div>
  )
}
