// Bits.jsx — shared visual atoms: GL, Sparkline, GlucoseReadout, SensorPie, TabBar, AskDebi
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHome, IconHistory, IconPlus, IconStats, IconMore, IconArrow, IconSparkle, IconMic } from './Icons'

// ── Glucose classifier ──────────────────────────────────────────────────────
export const GL = {
  classify(v) {
    if (v < 60)   return 'urgent'
    if (v < 70)   return 'low'
    if (v <= 180) return 'good'
    if (v <= 250) return 'high'
    return 'urgentHigh'
  },
  color(v) {
    return ({ urgent: 'var(--bad)', low: 'var(--cold)', good: 'var(--good)', high: 'var(--warn)', urgentHigh: 'var(--bad)' })[GL.classify(v)]
  },
  soft(v) {
    return ({ urgent: 'var(--bad-soft)', low: 'var(--cold-soft)', good: 'var(--good-soft)', high: 'var(--warn-soft)', urgentHigh: 'var(--bad-soft)' })[GL.classify(v)]
  },
  label(v) {
    return ({ urgent: 'נמוך מאוד', low: 'נמוך', good: 'בטווח', high: 'גבוה', urgentHigh: 'גבוה מאוד' })[GL.classify(v)]
  },
  pillClass(v) {
    return ({ urgent: 'pill-bad', low: 'pill-cold', good: 'pill-good', high: 'pill-warn', urgentHigh: 'pill-bad' })[GL.classify(v)]
  },
}

// ── Sparkline ───────────────────────────────────────────────────────────────
export function Sparkline({
  values = [], width = 280, height = 60, color = 'var(--good)',
  fill = true, band = null, dots = false, last = true, padX = 4, padY = 6,
}) {
  if (!values.length) return null
  const min = Math.min(...values, band ? band[0] - 10 : Infinity)
  const max = Math.max(...values, band ? band[1] + 10 : -Infinity)
  const range = Math.max(max - min, 1)
  const x = (i) => padX + (i / (values.length - 1)) * (width - padX * 2)
  const y = (v) => padY + (1 - (v - min) / range) * (height - padY * 2)
  const pts = values.map((v, i) => [x(i), y(v)])
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = path + ` L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`
  const last_ = pts[pts.length - 1]
  const id = 'sg-' + Math.random().toString(36).slice(2, 7)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {band && (
        <rect x="0" y={y(band[1])} width={width} height={Math.max(0, y(band[0]) - y(band[1]))}
              fill="var(--good-soft)" opacity="0.55" rx="3"/>
      )}
      {fill && <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`}/>
      </>}
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {dots && pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill={color} opacity={i === pts.length - 1 ? 1 : 0.35}/>
      ))}
      {last && (
        <>
          <circle cx={last_[0]} cy={last_[1]} r="6" fill="#fff"/>
          <circle cx={last_[0]} cy={last_[1]} r="3.5" fill={color}/>
        </>
      )}
    </svg>
  )
}

// ── Big glucose readout ─────────────────────────────────────────────────────
export function GlucoseReadout({ value = 142, dir = 'up', size = 'lg', unit = true }) {
  const fontSize = size === 'xl' ? 96 : size === 'lg' ? 76 : size === 'md' ? 56 : 40
  const c = GL.color(value)
  return (
    <div className="row" style={{ alignItems: 'baseline', gap: 10, justifyContent: 'flex-start' }}>
      <span className="bignum" style={{ fontSize, color: c, lineHeight: 0.9 }}>{value}</span>
      <div className="col" style={{ alignItems: 'flex-start', gap: 2 }}>
        <IconArrow dir={dir} size={size === 'xl' ? 28 : 22} color={c} stroke={2.6}/>
        {unit && <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>mg/dL</span>}
      </div>
    </div>
  )
}

// ── Sensor ring countdown ───────────────────────────────────────────────────
export function SensorPie({ daysLeft = 7, total = 10, size = 40 }) {
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(daysLeft / total, 1)
  const color = daysLeft <= 2 ? 'var(--bad)' : daysLeft <= 4 ? 'var(--warn)' : 'var(--good)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--hair)" strokeWidth="2.5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.5"
              strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  )
}

// ── Bottom tab bar (React Router–wired) ─────────────────────────────────────
const TAB_ROUTES = { home: '/', history: '/history', stats: '/statistics', more: '/more' }

export function TabBar({ active }) {
  const navigate = useNavigate()
  const tabs = [
    { id: 'home',    Icon: IconHome,    label: 'בית' },
    { id: 'history', Icon: IconHistory, label: 'היסטוריה' },
    { id: 'log',     Icon: IconPlus,    label: '', primary: true },
    { id: 'stats',   Icon: IconStats,   label: 'סטטיסטיקה' },
    { id: 'more',    Icon: IconMore,    label: 'עוד' },
  ]
  return (
    <div className="tabbar">
      {tabs.map(t => {
        if (t.primary) {
          return (
            <div key="log" className="tab" style={{ flex: 0 }} onClick={() => navigate('/meal')}>
              <div style={{
                width: 50, height: 50, borderRadius: 999, background: 'var(--brand)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(215,116,83,0.45)', marginTop: -10,
              }}>
                <t.Icon size={26} stroke={2.2}/>
              </div>
            </div>
          )
        }
        return (
          <div key={t.id}
               className={`tab ${active === t.id ? 'is-active' : ''}`}
               onClick={() => navigate(TAB_ROUTES[t.id])}>
            <t.Icon size={22} stroke={1.8}/>
            <span>{t.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Ask Debi bar ────────────────────────────────────────────────────────────
export function AskDebi({ inset = false }) {
  return (
    <div className="ask" style={{
      background: inset ? 'var(--card-alt)' : 'var(--card)',
      boxShadow: inset ? 'none' : 'var(--sh-2)',
      border: inset ? '1px solid var(--hair)' : '0.5px solid var(--hair)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999, background: 'var(--brand-tint)',
        color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <IconSparkle size={16} stroke={1.8}/>
      </div>
      <input placeholder="שאל את דבי…" readOnly/>
      <div style={{ color: 'var(--ink-3)', flexShrink: 0 }}><IconMic size={18} stroke={1.6}/></div>
    </div>
  )
}
