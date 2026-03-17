import { useEffect, useState, useRef } from 'react'
import { getFoods, addFood, deleteFood } from '../api'

export default function FoodDatabase() {
  const [foods, setFoods] = useState([])
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newServing, setNewServing] = useState('')
  const [newCarbs, setNewCarbs] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const searchTimer = useRef(null)

  useEffect(() => {
    getFoods().then(f => { setFoods(f); setLoading(false) })
  }, [])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      getFoods(query).then(setFoods)
    }, 250)
    return () => clearTimeout(searchTimer.current)
  }, [query])

  async function handleAdd() {
    if (!newName.trim() || !newServing || !newCarbs || saving) return
    setSaving(true)
    const result = await addFood({
      name: newName.trim(),
      serving_size_g: parseFloat(newServing),
      carbs_per_serving: parseFloat(newCarbs)
    })
    setSaving(false)
    if (result.status === 'ok') {
      setShowAdd(false)
      setNewName('')
      setNewServing('')
      setNewCarbs('')
      getFoods(query).then(setFoods)
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`למחוק "${name}"?`)) return
    await deleteFood(id)
    setFoods(prev => prev.filter(f => f.id !== id))
  }

  function carbs100(food) {
    return Math.round(food.carbs_per_serving * 100 / food.serving_size_g * 10) / 10
  }

  return (
    <div className="page">
      <h1 className="page-title">🥗 מסד נתוני מזונות</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="חפש מזון..."
            className="input"
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowAdd(v => !v)}
          >
            {showAdd ? 'בטל' : '+ הוסף מזון'}
          </button>
        </div>

        {showAdd && (
          <div className="add-food-dialog" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>הוספת מזון חדש</div>
            <div className="form-group">
              <label>שם המזון</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="לדוג' לחם מלא"
                className="input"
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>גודל מנת ייחוס (גרם)</label>
                <input
                  type="number"
                  value={newServing}
                  onChange={e => setNewServing(e.target.value)}
                  placeholder="30"
                  className="input"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>פחמימות במנה (גרם)</label>
                <input
                  type="number"
                  value={newCarbs}
                  onChange={e => setNewCarbs(e.target.value)}
                  placeholder="15"
                  className="input"
                />
              </div>
            </div>
            {newServing && newCarbs && (
              <div style={{ fontSize: 13, color: 'var(--primary)', marginBottom: 10 }}>
                = {Math.round(parseFloat(newCarbs) * 100 / parseFloat(newServing) * 10) / 10}ג פחמימות ל-100 גרם
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newServing || !newCarbs || saving}
              className="btn btn-success"
            >
              {saving ? 'שומר...' : 'שמור מזון'}
            </button>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 8 }}>
          {loading ? 'טוען...' : `${foods.length} מזונות`}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>שם המזון</th>
              <th>מנה (ג)</th>
              <th>פחמ' במנה</th>
              <th>פחמ'/100ג</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {foods.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>לא נמצאו תוצאות</td></tr>
            )}
            {foods.map(food => (
              <tr key={food.id}>
                <td>{food.name}</td>
                <td>{food.serving_size_g}</td>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{food.carbs_per_serving}ג</td>
                <td style={{ color: 'var(--gray-500)' }}>{carbs100(food)}ג</td>
                <td>
                  <button className="btn-icon" onClick={() => handleDelete(food.id, food.name)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
