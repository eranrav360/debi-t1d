import { useState, useEffect } from 'react'

const MQ = '(orientation: landscape) and (max-height: 520px)'

export function useLandscape() {
  const [landscape, setLandscape] = useState(() => window.matchMedia(MQ).matches)

  useEffect(() => {
    const mq = window.matchMedia(MQ)
    const handler = (e) => setLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return landscape
}
