import { useEffect, useState, useCallback } from 'react'
import { getAlertRules, updateAlertRule, testAlertRule } from '../api'

const GLUCOSE_BASE = (import.meta.env.VITE_API_URL || '') + '/api/glucose'

function timeAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `לפני ${days} יום${days > 1 ? 'ים' : ''}`
  if (hours > 0) return `לפני ${hours} שעה${hours > 1 ? 'ות' : ''}`
  if (mins  > 0) return `לפני ${mins} דקה${mins > 1 ? 'ות' : ''}`
  return 'לפני פחות מדקה'
}

function conditionLabel(rule) {
  const cmp  = rule.conditionType === 'BELOW' ? '<' : '>'
  const dur  = rule.durationMinutes
  if (dur === 0) return `סוכר ${cmp} ${rule.threshold} mg/dL (מיידי)`
  if (dur < 60)  return `סוכר ${cmp} ${rule.threshold} mg/dL למשך ${dur} דקות`
  return `סוכר ${cmp} ${rule.threshold} mg/dL למשך ${dur / 60} שעות`
}

function RuleCard({ rule: initial, onSaved }) {
  const [rule,    setRule]    = useState(initial)
  const [editing, setEditing] = useState({
    threshold:       initial.threshold,
    durationMinutes: initial.durationMinutes,
    cooldownMinutes: initial.cooldownMinutes,
  })
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [flash,   setFlash]   = useState(null) // 'saved' | 'tested' | 'error'

  // Sync if parent refreshes
  useEffect(() => {
    setRule(initial)
    setEditing({
      threshold:       initial.threshold,
      durationMinutes: initial.durationMinutes,
      cooldownMinutes: initial.cooldownMinutes,
    })
  }, [initial])

  function showFlash(type) {
    setFlash(type)
    setTimeout(() => setFlash(null), 2500)
  }

  async function handleToggle() {
    setSaving(true)
    try {
      const updated = await updateAlertRule(rule.id, { enabled: !rule.enabled })
      setRule(updated)
      onSaved(updated)
    } catch { showFlash('error') }
    finally { setSaving(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateAlertRule(rule.id, {
        threshold:        parseInt(editing.threshold),
        duration_minutes: parseInt(editing.durationMinutes),
        cooldown_minutes: parseInt(editing.cooldownMinutes),
      })
      setRule(updated)
      onSaved(updated)
      showFlash('saved')
    } catch { showFlash('error') }
    finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true)
    try {
      await testAlertRule(rule.id)
      showFlash('tested')
    } catch { showFlash('error') }
    finally { setTesting(false) }
  }

  const dirty =
    parseInt(editing.threshold)       !== rule.threshold       ||
    parseInt(editing.durationMinutes) !== rule.durationMinutes ||
    parseInt(editing.cooldownMinutes) !== rule.cooldownMinutes

  const cardBorder = rule.enabled ? '#4caf50' : '#9e9e9e'

  return (
    <div className="card" style={{ borderRight: `4px solid ${cardBorder}`, opacity: rule.enabled ? 1 : 0.65 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{rule.nameHe}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
            {conditionLabel({ ...rule, threshold: editing.threshold, durationMinutes: editing.durationMinutes })}
          </div>
        </div>

        {/* Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 13, color: rule.enabled ? 'var(--success)' : 'var(--gray-400)' }}>
            {rule.enabled ? 'פעיל' : 'כבוי'}
          </span>
          <div
            onClick={handleToggle}
            style={{
              width: 44, height: 24, borderRadius: 12, position: 'relative',
              background: rule.enabled ? 'var(--success)' : 'var(--gray-300)',
              transition: 'background 0.2s', cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'right 0.2s',
              right: rule.enabled ? 3 : 23,
            }} />
          </div>
        </label>
      </div>

      {/* Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>
            סף (mg/dL)
          </label>
          <input
            type="number"
            value={editing.threshold}
            onChange={e => setEditing(p => ({ ...p, threshold: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>
            משך (דקות)
          </label>
          <input
            type="number"
            min="0"
            value={editing.durationMinutes}
            onChange={e => setEditing(p => ({ ...p, durationMinutes: e.target.value }))}
            style={inputStyle}
          />
          {parseInt(editing.durationMinutes) === 0 && (
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>מיידי</div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>
            קירור (דקות)
          </label>
          <input
            type="number"
            min="1"
            value={editing.cooldownMinutes}
            onChange={e => setEditing(p => ({ ...p, cooldownMinutes: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Last fired */}
      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
        {rule.lastFiredAt
          ? `📨 נשלח לאחרונה ${timeAgo(rule.lastFiredAt)} · ${rule.lastFiredValue} mg/dL`
          : '📭 טרם נשלחה התראה'}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary"
          style={{ fontSize: 13, padding: '6px 16px', opacity: dirty ? 1 : 0.45 }}
        >
          {saving ? '...' : '💾 שמור'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            fontSize: 13, padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--gray-300)', background: 'transparent',
            color: 'var(--gray-600)', cursor: 'pointer',
          }}
        >
          {testing ? '...' : '📤 שלח בדיקה'}
        </button>

        {flash === 'saved'  && <span style={{ fontSize: 13, color: 'var(--success)' }}>✓ נשמר</span>}
        {flash === 'tested' && <span style={{ fontSize: 13, color: 'var(--success)' }}>✓ נשלח לווטסאפ</span>}
        {flash === 'error'  && <span style={{ fontSize: 13, color: 'var(--danger)'  }}>✗ שגיאה</span>}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--gray-200)', background: 'var(--bg)',
  color: 'var(--gray-700)', boxSizing: 'border-box',
}

export default function AlertAdmin() {
  const [rules,   setRules]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await getAlertRules()
      setRules(data.rules || [])
    } catch (err) {
      setError('לא ניתן לטעון את ההתראות')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSaved(updated) {
    setRules(prev => prev.map(r =>
      r.id === updated.id
        ? { ...r,
            threshold:       updated.threshold,
            durationMinutes: updated.duration_minutes ?? r.durationMinutes,
            cooldownMinutes: updated.cooldown_minutes ?? r.cooldownMinutes,
            enabled:         updated.enabled,
          }
        : r
    ))
  }

  return (
    <div className="page" dir="rtl">
      <h1 className="page-title">🔔 ניהול התראות</h1>

      <div className="card" style={{ marginBottom: 16, background: 'var(--gray-50, #f9f9f9)' }}>
        <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6 }}>
          <strong>קבוצת וואטסאפ:</strong> שניידר
          &nbsp;·&nbsp;
          <strong>הודעות נשלחות דרך:</strong> Alfred (WAHA)
          <br />
          <strong>משך 0</strong> = התראה מיידית על קריאה בודדת&nbsp;·&nbsp;
          <strong>קירור</strong> = זמן מינימלי בין התראות חוזרות
        </div>
      </div>

      {loading && <div className="loading">טוען...</div>}
      {error   && <div className="alert alert-warning">{error}</div>}

      {rules.map(rule => (
        <RuleCard key={rule.id} rule={rule} onSaved={handleSaved} />
      ))}
    </div>
  )
}
