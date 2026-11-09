'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function UploadInspo({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setMsg(null)
    const supabase = createClient()
    let ok = 0
    const analyzed: string[] = []
    for (const file of Array.from(files)) {
      const path = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage
        .from('intent-inspo')
        .upload(path, file, { upsert: false })
      if (upErr) {
        setMsg(`upload failed: ${upErr.message}`)
        continue
      }
      const { data: inserted, error: dbErr } = await supabase
        .from('intent_inspo_images')
        .insert({ project_id: projectId, storage_path: path })
        .select('id')
        .single()
      if (dbErr || !inserted) {
        setMsg(`db insert failed: ${dbErr.message}`)
        continue
      }
      ok++
      // vision analysis (fire and collect — failures are non-fatal)
      try {
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: inserted.id }),
        })
        if (res.ok) {
          const a = await res.json()
          analyzed.push(a.suggested_room)
        }
      } catch {
        /* analysis is best-effort */
      }
    }
    setBusy(false)
    if (ok) {
      setMsg(
        analyzed.length
          ? `${ok} uploaded · ${analyzed.length} analyzed — suggested rooms: ${[...new Set(analyzed)].join(', ')}`
          : `${ok} image(s) uploaded — assign them to rooms below`
      )
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer bg-gold hover:bg-gold-light text-bh-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
        {busy ? 'Uploading + analyzing…' : 'Upload inspo images'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {msg && <span className="text-xs text-neutral-400 max-w-md">{msg}</span>}
    </div>
  )
}
