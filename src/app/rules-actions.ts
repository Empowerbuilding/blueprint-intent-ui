'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { fieldsToRule, keyFromDescription, RULE_TYPE_VALUES } from '@/lib/rule-text'

// Rulebook actions — Michael edits clearance rules at /rules; the math gate
// executes them against outline geometry. Every save snapshots the full active
// rulebook into intent_rulebook_versions so any run can be traced to the exact
// ruleset it was checked against.


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
    redirect('/rulebook/checks?error=' + encodeURIComponent('params is not valid JSON — nothing was saved'))
  }
  let appliesTo: unknown
  try {
    appliesTo = JSON.parse(String(formData.get('applies_to') || '{}'))
  } catch {
    redirect('/rulebook/checks?error=' + encodeURIComponent('applies_to is not valid JSON — nothing was saved'))
  }

  if (!ruleKey || !RULE_TYPE_VALUES.includes(ruleType)) {
    redirect('/rulebook/checks?error=' + encodeURIComponent('rule_key and a valid rule_type are required'))
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
  revalidatePath('/rulebook/checks')
  redirect('/rulebook/checks?saved=' + encodeURIComponent(ruleKey))
}

// Plain-language editor (Rulebook → Checks). The form posts sentence fields;
// fieldsToRule turns them into the same params / applies_to JSON the gate has
// always executed. An existing rule keeps its key and type — only its numbers,
// kinds, scope and description change.
export async function saveRuleForm(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') || '')
  const ruleType = String(formData.get('rule_type') || '')
  const description = String(formData.get('description') || '').trim()

  // explicit type annotation so TypeScript narrows after a call to back()
  const back: (message: string) => never = (message) =>
    redirect(
      '/rulebook/checks?error=' +
        encodeURIComponent(message + ' Nothing was saved.') +
        (id ? '' : '&new=' + encodeURIComponent(ruleType) + '#new')
    )

  if (!RULE_TYPE_VALUES.includes(ruleType)) back('Unknown kind of rule.')
  if (!description) back('Add the sentence shown to the reviewer when a drawing fails this rule.')
  const built = fieldsToRule(ruleType, (name) => String(formData.get(name) || ''))
  if (!built.ok) back(built.error + '.')

  let savedKey = ''
  if (id) {
    const { data: existing } = await supabase.from('intent_rules').select('rule_key, rule_type, version').eq('id', id).single()
    if (!existing) back('That rule no longer exists.')
    if (existing.rule_type !== ruleType) back('A rule cannot change kind — turn it off and add a new one.')
    const { error } = await supabase
      .from('intent_rules')
      .update({
        description,
        params: built.params,
        applies_to: built.applies_to,
        version: (existing.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) back(error.message + '.')
    savedKey = existing.rule_key
  } else {
    const base = keyFromDescription(description, ruleType)
    let key = base
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from('intent_rules').insert({
        rule_key: key,
        description,
        rule_type: ruleType,
        params: built.params,
        applies_to: built.applies_to,
        active: true,
      })
      if (!error) {
        savedKey = key
        break
      }
      if (error.code !== '23505') back(error.message + '.') // anything but "key already used"
      key = base + '_' + (attempt + 2)
    }
    if (!savedKey) back('Could not find a free name for this rule.')
  }

  await snapshotRulebook()
  revalidatePath('/rulebook/checks')
  redirect('/rulebook/checks?saved=' + encodeURIComponent(savedKey))
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
  revalidatePath('/rulebook/checks')
  redirect('/rulebook/checks?saved=1')
}
