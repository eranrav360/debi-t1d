// Icons.jsx — SVG icon library for Debi (ES module)
import React from 'react'

const Icon = ({ size = 20, color = 'currentColor', stroke = 1.6, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const IconHome = (p) => <Icon {...p}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></Icon>

export const IconMeal = (p) => <Icon {...p}>
  <path d="M5 3v8a3 3 0 0 0 3 3v7"/>
  <path d="M8 3v6"/>
  <path d="M11 3v6"/>
  <path d="M16 3c-1.5 0-3 2-3 5s1.5 5 3 5v8"/>
</Icon>

export const IconSyringe = (p) => <Icon {...p}>
  <path d="M18 2l4 4"/>
  <path d="M15 5l4 4"/>
  <path d="M11 9l4 4"/>
  <path d="M5 15l8-8 4 4-8 8H5z"/>
  <path d="M5 19l-2 2"/>
</Icon>

export const IconHistory = (p) => <Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 7v5l3 2"/>
</Icon>

export const IconStats = (p) => <Icon {...p}>
  <path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>
</Icon>

export const IconSparkle = (p) => <Icon {...p}>
  <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5 10.2 7.7z"/>
  <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7z"/>
</Icon>

export const IconBolt = (p) => <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></Icon>

export const IconArrow = ({ dir = 'flat', size = 16, color = 'currentColor', stroke = 2 }) => {
  const angles = { rapidUp: -90, up: -45, flat: 0, down: 45, rapidDown: 90 }
  const a = angles[dir] ?? 0
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         style={{ transform: `rotate(${a}deg)`, transition: 'transform .25s' }}
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="M14 6l6 6-6 6"/>
    </svg>
  )
}

export const IconDot = ({ size = 8, color = '#6E9F6F' }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block' }}/>
)

export const IconChev = ({ size = 16, dir = 'left' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       style={{ transform: dir === 'left' ? 'rotate(180deg)' : 'none' }}>
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

export const IconPlus    = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>
export const IconMore    = (p) => <Icon {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></Icon>

export const IconCamera  = (p) => <Icon {...p}>
  <path d="M3 8h3l2-3h8l2 3h3v11H3z"/>
  <circle cx="12" cy="13" r="4"/>
</Icon>

export const IconSensor  = (p) => <Icon {...p}>
  <circle cx="12" cy="12" r="3"/>
  <path d="M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8"/>
  <path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>
</Icon>

export const IconBell    = (p) => <Icon {...p}>
  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/>
  <path d="M10 20a2 2 0 0 0 4 0"/>
</Icon>

export const IconHeart   = (p) => <Icon {...p}>
  <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>
</Icon>

export const IconCheck   = (p) => <Icon {...p}><path d="M5 12l5 5L20 7"/></Icon>
export const IconClock   = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>

export const IconGear    = (p) => <Icon {...p}>
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</Icon>

export const IconDoc     = (p) => <Icon {...p}>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="16" y1="13" x2="8" y2="13"/>
  <line x1="16" y1="17" x2="8" y2="17"/>
  <line x1="10" y1="9" x2="8" y2="9"/>
</Icon>

export const IconMic     = (p) => <Icon {...p}>
  <rect x="9" y="3" width="6" height="12" rx="3"/>
  <path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
</Icon>
