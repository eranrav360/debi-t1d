import { useEffect, useState, useCallback } from 'react'
import { getAlertRules, updateAlertRule, testAlertRule } from '../api'
import { ScreenShell, SectionHeader } from '../components/ScreenShell'
import { SensorPie } from '../components/Bits'
import { IconCheck } from '../components/Icons'

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

// Visual tone → CSS vars
const TONE_COLOR = { bad: 'var(--bad)',  cold: 'var(--cold)',  warn: 'var(--warn)' }
const TONE_BG    = { bad: 'var(--bad-soft)', cold: 'var(--cold-soft)', warn: 'var(--warn-soft)' }
const EMOJI_MAP  = { urgentLow: '🚨', lowSustained: '⚠️', highSustained: '📈' }
const TONE_MAP   = { urgentLow: 'bad', lowSustained: 'cold', highSustained: 'warn' }

// Functional Switch component
function Switch({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 44, height: 26, borderRadius: 999,
        background: on ? 'var(--good)' : 'var(--ink-4)',
        position: 'relative', transition: 'background .2s',
        flexShrink: 0, cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        [on ? 'right' : 'left']: 3,
        width: 20, height: 20, borderRadius: 999,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'right .2s, left .2s',
      }}/>
    </div>
  )
}

function FieldCell({ label, value }) {
  return (
    <div className="col" style={{ background: 'var(--card)', padding: '10px 12px', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>
      <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function RuleCard({ rule: initial, onSaved }) {
  const [rule,    setRule]    = useState(initial)
  const [editing, setEditing] = useState({ threshold: initial.threshold, durationMinutes: initial.durationMinutes, cooldownMinutes: initial.cooldownMinutes })
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [flash,   setFlash]   = useState(null)

  useEffect(() => {
    setRule(initial)
    setEditing({ threshold: initial.threshold, durationMinutes: initial.durationMinutes, cooldownMinutes: initial.cooldownMinutes })
  }, [initial])

  function showFlash(type) { setFlash(type); setTimeout(() => setFlash(null), 2500) }

  async function handleToggle() {
    setSaving(true)
    try { const u = await updateAlertRule(rule.id, { enabled: !rule.enabled }); setRule(u); onSaved(u) }
    catch { showFlash('error') } finally { setSaving(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const u = await updateAlertRule(rule.id, {
        threshold:        parseInt(editing.threshold),
        duration_minutes: parseInt(editing.durationMinutes),
        cooldown_minutes: parseInt(editing.cooldownMinutes),
      })
      setRule(u); onSaved(u); showFlash('saved')
    } catch { showFlash('error') } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true)
    try { await testAlertRule(rule.id); showFlash('tested') }
    catch { showFlash('error') } finally { setTesting(false) }
  }

  const dirty =
    parseInt(editing.threshold)       !== rule.threshold       ||
    parseInt(editing.durationMinutes) !== rule.durationMinutes ||
    parseInt(editing.cooldownMinutes) !== rule.cooldownMinutes

  const tone  = TONE_MAP[rule.id] || 'warn'
  const color = TONE_COLOR[tone]
  const bg    = TONE_BG[tone]
  const emoji = EMOJI_MAP[rule.id] || '🔔'

  const thresholdLabel = `${rule.conditionType === 'BELOW' ? '<' : '>'} ${editing.threshold}`
  const durLabel = parseInt(editing.durationMinutes) === 0 ? 'מיידי' : `${editing.durationMinutes} דק׳`
  const coolLabel = `${editing.cooldownMinutes} דק׳`

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: rule.enabled ? 1 : 0.65 }}>
      {/* Header */}
      <div className="row-between" style={{ padding: '14px 14px 8px' }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {emoji}
          </div>
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{rule.nameHe}</span>
            <span className="muted tnum" style={{ fontSize: 11 }}>
              {rule.lastFiredAt ? `אחרון: ${timeAgo(rule.lastFiredAt)}` : 'טרם נשלחה'}
            </span>
          </div>
        </div>
        <Switch on={rule.enabled} onToggle={handleToggle}/>
      </div>

      {/* Fields grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--hair)', borderTop: '1px solid var(--hair)' }}>
        <FieldCell label="סף" value={thresholdLabel}/>
        <FieldCell label="משך" value={durLabel}/>
        <FieldCell label="cooldown" value={coolLabel}/>
      </div>

      {/* Edit row */}
      <div style={{ padding: '10px 14px', background: 'var(--card-alt)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { key: 'threshold',       label: 'סף' },
            { key: 'durationMinutes', label: 'משך (דק׳)' },
            { key: 'cooldownMinutes', label: 'קירור (דק׳)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
              <input
                type="number"
                value={editing[key]}
                onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 14,
                  border: `1px solid ${dirty && editing[key] != initial[key] ? 'var(--brand)' : 'var(--hair)'}`,
                  background: 'var(--card)', color: 'var(--ink)', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
            </div>
          ))}
        </div>

        {/* Action row */}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              border: 0, background: dirty ? 'var(--ink)' : 'var(--hair)',
              color: dirty ? '#fff' : 'var(--ink-3)',
              borderRadius: 999, padding: '8px 16px', fontSize: 12,
              fontWeight: 600, cursor: dirty ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
            {saving ? '...' : '💾 שמור'}
          </button>

          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              border: '1px solid var(--hair)', background: flash === 'tested' ? 'var(--good-soft)' : 'var(--card)',
              color: flash === 'tested' ? 'var(--good)' : 'var(--ink-2)',
              borderRadius: 999, padding: '8px 16px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {flash === 'tested' ? <><IconCheck size={12} stroke={2.4}/> נשלח</> : (testing ? '...' : '📤 בדיקה')}
          </button>

          {flash === 'saved'  && <span style={{ fontSize: 12, color: 'var(--good)' }}>✓ נשמר</span>}
          {flash === 'error'  && <span style={{ fontSize: 12, color: 'var(--bad)'  }}>✗ שגיאה</span>}
        </div>
      </div>
    </div>
  )
}

export default function AlertAdmin() {
  const [rules,   setRules]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await getAlertRules()
      setRules(data.rules || [])
    } catch { setError('לא ניתן לטעון את ההתראות') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSaved(updated) {
    setRules(prev => prev.map(r =>
      r.id === updated.id
        ? { ...r, threshold: updated.threshold, durationMinutes: updated.duration_minutes ?? r.durationMinutes, cooldownMinutes: updated.cooldown_minutes ?? r.cooldownMinutes, enabled: updated.enabled }
        : r
    ))
  }

  return (
    <ScreenShell title="התראות" sub="שולחות לקבוצת שניידר ב-WhatsApp" tab="more">

      {/* WhatsApp group status */}
      <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E0F4E5', color: '#1F8A4D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          💬
        </div>
        <div className="col" style={{ flex: 1, gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>קבוצת שניידר</span>
          <span className="muted" style={{ fontSize: 11 }}>WhatsApp · WAHA</span>
        </div>
        <span className="pill pill-good">פעיל</span>
      </div>

      {/* Rules list */}
      <div>
        <SectionHeader title="כללי התראה"/>
        <div className="col" style={{ gap: 'var(--gap)', marginTop: 8 }}>
          {loading && <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>טוען...</div>}
          {error   && <div style={{ padding: 12, background: 'var(--warn-soft)', borderRadius: 12, color: '#7a5a15', fontSize: 13 }}>{error}</div>}
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} onSaved={handleSaved}/>
          ))}
        </div>
      </div>

      {/* Sensor reminder */}
      <div className="card" style={{ padding: 14 }}>
        <SectionHeader title="חיישן" action="3 ימים לפני"/>
        <div className="row" style={{ marginTop: 10, gap: 12 }}>
          <SensorPie daysLeft={7}/>
          <div className="col" style={{ flex: 1, gap: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>תזכורת החלפת חיישן</span>
            <span className="muted" style={{ fontSize: 11 }}>GitHub Actions</span>
          </div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
        כל התראה נשלחת רק אם עברו &gt;cooldown מההתראה הקודמת.<br/>
        בדיקה מיידית לא משפיעה על cooldown.
      </div>

    </ScreenShell>
  )
}
