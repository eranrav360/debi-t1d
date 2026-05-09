import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, updateSettings, getStatistics } from '../api'
import { TabBar } from '../components/Bits'
import { IconChev, IconGear } from '../components/Icons'

export default function SettingsPage() {
  const navigate = useNavigate()

  const [stats,      setStats]      = useState(null)
  const [icrInput,   setIcrInput]   = useState('')
  const [isfInput,   setIsfInput]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  useEffect(() => {
    Promise.all([getSettings(), getStatistics()]).then(([s, st]) => {
      setStats(st)
      setIcrInput(s.icr_override != null ? String(s.icr_override) : '')
      setIsfInput(s.isf_override != null ? String(s.isf_override) : '')
    })
  }, [])

  async function save(overrides = {}) {
    setSaving(true)
    const icr = ('icr' in overrides) ? overrides.icr : (icrInput.trim() ? parseFloat(icrInput) : null)
    const isf = ('isf' in overrides) ? overrides.isf : (isfInput.trim() ? parseFloat(isfInput) : null)
    await updateSettings({ icr_override: icr, isf_override: isf })
    const st = await getStatistics()
    setStats(st)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function saveICR() { save({ icr: icrInput.trim() ? parseFloat(icrInput) : null, isf: isfInput.trim() ? parseFloat(isfInput) : null }) }
  function saveISF() { save({ icr: icrInput.trim() ? parseFloat(icrInput) : null, isf: isfInput.trim() ? parseFloat(isfInput) : null }) }

  function applySuggestion(type, value) {
    if (type === 'icr') setIcrInput(String(value))
    if (type === 'isf') setIsfInput(String(value))
  }

  const icr_auto      = stats?.icr
  const isf_auto      = stats?.isf
  const icr_override  = stats?.icr_override
  const isf_override  = stats?.isf_override
  const icr_effective = stats?.icr_effective ?? icr_auto ?? 15
  const isf_effective = stats?.isf_effective ?? isf_auto ?? 50
  const icr_pts       = stats?.data_points?.icr ?? 0
  const isf_pts       = stats?.data_points?.isf ?? 0
  const icr_suggestion = stats?.icr_suggestion
  const isf_suggestion = stats?.isf_suggestion

  return (
    <div className="app">
      {/* Header */}
      <div style={{ padding: '14px var(--pad) 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{
          border: 0, background: 'var(--card)', borderRadius: 999, width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <IconChev size={18}/>
        </button>
        <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}>הגדרות מינון</span>
        <div style={{ width: 38 }}/>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px var(--pad) 130px', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

        {/* Explanation */}
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          ניתן להגדיר ערכי ICR ו-ISF ידנית, או לאפשר לאפליקציה לחשב אותם מתוך ההיסטוריה.
          הערכים האפקטיביים בשימוש מודגשים.
        </div>

        {/* ── ICR ── */}
        <ParamSection
          label="ICR"
          labelHe="יחס אינסולין-פחמימות"
          description="יחידה אחת לכל X גרם פחמימות"
          autoValue={icr_auto}
          autoDisplay={icr_auto ? `1:${icr_auto}` : null}
          dataPoints={icr_pts}
          effectiveValue={icr_effective}
          effectiveDisplay={`1:${icr_effective}`}
          isOverridden={!!icr_override}
          inputValue={icrInput}
          onInputChange={setIcrInput}
          inputPrefix="1:"
          inputPlaceholder={icr_auto ? String(icr_auto) : '15'}
          onClear={() => { setIcrInput(''); save({ icr: null, isf: isfInput.trim() ? parseFloat(isfInput) : null }) }}
          onSave={saveICR}
          suggestion={icr_suggestion}
          onApplySuggestion={() => applySuggestion('icr', icr_suggestion?.suggested)}
        />

        {/* ── ISF ── */}
        <ParamSection
          label="ISF"
          labelHe="רגישות לאינסולין"
          description="יחידה מורידה X mg/dL"
          autoValue={isf_auto}
          autoDisplay={isf_auto ? `${isf_auto}` : null}
          dataPoints={isf_pts}
          effectiveValue={isf_effective}
          effectiveDisplay={`${isf_effective}`}
          isOverridden={!!isf_override}
          inputValue={isfInput}
          onInputChange={setIsfInput}
          inputPrefix=""
          inputPlaceholder={isf_auto ? String(isf_auto) : '50'}
          onClear={() => { setIsfInput(''); save({ icr: icrInput.trim() ? parseFloat(icrInput) : null, isf: null }) }}
          onSave={saveISF}
          suggestion={isf_suggestion}
          onApplySuggestion={() => applySuggestion('isf', isf_suggestion?.suggested)}
        />

      </div>

      {saved && (
        <div style={{
          position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 5,
          background: 'var(--good)', color: '#fff', borderRadius: 999,
          padding: '12px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700,
        }}>
          ✓ נשמר
        </div>
      )}

      <TabBar active="more"/>
    </div>
  )
}

// ── Reusable param section ───────────────────────────────────────────────────
function ParamSection({
  label, labelHe, description,
  autoValue, autoDisplay, dataPoints,
  effectiveValue, effectiveDisplay,
  isOverridden,
  inputValue, onInputChange, inputPrefix, inputPlaceholder,
  onClear, onSave,
  suggestion, onApplySuggestion,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Main card */}
      <div className="card" style={{ padding: 18 }}>
        {/* Title row */}
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div className="col" style={{ gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{label}</span>
            <span className="muted" style={{ fontSize: 12 }}>{labelHe}</span>
          </div>
          <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
              {effectiveDisplay}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: isOverridden ? 'var(--warn-soft)' : 'var(--good-soft)',
              color: isOverridden ? '#7a5a15' : 'var(--good)',
            }}>
              {isOverridden ? 'ידני' : 'אוטומטי'}
            </span>
          </div>
        </div>

        <hr className="hr" style={{ marginBottom: 14 }}/>

        {/* Auto-calculated row */}
        <div className="row-between" style={{ marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>חישוב מהיסטוריה</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
            {autoValue ? `${autoDisplay} (${dataPoints} מדידות)` : `ברירת מחדל (אין מספיק נתונים)`}
          </span>
        </div>

        {/* Manual override input */}
        <div className="col" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>עקוף ידנית</span>
          <div className="row" style={{ gap: 8 }}>
            {inputPrefix && (
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>{inputPrefix}</span>
            )}
            <input
              type="number"
              value={inputValue}
              onChange={e => onInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              className="input"
              style={{ flex: 1, fontSize: 16, fontWeight: 600 }}
              min="1"
              max={label === 'ICR' ? '50' : '300'}
              step="0.5"
            />
            <button onClick={onSave} style={{
              border: 0, background: 'var(--brand)', color: '#fff',
              borderRadius: 999, padding: '8px 16px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}>
              קבע
            </button>
          </div>
          {inputValue && (
            <button onClick={onClear} style={{
              border: 0, background: 'transparent', color: 'var(--ink-3)',
              fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'right',
            }}>
              ← חזור לחישוב אוטומטי
            </button>
          )}
          <span className="muted" style={{ fontSize: 11 }}>{description} · השאר ריק לחישוב אוטומטי</span>
        </div>
      </div>

      {/* Suggestion card */}
      {suggestion && (
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--r)',
          background: suggestion.direction === 'decrease' ? '#FEF3CD' : '#EAF4FD',
          border: `1px solid ${suggestion.direction === 'decrease' ? '#E0C060' : '#A8D0EE'}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {suggestion.direction === 'decrease' ? '📉' : '📈'}
            </span>
            <div className="col" style={{ flex: 1, gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>המלצה מהנתונים</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{suggestion.text}</span>
            </div>
          </div>
          <button
            onClick={onApplySuggestion}
            style={{
              border: 0, borderRadius: 999,
              background: suggestion.direction === 'decrease' ? 'var(--warn)' : 'var(--cold)',
              color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', alignSelf: 'flex-end',
            }}
          >
            החל {label === 'ICR' ? `1:` : ''}{suggestion.suggested}
          </button>
        </div>
      )}
    </div>
  )
}
