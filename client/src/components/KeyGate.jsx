import { useState } from 'react'
import { getKey, setKey, checkKey } from '../lib/accessKey'

/** One-time "קוד משפחה" screen before the app opens on a new device. */
export default function KeyGate({ children }) {
  const [ok, setOk] = useState(() => !!getKey())
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (ok) return children

  const submit = async (e) => {
    e.preventDefault()
    const k = code.trim().toUpperCase()
    if (!k) return
    setBusy(true); setErr('')
    try {
      if (await checkKey(k)) { setKey(k); setOk(true) }
      else setErr('הקוד לא נכון, נסו שוב')
    } catch { setErr('אין חיבור לשרת כרגע') }
    setBusy(false)
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'inherit' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>💙</div>
        <h1 style={{ margin: 0, fontSize: 24 }}>קוד משפחה</h1>
        <p style={{ margin: 0, color: '#666', fontSize: 15 }}>פעם אחת בכל מכשיר. אחר כך דבי נפתחת כרגיל.</p>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" dir="ltr"
          style={{ height: 52, fontSize: 20, textAlign: 'center', letterSpacing: 2, borderRadius: 14, border: '1.5px solid #ccc', padding: '0 12px' }} />
        {err && <div style={{ color: '#b23324', fontSize: 14 }}>{err}</div>}
        <button disabled={busy || !code.trim()} style={{ height: 52, borderRadius: 26, border: 0, background: '#2E6BD8', color: '#fff', fontSize: 17, fontWeight: 600 }}>{busy ? 'בודק…' : 'כניסה'}</button>
      </form>
    </div>
  )
}
