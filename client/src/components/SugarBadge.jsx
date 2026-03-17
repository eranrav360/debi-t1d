export default function SugarBadge({ value }) {
  if (!value) return <span className="sugar-badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>—</span>
  const cls = value < 70 ? 'sugar-low' : value <= 140 ? 'sugar-normal' : value <= 200 ? 'sugar-high' : 'sugar-very-high'
  return <span className={`sugar-badge ${cls}`}>{value}</span>
}
