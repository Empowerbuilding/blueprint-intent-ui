'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Tells the server which time zone this browser is in (cookie "tz"), so every time on every page
// is shown in the viewer's own time. If the zone was unknown or has changed, the page refreshes once.
export function TimeZone({ current }: { current: string }) {
  const router = useRouter()
  useEffect(() => {
    let tz = ''
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      tz = ''
    }
    if (!tz) return
    const has = document.cookie.split('; ').some((c) => c === 'tz=' + encodeURIComponent(tz))
    if (!has) document.cookie = 'tz=' + encodeURIComponent(tz) + '; path=/; max-age=31536000; samesite=lax'
    if (tz !== current) router.refresh()
  }, [current, router])
  return null
}
