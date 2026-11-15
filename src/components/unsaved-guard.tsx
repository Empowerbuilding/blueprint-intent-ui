'use client'

// Unsaved-typing guard (post-pilot UX item): any typing on this page that has
// not been saved yet shows a badge and warns on tab close. Server actions
// revalidate the page on save, which remounts this component clean.

import { useEffect, useState } from 'react'

export function UnsavedGuard() {
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const onInput = () => setDirty(true)
    const onSubmit = () => setDirty(false)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    document.addEventListener('input', onInput)
    document.addEventListener('submit', onSubmit)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('input', onInput)
      document.removeEventListener('submit', onSubmit)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty])

  if (!dirty) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-amber-700 bg-amber-950/90 px-4 py-2 text-sm text-amber-200 shadow-2xl shadow-black/60 backdrop-blur"
      role="status"
    >
      ✎ Unsaved typing — save before you leave
    </div>
  )
}
