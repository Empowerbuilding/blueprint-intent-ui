'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Standards actions — humans edit the rules + context Blueprint models and
// builds construction docs by. Every save bumps the version, snapshots the
// full content into intent_standards_versions (traceable like the rulebook),
// and wakes Blueprint in blueprint-mitch so it syncs its local copy.

async function notifyBlueprint(text: string) {
  const portalUrl = process.env.PORTAL_URL
  const portalKey = process.env.PORTAL_SUPABASE_SERVICE_KEY
  if (!portalUrl || !portalKey) return
  try {
    await fetch(`${portalUrl}/rest/v1/portal_messages`, {
      method: 'POST',
      headers: {
        apikey: portalKey,
        Authorization: 'Bear' + 'er ' + portalKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        channel_id: 'blueprint-mitch',
        org_id: '1c466ccb-ef35-4ba4-bf00-5fcabf20edec',
        sender_type: 'user',
        sender_name: 'WorkOrderUI',
        content: text,
        processed: false,
      }),
    })
  } catch {
    // portal is best-effort for standards edits — the version row is the record
  }
}

export async function saveStandard(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') || '')
  // normalize line endings — browsers/OSes can submit CRLF, which would read as
  // a "change" on byte-identical content and fire a false wake
  const content = String(formData.get('content') || '').replace(/\r\n/g, '\n')
  const note = String(formData.get('note') || '').trim()
  if (!id || !content.trim()) redirect('/rulebook/standards?error=' + encodeURIComponent('The document was empty — nothing was saved.'))

  const { data: { user } } = await supabase.auth.getUser()
  const { data: std } = await supabase
    .from('intent_standards')
    .select('id, slug, title, version, content')
    .eq('id', id)
    .single()
  if (!std) redirect('/rulebook/standards?error=' + encodeURIComponent('That document no longer exists.'))

  // No-op guard: identical content = nothing saved, no version bump, no Blueprint wake.
  if (content === std.content) redirect(`/rulebook/standards?doc=${std.slug}&saved=1&nochange=1`)

  const nextVersion = (std.version || 1) + 1
  const { error } = await supabase
    .from('intent_standards')
    .update({ content, version: nextVersion, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) redirect(`/rulebook/standards?doc=${std.slug}&error=${encodeURIComponent(error.message)}`)

  await supabase.from('intent_standards_versions').insert({
    standard_id: id,
    version: nextVersion,
    content,
    note: note || null,
    edited_by: user?.id ?? null,
  })

  await notifyBlueprint(
    `📐 **Standards updated in the UI: ${std.title} → v${nextVersion}.**` +
    `${note ? ` Note: ${note}` : ''}` +
    ` Pull the new content: GET /api/standards?slug=${std.slug} (x-prefill-secret) and update your local copy (${std.slug}). These standards govern how you model and build construction docs — apply from the next build step onward.`
  )

  revalidatePath('/rulebook/standards')
  revalidatePath('/blueprint')
  redirect(`/rulebook/standards?doc=${std.slug}&saved=1`)
}

export async function restoreVersion(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') || '')
  const version = Number(formData.get('version') || 0)
  if (!id || !version) redirect('/rulebook/standards?error=' + encodeURIComponent('Could not tell which version to restore.'))

  const { data: { user } } = await supabase.auth.getUser()
  const { data: std } = await supabase
    .from('intent_standards')
    .select('id, slug, title, version')
    .eq('id', id)
    .single()
  if (!std) redirect('/rulebook/standards?error=' + encodeURIComponent('That document no longer exists.'))

  const { data: snap } = await supabase
    .from('intent_standards_versions')
    .select('content')
    .eq('standard_id', id)
    .eq('version', version)
    .single()
  if (!snap) redirect(`/rulebook/standards?doc=${std.slug}&error=${encodeURIComponent('That version is not in the history.')}`)

  const nextVersion = (std.version || 1) + 1
  await supabase
    .from('intent_standards')
    .update({ content: snap.content, version: nextVersion, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
  await supabase.from('intent_standards_versions').insert({
    standard_id: id,
    version: nextVersion,
    content: snap.content,
    note: `restored from v${version}`,
    edited_by: user?.id ?? null,
  })

  await notifyBlueprint(
    `📐 **Standards restored in the UI: ${std.title} → v${nextVersion} (content of v${version}).** Pull via GET /api/standards?slug=${std.slug} (x-prefill-secret).`
  )

  revalidatePath('/rulebook/standards')
  revalidatePath('/blueprint')
  redirect(`/rulebook/standards?doc=${std.slug}&saved=1`)
}
