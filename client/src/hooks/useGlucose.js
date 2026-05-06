/**
 * useGlucose — React hook for live Dexcom glucose data
 *
 * 1. Connects to the SSE stream (/api/glucose/stream) for real-time push.
 * 2. Falls back to REST polling every 30 s if SSE is unavailable or the
 *    connection drops.
 *
 * Returns:
 *   {
 *     currentReading,   // { id, timestamp, value, trend, trendArrow } | null
 *     history,          // array of readings (last 24 h)
 *     stats,            // { avg, min, max, readings, timeInRangePct } | null
 *     isStale,          // true if last reading is > 12 min old
 *     isConnected,      // true while SSE is open
 *   }
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const GLUCOSE_BASE = '/api/glucose'
const STALE_MINUTES = 12
const POLL_INTERVAL_MS = 30_000   // fallback polling interval
const SSE_RETRY_MS = 10_000       // how long to wait before re-opening SSE

function isStaleTs(timestamp) {
  if (!timestamp) return true
  return (Date.now() - new Date(timestamp).getTime()) > STALE_MINUTES * 60_000
}

export function useGlucose({ historyHours = 24, statsHours = 24 } = {}) {
  const [currentReading, setCurrentReading] = useState(null)
  const [history,        setHistory]        = useState([])
  const [stats,          setStats]          = useState(null)
  const [isStale,        setIsStale]        = useState(true)
  const [isConnected,    setIsConnected]    = useState(false)

  const sseRef        = useRef(null)
  const pollTimerRef  = useRef(null)
  const staleTimerRef = useRef(null)
  const mountedRef    = useRef(true)

  // ── REST helpers ──────────────────────────────────────────────────────────

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${GLUCOSE_BASE}/latest`)
      if (!res.ok) return
      const { reading, isStale: stale } = await res.json()
      if (!mountedRef.current) return
      if (reading) setCurrentReading(reading)
      setIsStale(stale)
    } catch (_) { /* network error — ignore */ }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${GLUCOSE_BASE}/history?hours=${historyHours}`)
      if (!res.ok) return
      const { readings } = await res.json()
      if (mountedRef.current) setHistory(readings ?? [])
    } catch (_) {}
  }, [historyHours])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${GLUCOSE_BASE}/stats?hours=${statsHours}`)
      if (!res.ok) return
      const { stats: s } = await res.json()
      if (mountedRef.current) setStats(s ?? null)
    } catch (_) {}
  }, [statsHours])

  const refreshAll = useCallback(() => {
    fetchLatest()
    fetchHistory()
    fetchStats()
  }, [fetchLatest, fetchHistory, fetchStats])

  // ── Stale re-check every minute ───────────────────────────────────────────

  function scheduleStaleCheck(timestamp) {
    clearTimeout(staleTimerRef.current)
    if (!timestamp) return
    const age = Date.now() - new Date(timestamp).getTime()
    const msUntilStale = Math.max(0, STALE_MINUTES * 60_000 - age + 1_000)
    staleTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setIsStale(true)
    }, msUntilStale)
  }

  // ── Apply a reading from SSE or REST ──────────────────────────────────────

  const applyReading = useCallback((reading, stale) => {
    setCurrentReading(reading)
    const s = stale ?? isStaleTs(reading?.timestamp)
    setIsStale(s)
    if (reading?.timestamp) scheduleStaleCheck(reading.timestamp)
    // Refresh history/stats in background after a new reading arrives
    fetchHistory()
    fetchStats()
  }, [fetchHistory, fetchStats]) // eslint-disable-line

  // ── SSE connection ────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(refreshAll, POLL_INTERVAL_MS)
  }, [refreshAll])

  const stopPolling = useCallback(() => {
    clearInterval(pollTimerRef.current)
  }, [])

  const openSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }

    if (!window.EventSource) {
      // Browser doesn't support SSE — fall back to polling only
      refreshAll()
      startPolling()
      return
    }

    const es = new EventSource(`${GLUCOSE_BASE}/stream`)
    sseRef.current = es

    es.onopen = () => {
      if (!mountedRef.current) return
      setIsConnected(true)
      stopPolling() // SSE is live — no need to poll
    }

    es.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'reading' && msg.reading) {
          applyReading(msg.reading, msg.isStale)
        }
      } catch (_) {}
    }

    es.onerror = () => {
      if (!mountedRef.current) return
      setIsConnected(false)
      es.close()
      sseRef.current = null
      // Start polling as fallback while SSE is down
      refreshAll()
      startPolling()
      // Retry SSE after delay
      setTimeout(() => { if (mountedRef.current) openSSE() }, SSE_RETRY_MS)
    }
  }, [applyReading, refreshAll, startPolling, stopPolling])

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true
    refreshAll()   // initial data fetch
    openSSE()      // open SSE (falls back to polling on error)

    return () => {
      mountedRef.current = false
      if (sseRef.current) sseRef.current.close()
      clearInterval(pollTimerRef.current)
      clearTimeout(staleTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { currentReading, history, stats, isStale, isConnected }
}
