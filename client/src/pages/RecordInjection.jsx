import { useState } from 'react'
import { recordNovorapid, recordTregludec, updatePostSugar } from '../api'

function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function RecordInjection() {
  const [type, setType] = useState('novorapid')

  // NovoRapid fields
  const [preSugar, setPreSugar] = useState('')
  const [dose, setDose] = useState('')
  const [notes, setNotes] = useState('')
  const [recordedAt, setRecordedAt] = useState(nowLocal())
  const [saved, setSaved] = useState(null)
  const [postSugar, setPostSugar] = useState('')
  const [postUpdated, setPostUpdated] = useState(false)

  // Tregludec fields
  const [tregDose, setTregDose] = useState('')
  const [tregNotes, setTregNotes] = useState('')
  const [tregDate, setTregDate] = useState(todayISO())
  const [tregSaved, setTregSaved] = useState(false)

  const [saving, setSaving] = useState(false)

  async function handleRecordNovo() {
    if (!dose || !preSugar || saving) return
    setSaving(true)
    const result = await recordNovorapid({
      total_carbs: 0,
      pre_sugar: parseInt(preSugar),
      dose_given: parseFloat(dose),
      notes,
      meal_items: [],
      recorded_at: recordedAt.replace('T', ' ')
    })
    setSaved(result)
    setSaving(false)
  }

  async function handleUpdatePost() {
    if (!saved || !postSugar) return
    await updatePostSugar(saved.id, parseInt(postSugar))
    setPostUpdated(true)
    setPostSugar('')
  }

  function resetNovo() {
    setSaved(null)
    setPostUpdated(false)
    setPreSugar('')
    setDose('')
    setNotes('')
    setPostSugar('')
    setRecordedAt(nowLocal())
  }

  async function handleRecordTreg() {
    if (!tregDose || saving) return
    setSaving(true)
    await recordTregludec({ dose: parseFloat(tregDose), notes: tregNotes, recorded_date: tregDate })
    setTregSaved(true)
    setSaving(false)
  }

  function resetTreg() {
    setTregSaved(false)
    setTregDose('')
    setTregNotes('')
    setTregDate(todayISO())
  }

  return (
    <div className="page">
      <h1 className="page-title">💉 רישום הזרקה</h1>

      <div className="card">
        <div className="toggle-group" style={{ marginBottom: 16 }}>
          <button
            className={`toggle-btn ${type === 'novorapid' ? 'selected' : ''}`}
            onClick={() => { setType('novorapid'); resetNovo(); resetTreg() }}
          >
            💉 נובורפיד
            <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>אינסולין מהיר</div>
          </button>
          <button
            className={`toggle-btn ${type === 'tregludec' ? 'selected' : ''}`}
            onClick={() => { setType('tregludec'); resetNovo(); resetTreg() }}
          >
            💊 טרגלודק
            <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>אינסולין ארוך</div>
          </button>
        </div>

        {type === 'novorapid' && !saved && (
          <>
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
              <label>סוכר לפני הזרקה (mg/dL)</label>
              <input
                type="number"
                value={preSugar}
                onChange={e => setPreSugar(e.target.value)}
                placeholder="לדוג' 150"
                className="input"
              />
            </div>
            <div className="form-group">
              <label>מינון (יחידות)</label>
              <input
                type="number"
                step="0.5"
                value={dose}
                onChange={e => setDose(e.target.value)}
                placeholder="לדוג' 3"
                className="input"
              />
            </div>
            <div className="form-group">
              <label>הערות (אופציונלי)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="לדוג' תיקון בצום"
                className="input"
              />
            </div>
            <button
              onClick={handleRecordNovo}
              disabled={!preSugar || !dose || saving}
              className="btn btn-primary btn-full"
            >
              {saving ? 'שומר...' : 'רשום הזרקת נובורפיד'}
            </button>
          </>
        )}

        {type === 'novorapid' && saved && !postUpdated && (
          <>
            <div className="alert alert-success">
              ✓ נרשם! סוכר: {preSugar} · מינון: {dose} יחידות
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>סוכר לאחר שעה (mg/dL)</label>
              <input
                type="number"
                value={postSugar}
                onChange={e => setPostSugar(e.target.value)}
                placeholder="מלא אחרי ~שעה"
                className="input"
              />
            </div>
            <div className="form-row">
              <button onClick={handleUpdatePost} disabled={!postSugar} className="btn btn-primary">
                עדכן סוכר
              </button>
              <button onClick={resetNovo} className="btn btn-outline">
                הזרקה חדשה
              </button>
            </div>
          </>
        )}

        {type === 'novorapid' && postUpdated && (
          <>
            <div className="alert alert-success">✓ הסוכר לאחר שעה עודכן בהצלחה!</div>
            <button onClick={resetNovo} className="btn btn-outline btn-full">רשום הזרקה נוספת</button>
          </>
        )}

        {type === 'tregludec' && !tregSaved && (
          <>
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              💡 טרגלודק הוא אינסולין ארוך-טווח. ניתן פעם ביום, בדרך כלל בשעה קבועה.
            </div>
            <div className="form-group">
              <label>תאריך</label>
              <input
                type="date"
                value={tregDate}
                onChange={e => setTregDate(e.target.value)}
                className="input"
              />
            </div>
            <div className="form-group">
              <label>מינון יומי (יחידות)</label>
              <input
                type="number"
                step="0.5"
                value={tregDose}
                onChange={e => setTregDose(e.target.value)}
                placeholder="לדוג' 10"
                className="input"
              />
            </div>
            <div className="form-group">
              <label>הערות (אופציונלי)</label>
              <input
                type="text"
                value={tregNotes}
                onChange={e => setTregNotes(e.target.value)}
                className="input"
              />
            </div>
            <button
              onClick={handleRecordTreg}
              disabled={!tregDose || saving}
              className="btn btn-primary btn-full"
            >
              {saving ? 'שומר...' : 'רשום הזרקת טרגלודק'}
            </button>
          </>
        )}

        {type === 'tregludec' && tregSaved && (
          <>
            <div className="alert alert-success">✓ הזרקת טרגלודק נרשמה! מינון: {tregDose} יחידות</div>
            <button onClick={resetTreg} className="btn btn-outline btn-full">רשום שוב</button>
          </>
        )}
      </div>
    </div>
  )
}
