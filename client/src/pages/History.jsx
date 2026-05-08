import { useEffect, useState } from 'react'
import { getNovorapidHistory, getTregludecHistory, updatePostSugar,
         deleteNovorapid, deleteTregludec, getFreeMeals,
         updateFreeMealPostSugar, deleteFreeMeal } from '../api'
import { ScreenShell } from '../components/ScreenShell'
import { GL } from '../components/Bits'
import { IconMeal, IconBolt, IconHeart, IconArrow, IconSyringe } from '../components/Icons'

// ── Helpers ────────────────────────────────────────────────────────────────
function extractDate(rec) {
  const raw = rec.recorded_at || rec.recorded_date || ''
  return raw.slice(0, 10)
}
function extractTime(rec) {
  const raw = rec.recorded_at || ''
  return raw.slice(11, 16) || '07:00'
}
function fmtDayLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const [y, m, day] = iso.split('-')
  const label = `${day}/${m}/${y} · ${dayNames[d.getDay()]}`
  if (iso === today)     return 'היום · ' + label
  if (iso === yesterday) return 'אתמול · ' + label
  return label
}

const FILTERS = [
  { id: 'all',   label: 'הכל' },
  { id: 'meals', label: 'ארוחות' },
  { id: 'inj',   label: 'הזרקות' },
]

export default function History() {
  const [novoRecords, setNovoRecords] = useState([])
  const [tregRecords, setTregRecords] = useState([])
  const [freeRecords, setFreeRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editingPost, setEditingPost] = useState(null)
  const [postVal, setPostVal] = useState('')

  useEffect(() => {
    Promise.all([getNovorapidHistory(), getTregludecHistory(), getFreeMeals()])
      .then(([novo, treg, free]) => {
        setNovoRecords(novo)
        setTregRecords(treg)
        setFreeRecords(free)
        setLoading(false)
      })
  }, [])

  async function handleUpdatePost(id, type) {
    if (!postVal) return
    if (type === 'novo') {
      await updatePostSugar(id, parseInt(postVal))
      setNovoRecords(prev => prev.map(r => r.id === id ? { ...r, post_1hr_sugar: parseInt(postVal) } : r))
    } else {
      await updateFreeMealPostSugar(id, parseInt(postVal))
      setFreeRecords(prev => prev.map(r => r.id === id ? { ...r, post_1hr_sugar: parseInt(postVal) } : r))
    }
    setEditingPost(null)
    setPostVal('')
  }

  async function handleDelete(id, type) {
    if (!confirm('למחוק רשומה זו?')) return
    if (type === 'novo') {
      await deleteNovorapid(id)
      setNovoRecords(prev => prev.filter(r => r.id !== id))
    } else if (type === 'treg') {
      await deleteTregludec(id)
      setTregRecords(prev => prev.filter(r => r.id !== id))
    } else {
      await deleteFreeMeal(id)
      setFreeRecords(prev => prev.filter(r => r.id !== id))
    }
  }

  // Merge all events into unified timeline
  const allEvents = [
    ...novoRecords.map(r => ({
      id: `novo-${r.id}`, rawId: r.id, type: r.total_carbs > 0 ? 'meal' : 'inj',
      date: extractDate(r), time: extractTime(r),
      title: r.total_carbs > 0 ? 'ארוחה + הזרקה' : 'הזרקת נובורפיד',
      sub: r.meal_items?.map(m => m.food_name).join(', ') || (r.total_carbs > 0 ? `${r.total_carbs}ג׳ פחמימות` : ''),
      dose: `${r.dose_given} יח׳ נובורפיד`,
      preSugar: r.pre_sugar, postSugar: r.post_1hr_sugar,
      canUpdatePost: !r.post_1hr_sugar,
      postType: 'novo', ts: r.recorded_at || '',
    })),
    ...tregRecords.map(r => ({
      id: `treg-${r.id}`, rawId: r.id, type: 'long',
      date: r.recorded_date || '', time: '07:00',
      title: 'טרגלודק', sub: 'מנה יומית',
      dose: `${r.dose} יח׳`, preSugar: null, postSugar: null,
      canUpdatePost: false, ts: (r.recorded_date || '') + 'T07:00',
    })),
    ...freeRecords.map(r => ({
      id: `free-${r.id}`, rawId: r.id, type: 'free',
      date: extractDate(r), time: extractTime(r),
      title: 'ארוחה ללא הזרקה',
      sub: r.carbs > 0 ? `${r.carbs}ג׳ פחמימות` : '',
      dose: null, preSugar: r.pre_sugar, postSugar: r.post_1hr_sugar,
      canUpdatePost: !r.post_1hr_sugar,
      postType: 'free', ts: r.recorded_at || '',
    })),
  ].sort((a, b) => (b.ts > a.ts ? 1 : -1))

  // Filter
  function visible(ev) {
    if (filter === 'all')   return true
    if (filter === 'meals') return ev.type === 'meal' || ev.type === 'free'
    if (filter === 'inj')   return ev.type === 'inj'  || ev.type === 'long'
    return true
  }

  // Group by day
  const groups = []
  const seen = {}
  for (const ev of allEvents.filter(visible)) {
    if (!seen[ev.date]) { seen[ev.date] = true; groups.push({ date: ev.date, items: [] }) }
    groups[groups.length - 1].items.push(ev)
  }

  return (
    <ScreenShell title="היסטוריה" sub="ציר זמן מלא" tab="history">

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            border: 0, background: filter === f.id ? 'var(--ink)' : 'var(--card)',
            color: filter === f.id ? '#fff' : 'var(--ink-2)',
            padding: '8px 14px', borderRadius: 999, fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
            boxShadow: filter === f.id ? 'none' : 'var(--sh-1)', flexShrink: 0,
          }}>{f.label}</button>
        ))}
      </div>

      {loading && <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>טוען...</div>}

      {!loading && groups.length === 0 && (
        <div className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>אין רשומות עדיין</div>
      )}

      {groups.map(group => (
        <div key={group.date}>
          <div className="row-between" style={{ marginBottom: 8, paddingInline: 4 }}>
            <span className="label">{fmtDayLabel(group.date)}</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {group.items.map((ev, i) => (
              <div key={ev.id}>
                <HistoryRow
                  ev={ev}
                  editing={editingPost === ev.id}
                  postVal={postVal}
                  setPostVal={setPostVal}
                  onEdit={() => { setEditingPost(editingPost === ev.id ? null : ev.id); setPostVal('') }}
                  onSavePost={() => handleUpdatePost(ev.rawId, ev.postType)}
                  onDelete={() => handleDelete(ev.rawId, ev.type === 'long' ? 'treg' : ev.type === 'free' ? 'free' : 'novo')}
                />
                {i < group.items.length - 1 && <hr className="hr" style={{ marginInline: 14 }}/>}
              </div>
            ))}
          </div>
        </div>
      ))}

    </ScreenShell>
  )
}

const ICON_MAP = {
  meal: { Ico: IconMeal,    color: 'var(--brand)',  bg: 'var(--brand-tint)' },
  inj:  { Ico: IconSyringe, color: 'var(--brand)',  bg: 'var(--brand-tint)' },
  long: { Ico: IconBolt,    color: 'var(--good)',   bg: 'var(--good-soft)' },
  free: { Ico: IconMeal,    color: 'var(--ink-2)',  bg: 'var(--bg-warm)' },
}

function HistoryRow({ ev, editing, postVal, setPostVal, onEdit, onSavePost, onDelete }) {
  const { Ico, color, bg } = ICON_MAP[ev.type] || ICON_MAP.meal
  return (
    <div className="col" style={{ padding: '12px 14px', gap: 8 }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="tnum muted" style={{ fontSize: 11, fontWeight: 600, minWidth: 40, paddingTop: 6, flexShrink: 0 }}>{ev.time}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 }}>
          <Ico size={16} stroke={1.8}/>
        </div>
        <div className="col" style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{ev.title}</span>
          {ev.sub && <span className="muted" style={{ fontSize: 11 }}>{ev.sub}</span>}
          {ev.dose && <span style={{ fontSize: 12, color: 'var(--brand-deep)', fontWeight: 600, marginTop: 1 }}>{ev.dose}</span>}
        </div>
        <button
          onClick={onDelete}
          style={{ border: 0, background: 'transparent', color: 'var(--ink-4)', fontSize: 14, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
        >✕</button>
      </div>

      {/* Pre/Post sugar + update */}
      {ev.type !== 'long' && (
        <div className="row" style={{ marginInlineStart: 52, gap: 10, flexWrap: 'wrap' }}>
          {ev.preSugar && (
            <span style={{ fontSize: 12 }}>
              לפני: <strong style={{ color: GL.color(ev.preSugar) }}>{ev.preSugar}</strong>
            </span>
          )}
          {ev.postSugar ? (
            <>
              <span className="muted" style={{ fontSize: 11 }}>·</span>
              <span style={{ fontSize: 12 }}>
                אחרי שעה: <strong style={{ color: GL.color(ev.postSugar) }}>{ev.postSugar}</strong>
              </span>
              <button onClick={onEdit} style={{ border: 0, background: 'transparent', color: 'var(--brand-deep)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>ערוך</button>
            </>
          ) : ev.canUpdatePost ? (
            <button onClick={onEdit} style={{
              border: '1px dashed var(--brand)', background: 'var(--brand-tint)',
              color: 'var(--brand-deep)', padding: '5px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ הוסף סוכר אחרי שעה</button>
          ) : null}

          {editing && (
            <div className="row" style={{ gap: 6 }}>
              <input
                type="number" value={postVal}
                onChange={e => setPostVal(e.target.value)}
                placeholder="mg/dL" autoFocus
                style={{
                  width: 90, padding: '6px 10px', borderRadius: 999,
                  border: '1px solid var(--brand)', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'center',
                }}
                onKeyDown={e => e.key === 'Enter' && onSavePost()}
              />
              <button onClick={onSavePost}
                style={{ border: 0, background: 'var(--good)', color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ✓
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
