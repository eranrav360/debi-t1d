import { useState, useEffect } from 'react'
import { recordNovorapid, recordTregludec, updatePostSugar, getTregludecHistory } from '../api'
import { ScreenShell } from '../components/ScreenShell'
import { GL } from '../components/Bits'

const GLUC_BASE = (import.meta.env.VITE_API_URL || '') + '/api/glucose'

function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function RecordInjection() {
  const [type, setType] = useState('novorapid')

  // NovoRapid fields
  const [preSugar,         setPreSugar]         = useState('')
  const [dose,             setDose]             = useState('')
  const [notes,            setNotes]            = useState('')
  const [recordedAt,       setRecordedAt]       = useState(nowLocal())
  const [saved,            setSaved]            = useState(null)
  const [postSugar,        setPostSugar]        = useState('')
  const [postUpdated,      setPostUpdated]      = useState(false)
  const [isNovoPast,       setIsNovoPast]       = useState(false)
  const [novoGlucLoading,  setNovoGlucLoading]  = useState(false)

  // Tregludec fields
  const [tregDose,        setTregDose]        = useState('')
  const [tregNotes,       setTregNotes]       = useState('')
  const [tregDate,        setTregDate]        = useState(todayISO())
  const [tregTime,        setTregTime]        = useState(nowTimeStr())
  const [tregSugar,       setTregSugar]       = useState('')
  const [tregSaved,       setTregSaved]       = useState(false)
  const [hadHypo,         setHadHypo]         = useState(false)
  const [isPast,          setIsPast]          = useState(false)   // "הזרקה קודמת" mode
  const [glucoseLoading,  setGlucoseLoading]  = useState(false)

  const [saving, setSaving] = useState(false)

  // Auto-fetch current glucose when novorapid tab is opened
  useEffect(() => {
    if (type !== 'novorapid') return
    setRecordedAt(nowLocal())
    setNovoGlucLoading(true)
    fetch(`${GLUC_BASE}/latest`)
      .then(r => r.json())
      .then(d => { if (d.reading?.value) setPreSugar(String(d.reading.value)) })
      .catch(() => {})
      .finally(() => setNovoGlucLoading(false))
  }, [type])

  // Auto-fetch current glucose + last dose when tregludec tab is opened
  useEffect(() => {
    if (type !== 'tregludec') return
    setGlucoseLoading(true)
    Promise.all([
      fetch(`${GLUC_BASE}/latest`).then(r => r.json()).catch(() => null),
      getTregludecHistory().catch(() => []),
    ]).then(([gluc, history]) => {
      if (gluc?.reading?.value) setTregSugar(String(gluc.reading.value))
      if (Array.isArray(history) && history.length > 0 && history[0].dose) {
        setTregDose(String(history[0].dose))
      }
    }).finally(() => setGlucoseLoading(false))
  }, [type])

  async function handleRecordNovo() {
    if (!dose || saving) return
    setSaving(true)
    const result = await recordNovorapid({
      total_carbs: 0,
      pre_sugar: preSugar ? parseInt(preSugar) : null,
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
    setIsNovoPast(false)
  }

  async function handleRecordTreg() {
    if (!tregDose || saving) return
    setSaving(true)
    await recordTregludec({
      dose: parseFloat(tregDose),
      notes: tregNotes,
      recorded_date: tregDate,
      recorded_time: tregTime,
      pre_sugar: tregSugar ? parseInt(tregSugar) : null,
      had_hypo_morning: hadHypo,
    })
    setTregSaved(true)
    setSaving(false)
  }

  function resetTreg() {
    setTregSaved(false)
    setTregDose('')
    setTregNotes('')
    setTregDate(todayISO())
    setTregTime(nowTimeStr())
    setHadHypo(false)
    setIsPast(false)
    // keep tregSugar as-is (current glucose still relevant)
  }

  return (
    <ScreenShell title="רישום הזרקה" tab="more">

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
            {/* ── Auto-captured values ── */}
            {!isNovoPast && (
              <div style={{
                display: 'flex', gap: 10, marginBottom: 14,
                padding: '12px 14px', background: 'var(--bg-warm)',
                borderRadius: 12, border: '1px solid var(--hair)',
              }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>סוכר נוכחי</div>
                  {novoGlucLoading ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>…</div>
                  ) : preSugar ? (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: GL.color(parseInt(preSugar)) }}>
                        {preSugar}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>mg/dL</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>לא זמין</div>
                  )}
                </div>
                <div style={{ width: 1, background: 'var(--hair)' }}/>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>שעה</div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontFamily: 'monospace' }}>
                    {recordedAt.slice(11, 16)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{recordedAt.slice(0, 10)}</div>
                </div>
              </div>
            )}

            {/* ── Past injection toggle ── */}
            <button
              onClick={() => {
                setIsNovoPast(v => !v)
                if (!isNovoPast) {
                  setPreSugar('')
                  setRecordedAt(nowLocal())
                }
              }}
              style={{
                width: '100%', marginBottom: 14,
                border: `1px solid ${isNovoPast ? 'var(--brand)' : 'var(--hair)'}`,
                background: isNovoPast ? 'var(--brand-tint)' : 'transparent',
                borderRadius: 10, padding: '9px 14px',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: isNovoPast ? 'var(--brand-deep)' : 'var(--ink-3)',
                cursor: 'pointer', textAlign: 'right', transition: 'all .15s',
              }}
            >
              ⏰ {isNovoPast ? '✓ הזרקה קודמת — ערוך ידנית' : 'הזרקה קודמת? לחצי לשינוי שעה / סוכר'}
            </button>

            {/* ── Past injection fields ── */}
            {isNovoPast && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>תאריך ושעה</label>
                    <input type="datetime-local" value={recordedAt}
                           onChange={e => setRecordedAt(e.target.value)} className="input"/>
                  </div>
                </div>
                <div className="form-group">
                  <label>סוכר לפני הזרקה (mg/dL)</label>
                  <input type="number" value={preSugar} onChange={e => setPreSugar(e.target.value)}
                         placeholder="לדוג׳ 150" className="input"/>
                </div>
              </>
            )}

            {/* ── Dose ── */}
            <div className="form-group">
              <label>מינון (יחידות)</label>
              <input type="number" step="0.5" value={dose} onChange={e => setDose(e.target.value)}
                     placeholder="לדוג׳ 3" className="input"/>
            </div>

            {/* ── What to eat ── */}
            <div className="form-group">
              <label>מה מתוכנן לאכול</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                     placeholder="לדוג׳ לחם, סלט, קוטג׳..." className="input"/>
            </div>

            <button onClick={handleRecordNovo} disabled={!dose || saving}
                    className="btn btn-primary btn-full">
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
            {/* ── Auto-captured values ── */}
            {!isPast && (
              <div style={{
                display: 'flex', gap: 10, marginBottom: 14,
                padding: '12px 14px', background: 'var(--bg-warm)',
                borderRadius: 12, border: '1px solid var(--hair)',
              }}>
                {/* Current sugar */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>סוכר נוכחי</div>
                  {glucoseLoading ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>…</div>
                  ) : tregSugar ? (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: GL.color(parseInt(tregSugar)) }}>
                        {tregSugar}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>mg/dL</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>לא זמין</div>
                  )}
                </div>
                <div style={{ width: 1, background: 'var(--hair)' }}/>
                {/* Current time */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>שעה</div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontFamily: 'monospace' }}>
                    {tregTime}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{tregDate}</div>
                </div>
              </div>
            )}

            {/* ── Past injection toggle ── */}
            <button
              onClick={() => {
                setIsPast(v => !v)
                if (!isPast) {
                  // switching to past mode — clear auto values so user fills them
                  setTregDate(todayISO())
                  setTregTime('')
                  setTregSugar('')
                }
              }}
              style={{
                width: '100%', marginBottom: 14,
                border: `1px solid ${isPast ? 'var(--brand)' : 'var(--hair)'}`,
                background: isPast ? 'var(--brand-tint)' : 'transparent',
                borderRadius: 10, padding: '9px 14px',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: isPast ? 'var(--brand-deep)' : 'var(--ink-3)',
                cursor: 'pointer', textAlign: 'right', transition: 'all .15s',
              }}
            >
              ⏰ {isPast ? '✓ הזרקה קודמת — ערוך ידנית' : 'הזרקה קודמת? לחצי לשינוי שעה / סוכר'}
            </button>

            {/* ── Past injection fields ── */}
            {isPast && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>תאריך</label>
                    <input type="date" value={tregDate} onChange={e => setTregDate(e.target.value)} className="input"/>
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>שעה</label>
                    <input type="time" value={tregTime} onChange={e => setTregTime(e.target.value)} className="input"/>
                  </div>
                </div>
                <div className="form-group">
                  <label>סוכר בזמן ההזרקה (mg/dL)</label>
                  <input type="number" value={tregSugar} onChange={e => setTregSugar(e.target.value)}
                         placeholder="לדוג׳ 145" className="input"/>
                </div>
              </>
            )}

            {/* ── Dose ── */}
            <div className="form-group">
              <label>מינון יומי (יחידות)</label>
              <input type="number" step="0.5" value={tregDose}
                     onChange={e => setTregDose(e.target.value)}
                     placeholder="לדוג׳ 10" className="input"/>
            </div>

            {/* ── Notes ── */}
            <div className="form-group">
              <label>הערות (אופציונלי)</label>
              <input type="text" value={tregNotes}
                     onChange={e => setTregNotes(e.target.value)} className="input"/>
            </div>

            {/* ── Hypo checkbox ── */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: hadHypo ? '#FEF3C7' : 'var(--gray-50)',
              borderRadius: 10, marginBottom: 12, cursor: 'pointer',
              border: `1px solid ${hadHypo ? '#F59E0B' : 'var(--gray-200)'}`,
              transition: 'all 0.15s',
            }}>
              <input type="checkbox" checked={hadHypo} onChange={e => setHadHypo(e.target.checked)}
                     style={{ width: 18, height: 18, cursor: 'pointer' }}/>
              <span style={{ fontSize: 14 }}>
                ⚠️ <strong>היפוגליקמיה הבוקר</strong>
                <span style={{ fontSize: 12, color: 'var(--gray-500)', display: 'block', marginTop: 2 }}>
                  סוכר נמוך הבוקר לאחר מנת הטרגלודק האחרונה
                </span>
              </span>
            </label>

            <button onClick={handleRecordTreg} disabled={!tregDose || saving}
                    className="btn btn-primary btn-full">
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
    </ScreenShell>
  )
}
