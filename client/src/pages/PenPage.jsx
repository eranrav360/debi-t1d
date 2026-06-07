import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPens, addPen, discardPen, ocrPen } from '../api'
import { TabBar } from '../components/Bits'
import { IconCamera, IconCheck, IconChev } from '../components/Icons'

// Reuse the same image compressor from CameraPage
function compressImage(file, maxPx = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx }
        else                { width  = Math.round(width  * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      const b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      URL.revokeObjectURL(img.src)
      resolve(b64)
    }
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('failed')) }
    img.src = URL.createObjectURL(file)
  })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysUntil(dateStr) {
  const now  = new Date(); now.setHours(0, 0, 0, 0)
  const then = new Date(dateStr)
  return Math.ceil((then - now) / 86_400_000)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const PEN_CONFIG = {
  novorapid: { label: 'נובורפיד',  color: '#D97420', tint: '#FFF0E6', border: '#F4C49A' },
  tregludec: { label: 'טרגלודק',   color: '#208040', tint: '#E8F8EE', border: '#90D4A4' },
}

// ── Pen expiry badge ──────────────────────────────────────────────────────────

function ExpiryBadge({ daysLeft }) {
  if (daysLeft < 0)  return <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: 12 }}>פג תוקף</span>
  if (daysLeft === 0) return <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: 12 }}>פג היום</span>
  if (daysLeft <= 3)  return <span style={{ color: '#c05c0a', fontWeight: 700, fontSize: 12 }}>⚠️ {daysLeft} ימים</span>
  return <span style={{ color: '#166534', fontWeight: 600, fontSize: 12 }}>{daysLeft} ימים</span>
}

// ── Active pen card (list view) ───────────────────────────────────────────────

function PenCard({ pen, onDiscard }) {
  const cfg      = PEN_CONFIG[pen.pen_type] || PEN_CONFIG.novorapid
  const daysLeft = daysUntil(pen.expires_at)
  const isUrgent = daysLeft <= 3

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: isUrgent ? '#FFF5F5' : cfg.tint,
      border: `1px solid ${isUrgent ? '#FECACA' : cfg.border}`,
      padding: '14px 14px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: isUrgent ? '#991b1b' : cfg.color }}>
            {cfg.label}
          </div>
          {pen.pen_code && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>
              {pen.pen_code}
            </div>
          )}
        </div>
        <button
          onClick={() => onDiscard(pen.id)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#9ca3af', fontSize: 18, padding: '0 2px', lineHeight: 1, flexShrink: 0,
          }}
          title="הסר עט"
        >×</button>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, marginBottom: 6 }}>
        <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, (daysLeft / 30) * 100))}%`,
            background: isUrgent ? '#ef4444' : cfg.color,
            borderRadius: 999, transition: 'width .3s',
          }}/>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>פג ב-{formatDate(pen.expires_at)}</span>
        <ExpiryBadge daysLeft={daysLeft}/>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PenPage() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [pens,        setPens]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [mode,        setMode]        = useState('list')  // 'list' | 'new'
  const [step,        setStep]        = useState(1)       // 1=capture, 2=review, 3=done

  // New pen state
  const [inputKey,    setInputKey]    = useState(0)
  const [imageUrl,    setImageUrl]    = useState(null)
  const [imageB64,    setImageB64]    = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [analyzing,   setAnalyzing]   = useState(false)
  const [penType,     setPenType]     = useState('')
  const [penCode,     setPenCode]     = useState('')
  const [openedAt,    setOpenedAt]    = useState(todayStr())
  const [saving,      setSaving]      = useState(false)
  const [savedPen,    setSavedPen]    = useState(null)

  useEffect(() => {
    getPens().then(data => {
      setPens(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function startNew() {
    setMode('new')
    setStep(1)
    setImageUrl(null)
    setImageB64(null)
    setPenType('')
    setPenCode('')
    setOpenedAt(todayStr())
    setSavedPen(null)
  }

  function backToList() {
    setMode('list')
    getPens().then(data => setPens(Array.isArray(data) ? data : []))
  }

  async function handleCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setInputKey(k => k + 1)
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
    setImageB64(null)
    setCompressing(true)
    try {
      const b64 = await compressImage(file)
      setImageB64(b64)
    } catch {
      setImageUrl(null)
    } finally {
      setCompressing(false)
    }
  }

  async function analyzeImage() {
    if (!imageB64 || analyzing) return
    setAnalyzing(true)
    try {
      const result = await ocrPen(imageB64)
      if (result.code)     setPenCode(result.code)
      if (result.pen_type && result.pen_type !== 'unknown') setPenType(result.pen_type)
    } catch { /* ignore — user can fill manually */ }
    setAnalyzing(false)
    setStep(2)
  }

  async function handleSave() {
    if (!penType || saving) return
    setSaving(true)
    try {
      const result = await addPen({ pen_type: penType, pen_code: penCode, opened_at: openedAt })
      setSavedPen({ ...result, pen_type: penType, pen_code: penCode, opened_at: openedAt })
      setStep(3)
    } catch { /* show error? */ }
    setSaving(false)
  }

  async function handleDiscard(id) {
    await discardPen(id)
    setPens(p => p.filter(x => x.id !== id))
  }

  const expiresAt = addDays(openedAt, 30)

  // ── List mode ──────────────────────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <div className="app">
        <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate(-1)} style={{
            border: 0, background: 'var(--card)', borderRadius: 999,
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <IconChev size={18}/>
          </button>
          <span className="serif" style={{ fontSize: 18, fontWeight: 500, flex: 1 }}>עטים פתוחים</span>
          <button onClick={startNew} style={{
            border: 'none', background: 'var(--brand)', color: '#fff',
            borderRadius: 999, padding: '7px 14px', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>+ עט חדש</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px var(--pad) 100px', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {loading ? (
            <div className="muted" style={{ textAlign: 'center', paddingTop: 40 }}>טוען…</div>
          ) : pens.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              paddingTop: 60, color: 'var(--ink-3)',
            }}>
              <span style={{ fontSize: 40 }}>💉</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>אין עטים פתוחים</span>
              <span style={{ fontSize: 13 }}>פתחי עט חדש כדי לעקוב אחר תאריך הפקיעה</span>
              <button onClick={startNew} style={{
                marginTop: 8, border: 'none', background: 'var(--brand)', color: '#fff',
                borderRadius: 999, padding: '10px 24px', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>פתחי עט ראשון</button>
            </div>
          ) : (
            <>
              <span className="label">עטים פעילים — {pens.length}</span>
              {pens.map(pen => (
                <PenCard key={pen.id} pen={pen} onDiscard={handleDiscard}/>
              ))}
              <div className="muted" style={{ fontSize: 12, textAlign: 'center', paddingTop: 8 }}>
                לחצי × להסרת עט שסיימת להשתמש בו
              </div>
            </>
          )}
        </div>

        <TabBar active="more"/>
      </div>
    )
  }

  // ── New pen mode ───────────────────────────────────────────────────────────
  const cfg = PEN_CONFIG[penType] || null

  return (
    <div className="app">
      {/* Header */}
      <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={step > 1 ? () => setStep(s => s - 1) : backToList} style={{
          border: 0, background: 'var(--card)', borderRadius: 999, width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <IconChev size={18}/>
        </button>
        <span className="serif" style={{ fontSize: 18, fontWeight: 500 }}>עט חדש</span>
        <span className="tnum muted" style={{ fontSize: 12 }}>{step}/3</span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '6px var(--pad) 12px', flexShrink: 0 }}>
        <div style={{ height: 4, background: 'var(--hair)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(step / 3) * 100}%`, background: 'var(--brand)', transition: 'width .3s' }}/>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px var(--pad) 120px', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

        {/* ── Step 1: Type + Photo ── */}
        {step === 1 && <>
          {/* Pen type selector */}
          <div>
            <span className="label" style={{ marginBottom: 10, display: 'block' }}>סוג עט</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Object.entries(PEN_CONFIG).map(([key, c]) => (
                <button key={key} onClick={() => setPenType(key)} style={{
                  border: `2px solid ${penType === key ? c.color : 'var(--hair)'}`,
                  background: penType === key ? c.tint : 'var(--card)',
                  borderRadius: 14, padding: '14px 10px',
                  fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all .15s',
                }}>
                  <span style={{ fontSize: 24 }}>{key === 'novorapid' ? '🟠' : '🟢'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: penType === key ? c.color : 'var(--ink)' }}>{c.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{key === 'novorapid' ? 'אינסולין מהיר' : 'אינסולין בסיסי'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Camera */}
          <div>
            <span className="label" style={{ marginBottom: 10, display: 'block' }}>צלם את קוד העט <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(אופציונלי)</span></span>
            <div
              onClick={() => !analyzing && fileRef.current?.click()}
              style={{
                borderRadius: 16, overflow: 'hidden', aspectRatio: '3/2',
                background: 'var(--bg-warm)', cursor: 'pointer', position: 'relative',
                border: imageUrl ? 'none' : '2px dashed var(--hair)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="pen" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              ) : (
                <div className="col" style={{ alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 999,
                    background: 'var(--brand-tint)', color: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconCamera size={28} stroke={1.5}/>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>צלם את תווית העט</span>
                  <span className="muted" style={{ fontSize: 12 }}>לזיהוי אוטומטי של הקוד</span>
                </div>
              )}
              {imageUrl && (
                <div style={{
                  position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.55)', borderRadius: 999,
                  padding: '5px 14px', color: '#fff', fontSize: 12, fontWeight: 600,
                }}>📸 צלם שוב</div>
              )}
            </div>
            <input key={inputKey} ref={fileRef} type="file" accept="image/*" capture="environment"
                   onChange={handleCapture} style={{ display: 'none' }}/>
          </div>
        </>}

        {/* ── Step 2: Review & confirm ── */}
        {step === 2 && <>
          {/* Image thumbnail */}
          {imageUrl && (
            <div style={{ borderRadius: 14, overflow: 'hidden', height: 120 }}>
              <img src={imageUrl} alt="pen" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}

          {/* Pen type */}
          <div className="card" style={{ padding: 16 }}>
            <span className="label" style={{ marginBottom: 10, display: 'block' }}>סוג עט</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(PEN_CONFIG).map(([key, c]) => (
                <button key={key} onClick={() => setPenType(key)} style={{
                  flex: 1, border: `2px solid ${penType === key ? c.color : 'var(--hair)'}`,
                  background: penType === key ? c.tint : 'transparent',
                  borderRadius: 10, padding: '8px 4px', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 700, color: penType === key ? c.color : 'var(--ink-3)',
                  cursor: 'pointer', transition: 'all .15s',
                }}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* Code */}
          <div className="card" style={{ padding: 16 }}>
            <span className="label" style={{ marginBottom: 8, display: 'block' }}>קוד אצווה (LOT)</span>
            <input
              type="text"
              value={penCode}
              onChange={e => setPenCode(e.target.value)}
              placeholder="למשל: FX12345A"
              style={{
                width: '100%', border: '1.5px solid var(--hair)',
                borderRadius: 10, padding: '10px 12px',
                fontFamily: 'monospace', fontSize: 15,
                background: 'var(--bg)', color: 'var(--ink)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <span className="muted" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>ניתן להשאיר ריק אם לא ניתן לקרוא</span>
          </div>

          {/* Opening date → expiry */}
          <div className="card" style={{ padding: 16 }}>
            <span className="label" style={{ marginBottom: 8, display: 'block' }}>תאריך פתיחה</span>
            <input
              type="date"
              value={openedAt}
              onChange={e => setOpenedAt(e.target.value)}
              style={{
                border: '1.5px solid var(--hair)', borderRadius: 10,
                padding: '10px 12px', fontFamily: 'inherit', fontSize: 14,
                background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
              }}
            />
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: cfg ? cfg.tint : 'var(--bg-warm)',
              border: `1px solid ${cfg ? cfg.border : 'var(--hair)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>פג תוקף</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: cfg ? cfg.color : 'var(--ink)' }}>
                {formatDate(expiresAt)} · {daysUntil(expiresAt)} ימים
              </span>
            </div>
          </div>
        </>}

        {/* ── Step 3: Done ── */}
        {step === 3 && savedPen && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: 10 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999,
              background: 'var(--good-soft)', color: 'var(--good)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconCheck size={40} stroke={2.4}/>
            </div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 500, marginTop: 6 }}>עט נרשם</div>
            <div style={{ textAlign: 'center', color: 'var(--ink-2)', fontSize: 14 }}>
              {PEN_CONFIG[savedPen.pen_type]?.label}
              {savedPen.pen_code ? ` · ${savedPen.pen_code}` : ''}
            </div>
            <div style={{
              marginTop: 8, padding: '10px 20px', borderRadius: 12,
              background: PEN_CONFIG[savedPen.pen_type]?.tint,
              border: `1px solid ${PEN_CONFIG[savedPen.pen_type]?.border}`,
              color: PEN_CONFIG[savedPen.pen_type]?.color,
              fontWeight: 700, fontSize: 14,
            }}>
              פג ב-{formatDate(savedPen.expires_at || addDays(savedPen.opened_at, 30))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 5 }}>
        {step === 1 && !imageUrl && !compressing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                    onClick={() => fileRef.current?.click()}>
              <IconCamera size={20} stroke={2}/> פתח מצלמה
            </button>
            {penType && (
              <button className="btn" style={{ width: '100%', padding: 14, fontSize: 14 }}
                      onClick={() => setStep(2)}>
                המשך ללא צילום →
              </button>
            )}
          </div>
        )}
        {step === 1 && compressing && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }} disabled>
            ⏳ מכין תמונה…
          </button>
        )}
        {step === 1 && imageUrl && !compressing && !analyzing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                    onClick={analyzeImage}>
              🔍 קרא קוד מהתמונה
            </button>
            <button className="btn" style={{ width: '100%', padding: 14, fontSize: 14 }}
                    onClick={() => setStep(2)}>
              המשך ידנית →
            </button>
          </div>
        )}
        {step === 1 && analyzing && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }} disabled>
            🔍 מזהה קוד…
          </button>
        )}
        {step === 2 && (
          <button
            className="btn btn-brand"
            style={{ width: '100%', padding: 16, fontSize: 16, opacity: penType ? 1 : 0.5 }}
            onClick={handleSave}
            disabled={!penType || saving}
          >
            {saving ? 'שומר...' : 'שמור עט'}
          </button>
        )}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                    onClick={startNew}>
              + פתח עט נוסף
            </button>
            <button className="btn" style={{ width: '100%', padding: 14, fontSize: 14 }}
                    onClick={backToList}>
              <IconCheck size={16} stroke={2.4}/> חזרה לרשימה
            </button>
          </div>
        )}
      </div>

      <TabBar active="more"/>
    </div>
  )
}
