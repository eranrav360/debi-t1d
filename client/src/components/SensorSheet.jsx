import { useEffect, useRef, useState } from 'react'
import { IconCamera, IconCheck } from './Icons'
import { readSensorSerial } from '../lib/sensorCode'

const SERIAL_RE   = /^[0-9A-Za-z]{4,20}$/
const SENSOR_DAYS = 10
const fmtDate = (d) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`

// Warn when the sensor expires before the 10 days of wear are over
function expiryWarning(expiry) {
  if (!expiry) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((expiry - today) / 86_400_000)
  if (days < 0) return { level: 'bad', text: `⛔ תוקף החיישן פג ב-${fmtDate(expiry)}. עדיף לא להשתמש בו.` }
  if (days < SENSOR_DAYS) return { level: 'warn', text: `⚠️ תוקף החיישן יפוג ב-${fmtDate(expiry)}, לפני שיסתיימו 10 ימי השימוש.` }
  return null
}

// Bottom sheet for "החלפתי": optional photo of the sensor → serial (21) from its barcode → save
export default function SensorSheet({ latestSerial, onSave, onClose }) {
  const fileRef = useRef(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [status,   setStatus]   = useState('idle') // idle | reading | found | notfound | error
  const [serial,   setSerial]   = useState('')
  const [expiry,   setExpiry]   = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [inputKey, setInputKey] = useState(0)     // fresh <input> so the same photo can be retaken

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    setInputKey(k => k + 1)
    if (!file) return
    setPhotoUrl(URL.createObjectURL(file))
    setStatus('reading')
    setExpiry(null)
    try {
      const res = await readSensorSerial(file)
      if (res) { setSerial(res.serial); setExpiry(res.expiry); setStatus('found') }
      else setStatus('notfound')
    } catch {
      setStatus('error')
    }
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try { await onSave(serial.trim() || null) } finally { setSaving(false) }
  }

  const clean     = serial.trim()
  const invalid   = clean !== '' && !SERIAL_RE.test(clean)
  const duplicate = clean !== '' && clean === latestSerial
  const showInput = status !== 'idle' && status !== 'reading'
  const expWarn   = expiryWarning(expiry)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(34,28,22,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sensor-sheet-title" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, background: 'var(--card)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0', boxShadow: 'var(--sh-2)',
        padding: '18px var(--pad) calc(18px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflow: 'auto',
      }}>
        <div className="row-between">
          <span id="sensor-sheet-title" className="serif" style={{ fontSize: 18, fontWeight: 500 }}>החלפת חיישן</span>
          <button onClick={onClose} aria-label="סגירה" style={{
            border: 0, background: 'var(--bg-warm)', borderRadius: 999, width: 34, height: 34,
            cursor: 'pointer', fontSize: 18, color: 'var(--ink-2)', lineHeight: 1,
          }}>×</button>
        </div>

        <span className="muted" style={{ fontSize: 13 }}>
          צלמי את המכסה של החיישן החדש, כך שהברקוד המרובע ייראה בבירור. מספר החיישן יזוהה אוטומטית.
        </span>

        <input key={inputKey} ref={fileRef} type="file" accept="image/*" capture="environment"
               onChange={handlePhoto} style={{ display: 'none' }}/>

        {photoUrl ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={photoUrl} alt="תמונת החיישן" style={{
              width: 84, height: 84, objectFit: 'cover', borderRadius: 'var(--r-sm)', flexShrink: 0,
            }}/>
            <div className="col" style={{ gap: 6, flex: 1 }}>
              <span role="status" style={{
                fontSize: 14, fontWeight: 600,
                color: status === 'found' ? 'var(--good)' : status === 'reading' ? 'var(--ink-2)' : 'var(--bad)',
              }}>
                {status === 'reading'  && 'מזהה את הברקוד…'}
                {status === 'found'    && <><IconCheck size={14}/> מספר החיישן זוהה</>}
                {status === 'notfound' && 'לא הצלחנו לזהות את הברקוד'}
                {status === 'error'    && 'משהו השתבש בקריאת התמונה'}
              </span>
              <button className="btn btn-soft" onClick={() => fileRef.current?.click()} disabled={status === 'reading'}
                      style={{ minHeight: 36, padding: '6px 14px', fontSize: 13, alignSelf: 'flex-start' }}>
                צילום מחדש
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-brand" onClick={() => fileRef.current?.click()}>
            <IconCamera size={18}/> צילום החיישן
          </button>
        )}

        {expWarn && (
          <div role="alert" style={{
            fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 'var(--r-sm)',
            background: expWarn.level === 'bad' ? 'var(--bad-soft)' : 'var(--warn-soft)',
            color: expWarn.level === 'bad' ? 'var(--bad)' : '#7A5414',
          }}>
            {expWarn.text}
          </div>
        )}

        {(showInput || !photoUrl) && (
          <label className="col" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              מספר חיישן <span className="muted" style={{ fontWeight: 400 }}>(השורה שמתחילה ב-21)</span>
            </span>
            <input className="input" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={20}
                   value={serial} onChange={e => setSerial(e.target.value.replace(/\s/g, ''))}
                   placeholder={status === 'notfound' || status === 'error' ? 'אפשר להקליד ידנית' : 'לא חובה'}
                   style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 1 }}/>
            {invalid   && <span style={{ fontSize: 12, color: 'var(--bad)' }}>4–20 ספרות או אותיות באנגלית</span>}
            {duplicate && <span style={{ fontSize: 12, color: 'var(--warn)' }}>⚠️ זה המספר של החיישן הנוכחי. בטוח שצילמת את החדש?</span>}
          </label>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || invalid || status === 'reading'} style={{ flex: 1 }}>
            {saving ? 'שומר…' : clean ? 'שמירת החלפה' : 'שמירה בלי מספר חיישן'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
