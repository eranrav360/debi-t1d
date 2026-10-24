// Family access code: asked once per device, sent as X-Debi-Key on every API call.
const STORE = 'debiAccessKey'

export const getKey = () => { try { return localStorage.getItem(STORE) || '' } catch { return '' } }
export const setKey = (k) => { try { localStorage.setItem(STORE, k) } catch {} }
export const clearKey = () => { try { localStorage.removeItem(STORE) } catch {} }

const API_ROOT = (import.meta.env.VITE_API_URL || '') + '/api'

/** Is this typed code right? (asks the server; works before the code is enforced too) */
export async function checkKey(k) {
  const r = await window.__debiRawFetch(`${API_ROOT}/auth/check`, { headers: { 'X-Debi-Key': k } })
  return r.ok
}

/**
 * Wrap window.fetch once: any request to our /api gets the code; a 401 means the code
 * is wrong or was changed, so forget it and show the code screen again.
 */
export function installAccessKey() {
  if (window.__debiRawFetch) return
  const raw = window.fetch.bind(window)
  window.__debiRawFetch = raw
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (!url.includes('/api/')) return raw(input, init)
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
    const k = getKey()
    if (k) headers.set('X-Debi-Key', k)
    const res = await raw(input, { ...init, headers })
    if (res.status === 401 && !url.includes('/auth/check')) {
      clearKey()
      window.location.reload()
    }
    return res
  }
}
