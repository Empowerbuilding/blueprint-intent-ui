'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Rulebook actions — Michael edits clearance rules at /rules; the math gate
// executes them against outline geometry. Every save snapshots the full active
// rulebook into intent_rulebook_versions so any run can be traced to the exact
// ruleset it was checked against.

const RULE_TYPES = [
  'min_clearance',
  'min_dimension',
  'max_dimension',
  'no_overlap',
  'forbidden_kind',
  'required_kind',
  'elevation_bottom_height',
] as const

async function snapshotRulebook() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: active } = await supabase
    .from('intent_rules')
    .select('rule_key, description, rule_type, params, applies_to')
    .eq('active', true)
    .order('rule_key')
  if (!active) return
  const { data: latest } = await supabase
    .from('intent_rulebook_versions')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
  const nextVersion = (latest?.[0]?.version || 0) + 1
  await supabase.from('intent_rulebook_versions').insert({
    version: nextVersion,
    snapshot: active,
    created_by: user?.id ?? null,
  })
}

export async function saveRule(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') || '')
  const ruleKey = String(formData.get('rule_key') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const ruleType = String(formData.get('rule_type') || '')
  const active = formData.get('active') === 'on'

  let params: unknown
  try {
    params = JSON.parse(String(formData.get('params') || '{}'))
  } catch {
    redirect('/rules?error=params+is+not+valid+JSON')
  }
  let appliesTo: unknown
  try {
    appliesTo = JSON.parse(String(formData.get('applies_to') || '{}'))
  } catch {
    redirect('/rules?error=applies_to+is+not+valid+JSON')
  }

  if (!ruleKey || !RULE_TYPES.includes(ruleType as (typeof RULE_TYPES)[number])) {
    redirect('/rules?error=rule_key+and+a+valid+rule_type+are+required')
  }

  if (id) {
    const { data: existing } = await supabase
      .from('intent_rules')
      .select('version')
      .eq('id', id)
      .single()
    await supabase
      .from('intent_rules')
      .update({
        rule_key: ruleKey,
        description,
        rule_type: ruleType,
        params: params as object,
        applies_to: appliesTo as object,
        active,
        version: (existing?.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  } else {
    await supabase.from('intent_rules').insert({
      rule_key: ruleKey,
      description,
      rule_type: ruleType,
      params: params as object,
      applies_to: appliesTo as object,
      active,
    })
  }

  await snapshotRulebook()
  revalidatePath('/rules')
}

export async function toggleRule(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') || '')
  if (!id) return
  const { data: existing } = await supabase
    .from('intent_rules')
    .select('active, version')
    .eq('id', id)
    .single()
  if (!existing) return
  await supabase
    .from('intent_rules')
    .update({ active: !existing.active, version: (existing.version || 1) + 1, updated_at: new Date().toISOString() })
    .eq('id', id)
  await snapshotRulebook()
  revalidatePath('/rules')
}
