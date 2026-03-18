import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../api'
import SugarBadge from '../components/SugarBadge'

function formatTime(dt) {
  if (!dt) return ''
  return dt.slice(11, 16)
}

function formatDate(dt) {
  if (!dt) return ''
  return dt.slice(0, 10).split('-').reverse().join('/')
}

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    getDashboard().then(setData)
  }, [])

  if (!data) return <div className="loading">טוען...</div>

  const { today_novorapid, today_tregludec, last_record, today_free_meals = [], stats } = data
  const totalDoseToday = today_novorapid.reduce((s, r) => s + r.dose_given, 0)

  return (
    <div className="page">
      <h1 className="page-title">לוח בקרה</h1>

      <div className="quick-actions">
        <Link to="/meal" className="quick-action">
          <span className="icon">🍽️</span>
          <span>ארוחה חדשה</span>
        </Link>
        <Link to="/injection" className="quick-action">
          <span className="icon">💉</span>
          <span>רישום הזרקה</span>
        </Link>
        <Link to="/statistics" className="quick-action">
          <span className="icon">📊</span>
          <span>סטטיסטיקה</span>
        </Link>
        <Link to="/history" className="quick-action">
          <span className="icon">📋</span>
          <span>היסטוריה</span>
        </Link>
        <Link to="/free-meal" className="quick-action">
          <span className="icon">🥗</span>
          <span>ארוחה ללא הזרקה</span>
        </Link>
      </div>

      {/* Today summary */}
      <div className="card">
        <div className="card-title">היום</div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card">
            <div className="stat-value">{today_novorapid.length}</div>
            <div className="stat-label">הזרקות נובורפיד</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalDoseToday.toFixed(1)}</div>
            <div className="stat-label">סה"כ יחידות נובו</div>
          </div>
        </div>
        {today_free_meals.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              🥗 {today_free_meals.length} ארוחה/ות ללא הזרקה היום
            </div>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          {today_tregludec ? (
            <div className="alert alert-success">
              ✓ טרגלודק היום: <strong>{today_tregludec.dose} יחידות</strong>
            </div>
          ) : (
            <div className="alert alert-warning">
              ⚠️ טרגלודק לא נרשם היום
              <Link to="/injection" style={{ marginRight: 8, fontWeight: 700, color: 'inherit' }}>→ רשום עכשיו</Link>
            </div>
          )}
        </div>
      </div>

      {/* Last reading */}
      {last_record && (
        <div className="card">
          <div className="card-title">מדידה אחרונה</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                {formatDate(last_record.recorded_at)} · {formatTime(last_record.recorded_at)}
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray-600)', marginTop: 2 }}>
                מינון: <strong>{last_record.dose_given} יחידות</strong>
                {last_record.total_carbs > 0 && <> · פחמ': <strong>{last_record.total_carbs}ג</strong></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>לפני</div>
                <SugarBadge value={last_record.pre_sugar} />
              </div>
              <div style={{ color: 'var(--gray-300)', fontSize: 18 }}>→</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>אחרי שעה</div>
                <SugarBadge value={last_record.post_1hr_sugar} />
              </div>
            </div>
          </div>
          {!last_record.post_1hr_sugar && (
            <div className="alert alert-info" style={{ marginTop: 10, marginBottom: 0 }}>
              האם עברה שעה? <Link to="/history" style={{ fontWeight: 700, color: 'inherit' }}>עדכן סוכר לאחר שעה →</Link>
            </div>
          )}
        </div>
      )}

      {/* Current parameters */}
      <div className="card">
        <div className="card-title">פרמטרים נוכחיים</div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card">
            <div className={`stat-value confidence-${stats.confidence}`}>
              {stats.icr ? `1:${stats.icr}` : '—'}
            </div>
            <div className="stat-label">יחס אינסולין:פחמ'</div>
            <div className="stat-sub">{stats.data_points?.icr || 0} נקודות מידע</div>
          </div>
          <div className="stat-card">
            <div className={`stat-value confidence-${stats.confidence}`}>
              {stats.isf || '—'}
            </div>
            <div className="stat-label">גורם רגישות (ISF)</div>
            <div className="stat-sub">{stats.data_points?.isf || 0} נקודות מידע</div>
          </div>
        </div>
        {stats.confidence === 'low' && (
          <div className="alert alert-info" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
            ℹ️ עדיין אין מספיק נתונים לחישוב מדויק. מינוי ברירת מחדל: יחס 1:15, ISF 50.
          </div>
        )}
        {stats.tregludec_recommendation && (
          <div className="alert alert-warning" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
            💊 {stats.tregludec_recommendation}
          </div>
        )}
      </div>

      {/* Today's injections list */}
      {today_novorapid.length > 0 && (
        <div className="card">
          <div className="card-title">הזרקות נובורפיד היום</div>
          {today_novorapid.map(r => (
            <div key={r.id} className="history-item">
              <div className="history-meta">
                <span className="history-date">{formatTime(r.recorded_at)}</span>
                <span className="history-dose">{r.dose_given} יח'</span>
              </div>
              <div className="history-sugars">
                <SugarBadge value={r.pre_sugar} />
                <span style={{ color: 'var(--gray-300)' }}>→</span>
                <SugarBadge value={r.post_1hr_sugar} />
                {r.total_carbs > 0 && <span className="history-details">· {r.total_carbs}ג פחמ'</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
