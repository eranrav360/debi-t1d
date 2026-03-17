import { useEffect, useState } from 'react'
import { getNovorapidHistory, getTregludecHistory, updatePostSugar, deleteNovorapid, deleteTregludec } from '../api'
import SugarBadge from '../components/SugarBadge'

function fmtDT(dt) {
  if (!dt) return ''
  const [date, time] = dt.split(' ')
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y} ${time || ''}`
}

export default function History() {
  const [tab, setTab] = useState('novorapid')
  const [novoRecords, setNovoRecords] = useState([])
  const [tregRecords, setTregRecords] = useState([])
  const [editingPost, setEditingPost] = useState(null)
  const [postVal, setPostVal] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getNovorapidHistory(), getTregludecHistory()]).then(([novo, treg]) => {
      setNovoRecords(novo)
      setTregRecords(treg)
      setLoading(false)
    })
  }, [])

  async function handleUpdatePost(id) {
    if (!postVal) return
    await updatePostSugar(id, parseInt(postVal))
    setNovoRecords(prev => prev.map(r => r.id === id ? { ...r, post_1hr_sugar: parseInt(postVal) } : r))
    setEditingPost(null)
    setPostVal('')
  }

  async function handleDeleteNovo(id) {
    if (!confirm('למחוק רשומה זו?')) return
    await deleteNovorapid(id)
    setNovoRecords(prev => prev.filter(r => r.id !== id))
  }

  async function handleDeleteTreg(id) {
    if (!confirm('למחוק רשומה זו?')) return
    await deleteTregludec(id)
    setTregRecords(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className="loading">טוען...</div>

  return (
    <div className="page">
      <h1 className="page-title">📋 היסטוריה</h1>

      <div className="tabs">
        <button className={`tab ${tab === 'novorapid' ? 'active' : ''}`} onClick={() => setTab('novorapid')}>
          💉 נובורפיד ({novoRecords.length})
        </button>
        <button className={`tab ${tab === 'tregludec' ? 'active' : ''}`} onClick={() => setTab('tregludec')}>
          💊 טרגלודק ({tregRecords.length})
        </button>
      </div>

      {tab === 'novorapid' && (
        <div className="card" style={{ padding: 0 }}>
          {novoRecords.length === 0 && <div className="empty">אין רשומות עדיין</div>}
          {novoRecords.map(r => (
            <div key={r.id} className="history-item">
              <div className="history-meta">
                <span className="history-date">{fmtDT(r.recorded_at)}</span>
                <span className="history-dose">{r.dose_given} יח' נובו</span>
              </div>

              <div className="history-sugars">
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>לפני:</span>
                <SugarBadge value={r.pre_sugar} />
                <span style={{ color: 'var(--gray-300)' }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>אחרי:</span>
                {r.post_1hr_sugar
                  ? <SugarBadge value={r.post_1hr_sugar} />
                  : editingPost === r.id
                    ? (
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number"
                          value={postVal}
                          onChange={e => setPostVal(e.target.value)}
                          className="input input-sm input-num"
                          autoFocus
                          style={{ width: 70 }}
                          onKeyDown={e => e.key === 'Enter' && handleUpdatePost(r.id)}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => handleUpdatePost(r.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingPost(null)}>✕</button>
                      </span>
                    )
                    : (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => { setEditingPost(r.id); setPostVal('') }}
                      >
                        + הוסף סוכר אחרי שעה
                      </button>
                    )
                }
              </div>

              {r.total_carbs > 0 && (
                <div className="history-details">פחמ': {r.total_carbs}ג</div>
              )}
              {r.meal_items && r.meal_items.length > 0 && (
                <div className="history-details">
                  {r.meal_items.map((m, i) => (
                    <span key={i}>{m.food_name} {m.weight_g}ג{i < r.meal_items.length - 1 ? ', ' : ''}</span>
                  ))}
                </div>
              )}
              {r.notes && <div className="history-details">הערות: {r.notes}</div>}

              <div style={{ marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--danger)' }}
                  onClick={() => handleDeleteNovo(r.id)}>
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tregludec' && (
        <div className="card" style={{ padding: 0 }}>
          {tregRecords.length === 0 && <div className="empty">אין רשומות עדיין</div>}
          {tregRecords.map(r => (
            <div key={r.id} className="history-item">
              <div className="history-meta">
                <span className="history-date">
                  {r.recorded_date.split('-').reverse().join('/')}
                </span>
                <span className="history-dose">{r.dose} יח' טרגלודק</span>
              </div>
              {r.notes && <div className="history-details">הערות: {r.notes}</div>}
              <div style={{ marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--danger)' }}
                  onClick={() => handleDeleteTreg(r.id)}>
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
