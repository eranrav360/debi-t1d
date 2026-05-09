import { useNavigate } from 'react-router-dom'
import { TabBar } from '../components/Bits'
import { IconSyringe, IconMeal, IconBell, IconStats, IconChev, IconGear } from '../components/Icons'

const ITEMS = [
  { icon: IconSyringe, label: 'רישום הזרקה',       sub: 'נובורפיד או טרגלודק',    route: '/injection', tint: 'var(--good-soft)',  color: 'var(--good)' },
  { icon: IconMeal,    label: 'ארוחה ללא הזרקה',   sub: 'ארוחה חופשית עם מדידה',  route: '/free-meal', tint: 'var(--brand-tint)', color: 'var(--brand)' },
  { icon: IconStats,   label: 'מאגר מזון',          sub: 'חפש, הוסף ועדכן פריטים', route: '/foods',     tint: 'var(--warn-soft)',  color: 'var(--warn)' },
  { icon: IconBell,    label: 'ניהול התראות',       sub: 'WhatsApp · קבוצת שניידר', route: '/alerts',   tint: 'var(--cold-soft)',  color: 'var(--cold)' },
  { icon: IconGear,    label: 'הגדרות מינון',       sub: 'ICR · ISF · ערכי עקיפה',  route: '/settings', tint: 'var(--bg-warm)',    color: 'var(--ink-2)' },
]

export default function More() {
  const navigate = useNavigate()
  return (
    <div className="app">
      {/* Header */}
      <div style={{ padding: '14px var(--pad) 6px', flexShrink: 0 }}>
        <span className="serif" style={{ fontSize: 22, fontWeight: 500 }}>עוד</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px var(--pad) 100px', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {ITEMS.map((item, i) => {
            const Ico = item.icon
            return (
              <div key={item.route}>
                <div
                  className="row-between"
                  onClick={() => navigate(item.route)}
                  style={{ padding: '14px 14px', cursor: 'pointer', gap: 12 }}
                >
                  <div className="row" style={{ gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: item.tint, color: item.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Ico size={20} stroke={1.8}/>
                    </div>
                    <div className="col" style={{ gap: 1 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{item.label}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{item.sub}</span>
                    </div>
                  </div>
                  <div style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
                    <IconChev size={16} dir="right"/>
                  </div>
                </div>
                {i < ITEMS.length - 1 && <hr className="hr" style={{ marginInline: 66 }}/>}
              </div>
            )
          })}
        </div>

        <div className="muted" style={{ fontSize: 12, textAlign: 'center', paddingTop: 8 }}>
          דבי · ניהול סוכרת לאיתי
        </div>
      </div>

      <TabBar active="more"/>
    </div>
  )
}
