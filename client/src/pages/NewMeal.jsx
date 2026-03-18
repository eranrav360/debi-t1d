import { useState, useEffect, useRef } from 'react'
import { getFoods, getRecommendation, recordNovorapid, updatePostSugar } from '../api'

function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function NewMeal() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [items, setItems] = useState([])
  const [addingFood, setAddingFood] = useState(null)
  const [tempWeight, setTempWeight] = useState('')
  const [preSugar, setPreSugar] = useState('')
  const [recordedAt, setRecordedAt] = useState(nowLocal())
  const [rec, setRec] = useState(null)
  const [doseGiven, setDoseGiven] = useState('')
  const [saved, setSaved] = useState(null)
  const [postSugar, setPostSugar] = useState('')
  const [postUpdated, setPostUpdated] = useState(false)
  const [saving, setSaving] = useState(false)
  const searchTimer = useRef(null)
  const dropdownRef = useRef(null)

  const totalCarbs = Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10

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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function calcCarbs(food, weight) {
    const per100 = food.carbs_per_serving * 100 / food.serving_size_g
    return Math.round(parseFloat(weight) * per100 / 100 * 10) / 10
  }

  function handleSelectFood(food) {
    setAddingFood(food)
    setTempWeight(String(food.serving_size_g))
    setResults([])
    setQuery('')
  }

  function handleAddFood() {
    const w = parseFloat(tempWeight)
    if (!w || !addingFood) return
    setItems(prev => [...prev, {
      food_id: addingFood.id,
      food_name: addingFood.name,
      weight_g: w,
      carbs: calcCarbs(addingFood, w)
    }])
    setAddingFood(null)
    setTempWeight('')
    setRec(null)
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setRec(null)
  }

  async function handleGetRec() {
    if (!preSugar) return
    const r = await getRecommendation(totalCarbs, parseFloat(preSugar))
    setRec(r)
    setDoseGiven(String(r.total_dose))
  }

  async function handleRecord() {
    if (!doseGiven || saving) return
    setSaving(true)
    const result = await recordNovorapid({
      total_carbs: totalCarbs,
      pre_sugar: parseInt(preSugar) || null,
      dose_given: parseFloat(doseGiven),
      meal_items: items,
      recorded_at: recordedAt.replace('T', ' ')
    })
    setSaved(result)
    setSaving(false)
    setItems([])
    setPreSugar('')
    setRec(null)
    setDoseGiven('')
  }

  async function handleUpdatePost() {
    if (!saved || !postSugar) return
    await updatePostSugar(saved.id, parseInt(postSugar))
    setPostUpdated(true)
    setPostSugar('')
  }

  function startNew() {
    setSaved(null)
    setPostUpdated(false)
    setItems([])
    setRecordedAt(nowLocal())
  }

  const weightNum = parseFloat(tempWeight)
  const carbPreview = addingFood && weightNum > 0 ? calcCarbs(addingFood, weightNum) : null

  return (
    <div className="page">
      <h1 className="page-title">🍽️ ארוחה חדשה</h1>

      {saved && !postUpdated && (
        <div className="card" style={{ borderColor: 'var(--success)', borderWidth: 2 }}>
          <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 8 }}>
            ✓ ההזרקה נרשמה! מינון: {parseFloat(doseGiven)} יחידות
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 12 }}>
            עדכן רמת סוכר לאחר שעה:
          </div>
          <div className="form-row">
            <input
              type="number"
              value={postSugar}
              onChange={e => setPostSugar(e.target.value)}
              placeholder="mg/dL"
              className="input input-num"
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
        <>
          {/* Food search */}
          <div className="card">
            <div className="card-title">הוספת מזון</div>
            <div className="search-wrap" ref={dropdownRef}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="חפש מזון (עברית)..."
                className="input"
                autoComplete="off"
              />
              {results.length > 0 && (
                <div className="dropdown">
                  {results.map(food => (
                    <button key={food.id} className="dropdown-item" onClick={() => handleSelectFood(food)}>
                      <span>{food.name}</span>
                      <span className="food-carbs">
                        {food.carbs_per_serving}ג פחמ' / {food.serving_size_g}ג
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {addingFood && (
              <div className="add-food-dialog">
                <div className="add-food-name">{addingFood.name}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>
                  מנת ייחוס: {addingFood.serving_size_g}ג = {addingFood.carbs_per_serving}ג פחמ'
                </div>
                <div className="form-row">
                  <div>
                    <label>משקל (גרם)</label>
                    <input
                      type="number"
                      value={tempWeight}
                      onChange={e => setTempWeight(e.target.value)}
                      className="input input-sm input-num"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAddFood()}
                    />
                  </div>
                  <div className="carb-preview" style={{ marginTop: 20 }}>
                    {carbPreview !== null ? `≈ ${carbPreview}ג פחמ'` : ''}
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', gap: 6 }}>
                    <button onClick={handleAddFood} disabled={!tempWeight} className="btn btn-primary btn-sm">הוסף</button>
                    <button onClick={() => setAddingFood(null)} className="btn btn-ghost btn-sm">בטל</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Meal items */}
          {items.length > 0 && (
            <div className="card">
              <div className="card-title">פריטי הארוחה</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>מזון</th>
                    <th>משקל</th>
                    <th>פחמ'</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.food_name}</td>
                      <td>{item.weight_g}ג</td>
                      <td>{item.carbs}ג</td>
                      <td><button className="btn-icon" onClick={() => removeItem(i)}>✕</button></td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={2}><strong>סה"כ פחמימות</strong></td>
                    <td colSpan={2}><strong>{totalCarbs}ג</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Dose recommendation */}
          {items.length > 0 && (
            <div className="card">
              <div className="card-title">המלצת מינון נובורפיד</div>
              <div className="form-group">
                <label>תאריך ושעה</label>
                <input
                  type="datetime-local"
                  value={recordedAt}
                  onChange={e => setRecordedAt(e.target.value)}
                  className="input"
                />
              </div>
              <div className="form-row">
                <div>
                  <label>סוכר לפני הארוחה (mg/dL)</label>
                  <input
                    type="number"
                    value={preSugar}
                    onChange={e => { setPreSugar(e.target.value); setRec(null) }}
                    placeholder="לדוג' 110"
                    className="input input-num"
                    onKeyDown={e => e.key === 'Enter' && handleGetRec()}
                  />
                </div>
                <div style={{ marginTop: 20 }}>
                  <button onClick={handleGetRec} disabled={!preSugar} className="btn btn-primary">
                    חשב מינון
                  </button>
                </div>
              </div>

              {rec && (
                <>
                  <div className={`rec-box confidence-${rec.confidence}`}>
                    <div className="rec-row">
                      <span>מינון לכיסוי פחמימות ({totalCarbs}ג ÷ {rec.icr_used}):</span>
                      <strong>{rec.meal_dose} יחידות</strong>
                    </div>
                    <div className="rec-row">
                      <span>תיקון ({parseFloat(preSugar)} → 100 ÷ {rec.isf_used}):</span>
                      <strong>{rec.correction_dose} יחידות</strong>
                    </div>
                    <div className="rec-row total">
                      <span>סה"כ מינון מומלץ:</span>
                      <strong>{rec.total_dose} יחידות</strong>
                    </div>
                    <div className="rec-note">
                      {rec.confidence === 'high' ? '✓ ביטחון גבוה — מבוסס על נתונים היסטוריים' :
                       rec.confidence === 'medium' ? '⚠ ביטחון בינוני — מעט נתונים' :
                       'ℹ ברירת מחדל (ICR=15, ISF=50) — הנתונים עדיין מצטברים'}
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: 12 }}>
                    <div>
                      <label>מינון בפועל (יחידות)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={doseGiven}
                        onChange={e => setDoseGiven(e.target.value)}
                        className="input input-num"
                      />
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={handleRecord}
                        disabled={!doseGiven || saving}
                        className="btn btn-success"
                      >
                        {saving ? 'שומר...' : 'רשום הזרקה ✓'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {items.length === 0 && (
            <div className="empty">חפש מזון ולחץ עליו להוסיף לארוחה</div>
          )}
        </>
      )}
    </div>
  )
}
