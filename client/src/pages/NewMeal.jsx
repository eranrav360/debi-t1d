import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFoods, getRecommendation, recordNovorapid } from '../api'
import { GL } from '../components/Bits'
import { IconCheck, IconArrow, IconCamera, IconChev } from '../components/Icons'
import { TabBar } from '../components/Bits'

function nowLocal() {
  const d = new Date(); d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

// ── Step indicators ─────────────────────────────────────────────────────────
function Steps({ current, total = 3 }) {
  return (
    <div style={{ padding: '6px var(--pad) 12px', flexShrink: 0 }}>
      <div style={{ height: 4, background: 'var(--hair)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(current / total) * 100}%`, background: 'var(--brand)', transition: 'width .3s' }}/>
      </div>
    </div>
  )
}

export default function NewMeal() {
  const navigate  = useNavigate()
  const [step,      setStep]      = useState(1)
  const [carbs,     setCarbs]     = useState(0)
  const [presugar,  setPresugar]  = useState(0)
  const [rec,       setRec]       = useState(null)
  const [doseGiven, setDoseGiven] = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [savedId,   setSavedId]   = useState(null)

  // Food search
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [mealItems,  setMealItems]  = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const dropRef = useRef(null)
  const searchTimer = useRef(null)

  // Fetch pre-sugar from latest glucose (optional enhancement)
  useEffect(() => {
    const GLUCOSE_BASE = (import.meta.env.VITE_API_URL || '') + '/api/glucose'
    fetch(`${GLUCOSE_BASE}/latest`).then(r => r.json()).then(d => {
      if (d.reading?.value) setPresugar(d.reading.value)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const foods = await getFoods(query)
      setResults(foods)
    }, 250)
    return () => clearTimeout(searchTimer.current)
  }, [query])

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setResults([])
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addFood(food) {
    const perG = food.carbs_per_serving / food.serving_size_g
    const newCarbs = Math.round(food.serving_size_g * perG * 10) / 10
    setCarbs(c => Math.round((c + newCarbs) * 10) / 10)
    setMealItems(prev => [...prev, { food_id: food.id, food_name: food.name, weight_g: food.serving_size_g, carbs: newCarbs }])
    setResults([])
    setQuery('')
    setShowSearch(false)
  }

  async function goToStep2() {
    if (carbs <= 0 && presugar <= 0) return
    const r = await getRecommendation(carbs, presugar)
    setRec(r)
    setDoseGiven(r.total_dose)
    setStep(2)
  }

  async function confirm() {
    if (!doseGiven || saving) return
    setSaving(true)
    const result = await recordNovorapid({
      total_carbs:  carbs,
      pre_sugar:    presugar || null,
      dose_given:   doseGiven,
      meal_items:   mealItems,
      recorded_at:  nowLocal().replace('T', ' '),
    })
    setSavedId(result?.id)
    setSaving(false)
    setStep(3)
  }

  const glColor = presugar > 0 ? GL.color(presugar) : 'var(--ink)'

  return (
    <div className="app">
      {/* Header */}
      <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} style={{
          border: 0, background: 'var(--card)', borderRadius: 999, width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}><IconChev size={18}/></button>
        <span className="serif" style={{ fontSize: 18, fontWeight: 500 }}>ארוחה חדשה</span>
        <span className="tnum muted" style={{ fontSize: 12 }}>{step}/3</span>
      </div>

      <Steps current={step}/>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px var(--pad) 120px', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

        {/* ── Step 1: Carbs ── */}
        {step === 1 && <>
          {/* Camera card */}
          <div className="card" style={{
            padding: 14, display: 'flex', gap: 12, alignItems: 'center',
            background: 'linear-gradient(135deg, var(--brand-tint), #FBF3EA)',
            border: '0.5px solid rgba(215,116,83,0.18)',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCamera size={20} stroke={1.8}/>
            </div>
            <div className="col" style={{ flex: 1, gap: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>צלם את הצלחת</span>
              <span className="muted" style={{ fontSize: 12 }}>זיהוי פחמימות אוטומטי · בטא</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--ink)', color: '#fff', padding: '2px 6px', borderRadius: 999 }}>BETA</span>
          </div>

          {/* Big carb input */}
          <div className="card" style={{ padding: 18, alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
            <span className="label" style={{ marginBottom: 6 }}>פחמימות</span>
            <div className="row" style={{ alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span className="bignum tnum" style={{ fontSize: 88, color: 'var(--brand)', fontWeight: 500 }}>{carbs}</span>
              <span style={{ fontSize: 18, color: 'var(--ink-2)', fontWeight: 600 }}>גרם</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {[-10, -5, +5, +10].map(d => (
                <button key={d} onClick={() => setCarbs(c => Math.max(0, Math.round((c + d) * 10) / 10))} style={{
                  border: 0, background: 'var(--bg-warm)', color: 'var(--ink)', padding: '8px 14px',
                  borderRadius: 999, fontWeight: 700, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                }}>{d > 0 ? `+${d}` : d}</button>
              ))}
            </div>
          </div>

          {/* Food search */}
          <div>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="label">הוסף מזון</span>
              <button onClick={() => setShowSearch(s => !s)} style={{ border: 0, background: 'transparent', color: 'var(--brand-deep)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {showSearch ? 'סגור' : '+ חפש'}
              </button>
            </div>
            {showSearch && (
              <div ref={dropRef} style={{ position: 'relative' }}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="חפש מזון..."
                  className="input"
                  autoFocus
                  autoComplete="off"
                />
                {results.length > 0 && (
                  <div className="dropdown">
                    {results.map(food => (
                      <button key={food.id} className="dropdown-item" onClick={() => addFood(food)}>
                        <span>{food.name}</span>
                        <span className="food-carbs">{food.carbs_per_serving}ג פחמ' / {food.serving_size_g}ג</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {mealItems.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {mealItems.map((m, i) => (
                  <div key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 999, background: 'var(--card)',
                    border: '1px solid var(--hair)', fontSize: 13, fontWeight: 600,
                  }}>
                    <span>{m.food_name}</span>
                    <span className="tnum" style={{ color: 'var(--brand-deep)' }}>+{m.carbs}ג׳</span>
                    <button onClick={() => { setMealItems(prev => prev.filter((_, j) => j !== i)); setCarbs(c => Math.max(0, Math.round((c - m.carbs) * 10) / 10)) }}
                      style={{ border: 0, background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>}

        {/* ── Step 2: Dose ── */}
        {step === 2 && <>
          {/* Pre-sugar */}
          <div className="card" style={{ padding: 18 }}>
            <span className="label">סוכר לפני הארוחה</span>
            <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6, marginBottom: 12 }}>
              <span className="bignum tnum" style={{ fontSize: 56, color: glColor, fontWeight: 500 }}>{presugar}</span>
              <span className="muted" style={{ fontSize: 13 }}>mg/dL</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {[-20, -5, +5, +20].map(d => (
                <button key={d} onClick={() => { setPresugar(c => Math.max(40, c + d)); setRec(null) }} style={{
                  border: 0, background: 'var(--bg-warm)', padding: '8px 12px', borderRadius: 999,
                  fontWeight: 700, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                }}>{d > 0 ? `+${d}` : d}</button>
              ))}
            </div>
          </div>

          {/* Dose breakdown */}
          {rec && (
            <div style={{
              padding: 18, borderRadius: 24,
              background: 'linear-gradient(160deg, #FEF1E6 0%, #F8E5D2 100%)',
              border: '0.5px solid rgba(215,116,83,0.18)',
            }}>
              <span className="label">המנה המומלצת</span>
              <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 8, marginBottom: 16 }}>
                <span className="bignum tnum" style={{ fontSize: 96, color: 'var(--brand-deep)', fontWeight: 500 }}>{doseGiven}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--brand-deep)' }}>יח׳</span>
              </div>
              <div className="col" style={{ gap: 8 }}>
                <BreakdownRow label={`${carbs}ג׳ פחמימות · ICR 1:${rec.icr_used}`} value={`${rec.meal_dose} יח׳`}/>
                {rec.correction_dose > 0 && (
                  <BreakdownRow label={`תיקון · ISF ${rec.isf_used}`} value={`+${rec.correction_dose} יח׳`}/>
                )}
              </div>
              {/* Dose adjustment */}
              <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'center' }}>
                {[-0.5, +0.5].map(d => (
                  <button key={d} onClick={() => setDoseGiven(v => Math.max(0, +((v + d).toFixed(1))))} style={{
                    border: '1px solid var(--brand-soft)', background: '#fff', padding: '8px 16px',
                    borderRadius: 999, fontWeight: 700, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                    color: 'var(--brand-deep)',
                  }}>{d > 0 ? `+${d}` : d}</button>
                ))}
              </div>
            </div>
          )}
        </>}

        {/* ── Step 3: Confirmation ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
            <div style={{
              width: 84, height: 84, borderRadius: 999, background: 'var(--good-soft)',
              color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <IconCheck size={42} stroke={2.4}/>
            </div>
            <div className="serif" style={{ fontSize: 26, fontWeight: 500 }}>נרשם בהצלחה</div>
            <span className="muted" style={{ fontSize: 14, marginTop: 4 }}>{doseGiven} יח׳ נובורפיד · {carbs}ג׳ פחמימות</span>

            <div className="card" style={{ marginTop: 24, padding: 14, width: '100%' }}>
              <span className="label">תזכורת בעוד שעה</span>
              <div className="row" style={{ marginTop: 8, gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--bg-warm)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🕐
                </div>
                <div className="col" style={{ flex: 1, gap: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>בדיקת סוכר בעוד שעה</span>
                  <span className="muted" style={{ fontSize: 11 }}>עדכני בדף ההיסטוריה</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 5 }}>
        {step === 1 && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                  onClick={goToStep2} disabled={carbs <= 0 && presugar <= 0}>
            המשך · חישוב מנה
          </button>
        )}
        {step === 2 && (
          <button className="btn btn-brand" style={{ width: '100%', padding: 16, fontSize: 16 }}
                  onClick={confirm} disabled={!doseGiven || saving}>
            {saving ? 'שומר...' : 'אישור הזרקה'}
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

function BreakdownRow({ label, value }) {
  return (
    <div className="row-between" style={{ background: 'rgba(255,255,255,0.6)', padding: '10px 12px', borderRadius: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{label}</span>
      <span className="tnum" style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-deep)' }}>{value}</span>
    </div>
  )
}
