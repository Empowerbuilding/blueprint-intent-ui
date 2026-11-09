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
    for (const file of Array.from(files)) {
      const path = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage
        .from('intent-inspo')
        .upload(path, file, { upsert: false })
      if (upErr) {
        setMsg(`upload failed: ${upErr.message}`)
        continue
      }
      const { error: dbErr } = await supabase.from('intent_inspo_images').insert({
        project_id: projectId,
        storage_path: path,
      })
      if (dbErr) {
        setMsg(`db insert failed: ${dbErr.message}`)
        continue
      }
      ok++
    }
    setBusy(false)
    if (ok) {
      setMsg(`${ok} image(s) uploaded — assign them to rooms below`)
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
        {busy ? 'Uploading…' : 'Upload inspo images'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  )
}
