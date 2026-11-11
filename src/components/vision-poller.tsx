'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Refreshes the server-rendered data while a background check is running.
// Replaces the old <meta refresh>, which reloaded the whole page every 30 s and
// wiped anything half-typed. router.refresh() re-renders server components in
// place; as a second guard it does nothing while the cursor is in a text field.
export function VisionPoller({ everyMs = 15000 }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (!typing && document.visibilityState === 'visible') router.refresh()
    }, everyMs)
    return () => clearInterval(timer)
  }, [router, everyMs])
  return null
}
