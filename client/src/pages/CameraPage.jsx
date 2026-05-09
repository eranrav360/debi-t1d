import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeFood, getRecommendation, recordNovorapid } from '../api'
import { GL, TabBar } from '../components/Bits'
import { IconCamera, IconCheck, IconChev } from '../components/Icons'

const GLUCOSE_BASE = (import.meta.env.VITE_API_URL || '') + '/api/glucose'

function nowLocal() {
  const d = new Date(); d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

// Resize + compress to JPEG base64 (strips "data:…base64," prefix)
function compressImage(file, maxPx = 1024, quality = 0.82) {
  return new Promise(resolve => {
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
    img.src = URL.createObjectURL(file)
  })
}

const CONFIDENCE_LABEL = { high: 'אמינות גבוהה ✓', medium: 'אמינות בינונית', low: 'אמינות נמוכה — בדקי ידנית ⚠️' }
const CONFIDENCE_COLOR = { high: 'var(--good)', medium: 'var(--warn)', low: 'var(--bad)' }

export default function CameraPage() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [step,      setStep]      = useState(1)
  const [imageUrl,  setImageUrl]  = useState(null)   // object URL for <img>
  const [imageB64,  setImageB64]  = useState(null)   // base64 for API
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis,  setAnalysis]  = useState(null)   // { foods, carbs, confidence, note }
  const [presugar,  setPresugar]  = useState(0)
  const [rec,       setRec]       = useState(null)
  const [doseGiven, setDoseGiven] = useState(0)
  const [saving,    setSaving]    = useState(false)

  async function handleCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
    setImageB64(await compressImage(file))
    setAnalysis(null)
    setRec(null)
  }

  async function analyze() {
    if (!imageB64 || analyzing) return
    setAnalyzing(true)

    // Analyse image + fetch live glucose in parallel
    const [analysisData, glucoseData] = await Promise.allSettled([
      analyzeFood(imageB64),
      fetch(`${GLUCOSE_BASE}/latest`).then(r => r.json()),
    ])

    const result = analysisData.status === 'fulfilled' ? analysisData.value : { foods: [], carbs: 0, confidence: 'low', note: 'שגיאה בניתוח התמונה' }
    const sugar  = glucoseData.status  === 'fulfilled' ? (glucoseData.value?.reading?.value || 0) : 0

    setAnalysis(result)
    setPresugar(sugar)

    // Dose recommendation
    if (result.carbs > 0 || sugar > 0) {
      try {
        const r = await getRecommendation(result.carbs, sugar)
        setRec(r)
        setDoseGiven(r.total_dose)
      } catch { /* no recommendation — user can skip */ }
    }

    setAnalyzing(false)
    setStep(2)
  }

  async function confirm() {
    if (!doseGiven || saving) return
    setSaving(true)
    await recordNovorapid({
      total_carbs: analysis?.carbs || 0,
      pre_sugar:   presugar || null,
      dose_given:  doseGiven,
      meal_items:  [],
      recorded_at: nowLocal().replace('T', ' '),
    })
    setSaving(false)
    setStep(3)
  }

  const glColor = presugar > 0 ? GL.color(presugar) : 'var(--ink-3)'

  return (
    <div className="app">

      {/* Header */}
      <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} style={{
          border: 0, background: 'var(--card)', borderRadius: 999, width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <IconChev size={18}/>
        </button>
        <span className="serif" style={{ fontSize: 18, fontWeight: 500 }}>זיהוי מנה</span>
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

        {/* ── Step 1: Capture ── */}
        {step === 1 && <>
          {/* Camera frame */}
          <div
            onClick={() => !analyzing && fileRef.current?.click()}
            style={{
              borderRadius: 20, overflow: 'hidden', aspectRatio: '4/3',
              background: 'var(--bg-warm)', cursor: 'pointer', position: 'relative',
              border: imageUrl ? 'none' : '2px dashed var(--hair)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="מנה" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            ) : (
              <div className="col" style={{ alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 999,
                  background: 'var(--brand-tint)', color: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconCamera size={36} stroke={1.5}/>
                </div>
                <div className="col" style={{ alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>צלם את הצלחת</span>
                  <span className="muted" style={{ fontSize: 13 }}>הקש לצילום או בחירת תמונה</span>
                </div>
              </div>
            )}

            {/* Re-shoot overlay */}
            {imageUrl && (
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.55)', borderRadius: 999,
                padding: '6px 16px', color: '#fff', fontSize: 13, fontWeight: 600,
                backdropFilter: 'blur(4px)',
              }}>
                📸 צלם שוב
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            style={{ display: 'none' }}
          />

          {/* Tips */}
          {!imageUrl && (
            <div className="card" style={{ padding: 14 }}>
              <span className="label" style={{ marginBottom: 10, display: 'block' }}>לתוצאה טובה יותר</span>
              <div className="col" style={{ gap: 8 }}>
                {[
                  'כוון ישירות מעל הצלחת',
                  'וודא תאורה טובה, ללא צל',
                  'כלול את כל רכיבי המנה בפריים',
                ].map((t, i) => (
                  <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--good)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>}

        {/* ── Step 2: Analysis + Dose ── */}
        {step === 2 && analysis && <>
          {/* Image thumbnail */}
          {imageUrl && (
            <div style={{ borderRadius: 16, overflow: 'hidden', height: 150 }}>
              <img src={imageUrl} alt="מנה" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}

          {/* Detected foods */}
          {analysis.foods?.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <span className="label" style={{ marginBottom: 10, display: 'block' }}>מזונות שזוהו</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {analysis.foods.map((f, i) => (
                  <span key={i} style={{
                    padding: '5px 12px', borderRadius: 999,
                    background: 'var(--brand-tint)', color: 'var(--brand-deep)',
                    fontSize: 13, fontWeight: 600,
                  }}>{f}</span>
                ))}
              </div>
              {analysis.note && (
                <span className="muted" style={{ fontSize: 12, marginTop: 10, display: 'block' }}>{analysis.note}</span>
              )}
            </div>
          )}

          {/* Carbs estimate */}
          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span className="label">פחמימות מוערכות</span>
            <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span className="bignum tnum" style={{ fontSize: 88, color: 'var(--brand)', fontWeight: 500 }}>
                {analysis.carbs}
              </span>
              <span style={{ fontSize: 18, color: 'var(--ink-2)', fontWeight: 600 }}>גרם</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: CONFIDENCE_COLOR[analysis.confidence] }}>
              {CONFIDENCE_LABEL[analysis.confidence] || ''}
            </span>
          </div>

          {/* Dose breakdown */}
          {rec && (
            <div style={{
              padding: 18, borderRadius: 24,
              background: 'linear-gradient(160deg, #FEF1E6 0%, #F8E5D2 100%)',
              border: '0.5px solid rgba(215,116,83,0.18)',
            }}>
              <span className="label">מנה מומלצת</span>
              <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 8, marginBottom: 14 }}>
                <span className="bignum tnum" style={{ fontSize: 88, color: 'var(--brand-deep)', fontWeight: 500 }}>{doseGiven}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--brand-deep)' }}>יח׳</span>
              </div>

              <div className="col" style={{ gap: 8, marginBottom: 14 }}>
                <BreakRow label={`${analysis.carbs}ג׳ פחמימות · ICR 1:${rec.icr_used}`} value={`${rec.meal_dose} יח׳`}/>
                {presugar > 0 && rec.correction_dose > 0 && (
                  <BreakRow
                    label={<>סוכר <span style={{ color: glColor, fontWeight: 700 }}>{presugar}</span> · תיקון ISF {rec.isf_used}</>}
                    value={`+${rec.correction_dose} יח׳`}
                  />
                )}
                {presugar > 0 && rec.correction_dose === 0 && (
                  <BreakRow
                    label={<>סוכר <span style={{ color: glColor, fontWeight: 700 }}>{presugar}</span> · בטווח, ללא תיקון</>}
                    value="—"
                  />
                )}
              </div>

              {/* Adjust dose */}
              <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                {[-0.5, +0.5].map(d => (
                  <button key={d}
                    onClick={() => setDoseGiven(v => Math.max(0, +((v + d).toFixed(1))))}
                    style={{
                      border: '1px solid var(--brand-soft)', background: '#fff',
                      padding: '8px 20px', borderRadius: 999, fontWeight: 700,
                      fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: 'var(--brand-deep)',
                    }}
                  >{d > 0 ? `+${d}` : d}</button>
                ))}
              </div>
            </div>
          )}

          {/* No recommendation fallback */}
          {!rec && (
            <div className="card" style={{ padding: 14 }}>
              <span className="muted" style={{ fontSize: 13 }}>לא ניתן לחשב מינון — בדקי את נתוני ICR/ISF בהגדרות.</span>
            </div>
          )}
        </>}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
            <div style={{
              width: 84, height: 84, borderRadius: 999, background: 'var(--good-soft)',
              color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <IconCheck size={42} stroke={2.4}/>
            </div>
            <div className="serif" style={{ fontSize: 26, fontWeight: 500 }}>נרשם בהצלחה</div>
            <span className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              {doseGiven} יח׳ נובורפיד · {analysis?.carbs}ג׳ פחמימות
            </span>
          </div>
        )}

      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 5 }}>
        {step === 1 && !imageUrl && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                  onClick={() => fileRef.current?.click()}>
            <IconCamera size={20} stroke={2}/> פתח מצלמה
          </button>
        )}
        {step === 1 && imageUrl && !analyzing && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                  onClick={analyze}>
            ✨ נתח פחמימות
          </button>
        )}
        {step === 1 && analyzing && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }} disabled>
            🔍 מזהה מזונות…
          </button>
        )}
        {step === 2 && rec && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                  onClick={confirm} disabled={!doseGiven || saving}>
            {saving ? 'שומר...' : 'אישור הזרקה'}
          </button>
        )}
        {step === 2 && !rec && (
          <button className="btn" style={{ width: '100%', padding: 16, fontSize: 16 }}
                  onClick={() => navigate(-1)}>
            חזרה
          </button>
        )}
        {step === 3 && (
          <button className="btn" style={{ width: '100%', padding: 16, fontSize: 16, background: 'var(--good)' }}
                  onClick={() => navigate('/')}>
            <IconCheck size={18} stroke={2.4} color="#fff"/> סיום
          </button>
        )}
      </div>

      <TabBar active="log"/>
    </div>
  )
}

function BreakRow({ label, value }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.6)', padding: '10px 12px', borderRadius: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{label}</span>
      <span className="tnum" style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-deep)' }}>{value}</span>
    </div>
  )
}
