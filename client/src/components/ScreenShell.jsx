// ScreenShell.jsx — shared chrome for inner screens
// Header: back button + centered title + optional action
// Scrollable body · optional floating AskDebi · persistent TabBar
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { TabBar, AskDebi } from './Bits'
import { IconChev } from './Icons'

export function ScreenShell({ title, sub, action, children, tab = 'home', ask = false }) {
  const navigate = useNavigate()
  return (
    <div className="app">
      {/* Header */}
      <div style={{
        padding: '14px var(--pad) 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: 0, background: 'var(--card)', borderRadius: 999,
            width: 38, height: 38, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <IconChev size={18}/>
        </button>

        <div className="col" style={{ alignItems: 'center', gap: 0, flex: 1, padding: '0 8px' }}>
          <span className="serif" style={{ fontSize: 17, fontWeight: 500 }}>{title}</span>
          {sub && <span className="muted" style={{ fontSize: 11 }}>{sub}</span>}
        </div>

        <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {action || null}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: `8px var(--pad) ${ask ? 130 : 100}px`,
        display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)',
      }}>
        {children}
      </div>

      {/* Floating Ask Debi */}
      {ask && (
        <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 4 }}>
          <AskDebi/>
        </div>
      )}

      <TabBar active={tab}/>
    </div>
  )
}

export function SectionHeader({ title, action }) {
  return (
    <div className="row-between" style={{ paddingInline: 4 }}>
      <span className="label">{title}</span>
      {action && <span style={{ fontSize: 12, color: 'var(--brand-deep)', fontWeight: 600 }}>{action}</span>}
    </div>
  )
}
