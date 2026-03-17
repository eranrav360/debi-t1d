import { useEffect, useState } from 'react'
import { getStatistics } from '../api'

function ConfidenceLabel({ level }) {
  const map = { high: ['✓ גבוה', 'var(--success)'], medium: ['⚠ בינוני', 'var(--warning)'], low: ['ℹ נמוך', 'var(--gray-500)'] }
  const [label, color] = map[level] || map.low
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{label}</span>
}

export default function Statistics() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStatistics().then(setStats)
  }, [])

  if (!stats) return <div className="loading">מחשב סטטיסטיקה...</div>

  return (
    <div className="page">
      <h1 className="page-title">📊 סטטיסטיקה ופרמטרים</h1>

      {/* Confidence banner */}
      {stats.confidence === 'low' && (
        <div className="alert alert-info">
          ℹ️ עדיין מעט נתונים. ככל שתרשמי יותר, החישובים יהיו מדויקים יותר.
          <br />נדרשים לפחות 3 רשומות עם מדידת סוכר לאחר שעה.
        </div>
      )}

      {/* ICR */}
      <div className="card">
        <div className="card-title">יחס אינסולין:פחמימות (ICR)</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: stats.icr ? 'var(--primary)' : 'var(--gray-300)' }}>
              {stats.icr ? `1:${stats.icr}` : '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              {stats.icr
                ? `1 יחידת נובורפיד מכסה ${stats.icr}ג פחמימות`
                : 'ברירת מחדל: 1:15 עד צבירת נתונים'}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>רמת ביטחון</div>
            <ConfidenceLabel level={stats.confidence} />
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
              {stats.data_points?.icr || 0} מדידות
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
          <strong>כיצד מחושב:</strong> נלקחות הזרקות שבהן רמת הסוכר לפני הייתה בטווח 80–120 (ולכן המינון ניתן בעיקר לכיסוי פחמימות).
          ICR = פחמימות ÷ מינון. מחושב החציון של כל המדידות.
        </div>
      </div>

      {/* ISF */}
      <div className="card">
        <div className="card-title">גורם רגישות לאינסולין (ISF)</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: stats.isf ? 'var(--primary)' : 'var(--gray-300)' }}>
              {stats.isf || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              {stats.isf
                ? `1 יחידת נובורפיד מורידה סוכר ב-${stats.isf} mg/dL`
                : 'ברירת מחדל: 50 עד צבירת נתונים'}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>רמת ביטחון</div>
            <ConfidenceLabel level={stats.confidence} />
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
              {stats.data_points?.isf || 0} מדידות
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
          <strong>כיצד מחושב:</strong> נלקחות הזרקות ללא ארוחה (פחמימות = 0) שבהן ניתן מינון תיקון.
          ISF = (סוכר לפני − סוכר אחרי שעה) ÷ מינון. מחושב החציון.
        </div>
      </div>

      {/* Tregludec */}
      <div className="card">
        <div className="card-title">טרגלודק — אינסולין ארוך-טווח</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
              {stats.tregludec_current ? `${stats.tregludec_current} יח'` : '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>מינון יומי נוכחי</div>
          </div>
          {stats.fasting_avg && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>סוכר בצום ממוצע</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: stats.fasting_avg > 130 ? 'var(--danger)' : stats.fasting_avg < 80 ? 'var(--warning)' : 'var(--success)' }}>
                {stats.fasting_avg}
              </div>
            </div>
          )}
        </div>

        {stats.tregludec_recommendation && (
          <div className={`alert ${stats.fasting_avg > 130 || stats.fasting_avg < 80 ? 'alert-warning' : 'alert-success'}`} style={{ marginTop: 12, marginBottom: 0 }}>
            💊 {stats.tregludec_recommendation}
          </div>
        )}

        {!stats.tregludec_current && (
          <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
            רשמי את מינון הטרגלודק היומי בדף "רישום הזרקה" כדי לקבל המלצות.
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
          <strong>כיצד מחושב:</strong> ניתח ממוצע סוכר בצום (הזרקות ללא פחמימות, 14 האחרונות).
          סוכר בצום &gt;130 → הצעה להגדיל · סוכר בצום &lt;80 → הצעה להקטין.
          <br />⚠️ שינויי מינון טרגלודק תמיד לאשר עם הרופא המטפל.
        </div>
      </div>

      {/* Formula explanation */}
      <div className="card">
        <div className="card-title">נוסחת חישוב מינון</div>
        <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 14, direction: 'ltr', textAlign: 'left' }}>
          <div>מינון ארוחה = פחמימות (גרם) ÷ ICR</div>
          <div style={{ marginTop: 6 }}>מינון תיקון = max(0, (סוכר − 100) ÷ ISF)</div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>סה"כ = מינון ארוחה + מינון תיקון</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 10 }}>
          יעד סוכר: <strong>100 mg/dL</strong>. ניתן לשינוי בהתייעצות עם הצוות הרפואי.
        </div>
      </div>
    </div>
  )
}
