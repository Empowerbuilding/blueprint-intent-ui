'use server'

import { createClient } from '@/lib/supabase/server'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { notifyBlueprint } from '@/lib/notify'
import { addedFolderSource, changedFolderSource, changedPaletteSource, colourChannel, folderPath, missingNumbers, numberLabel, ruleFolders, rulePalette, sameFolder } from '@/lib/model-rules'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Model checks: anyone signed in can PROPOSE one; only an approver (Mitch or Michael) accepts,
// retires or brings one back. Checked here for a clear message and enforced again by the database.
// Only accepted checks are attached to work items in contract v2.

const PAGE = '/rulebook/model-checks'
const back = (opts: { err?: string; saved?: string; anchor?: string } = {}) => {
  const q = [opts.err ? 'err=' + encodeURIComponent(opts.err) : '', opts.saved ? 'saved=' + encodeURIComponent(opts.saved) : ''].filter(Boolean)
  return PAGE + (q.length ? '?' + q.join('&') : '') + (opts.anchor ? '#' + opts.anchor : '')
}

export async function proposeModelRule(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ruleKey = String(formData.get('rule_key') || '').trim().toLowerCase()
  const description = String(formData.get('description') || '').trim()
  if (!/^[a-z0-9]+(\.[a-z0-9_]+)+$/.test(ruleKey)) {
    redirect(back({ err: 'The name looks like "casework.no_overlap": lower case, a dot between the group and the name. Nothing was added.', anchor: 'new' }))
  }
  if (!description) redirect(back({ err: 'Add the sentence that says what the check proves. Nothing was added.', anchor: 'new' }))
  const { data: twin } = await supabase.from('intent_model_rules').select('id, rule_key').eq('rule_key', ruleKey).maybeSingle()
  if (twin) redirect(back({ err: 'There is already a check called "' + ruleKey + '". Nothing was added.', anchor: 'r-' + ruleKey }))
  const { error } = await supabase
    .from('intent_model_rules')
    .insert({ rule_key: ruleKey, description, status: 'proposed', kinds: [], source: 'added in the app', proposed_by: user.email || user.id })
  if (error) redirect(back({ err: 'The check could not be added: ' + error.message, anchor: 'new' }))
  revalidatePath(PAGE)
  redirect(back({ saved: ruleKey + ' proposed', anchor: 'r-' + ruleKey }))
}

const NEXT: Record<string, { from: string[]; to: string; verb: string }> = {
  accept: { from: ['proposed'], to: 'accepted', verb: 'accepted' },
  retire: { from: ['accepted', 'proposed'], to: 'retired', verb: 'retired' },
  reopen: { from: ['retired'], to: 'proposed', verb: 'put back as proposed' },
}

export async function decideModelRule(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can accept or retire a check. Nothing was changed.' }))
  }
  const id = String(formData.get('rule_id') || '')
  const step = NEXT[String(formData.get('decision') || '')]
  const note = String(formData.get('note') || '').trim()
  if (!id || !step) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_model_rules').select('id, rule_key, description, status, version, params').eq('id', id).single()
  if (!row) redirect(back({ err: 'That check no longer exists. Nothing was changed.' }))
  const anchor = 'r-' + row.rule_key
  if (!step.from.includes(row.status)) redirect(back({ err: '"' + row.rule_key + '" is already ' + row.status + '. Nothing was changed.', anchor }))
  // a check that waits for a number is not accepted without it: the number is part of what is being accepted (rule A83)
  const waiting = step.to === 'accepted' ? missingNumbers(row.params as Record<string, unknown> | null) : []
  if (waiting.length) {
    redirect(
      back({
        err:
          '"' + row.rule_key + '" has no ' + waiting.map((n) => n.label.toLowerCase()).join(' and no ') +
          ' yet. Type the number and save it, then accept the check. Nothing was changed.',
        anchor,
      }),
    )
  }
  const now = new Date().toISOString()
  const { data: changed, error } = await supabase
    .from('intent_model_rules')
    .update({ status: step.to, version: (row.version || 1) + 1, decided_by: user.id, decided_by_email: user.email || null, decided_at: now, decision_note: note || null, updated_at: now })
    .eq('id', id)
    .eq('status', row.status)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The change was not saved' + (error ? ': ' + error.message : ' (the database refused it).'), anchor }))
  }
  await notifyBlueprint(
    '🧪 **Model check ' + step.verb + ': `' + row.rule_key + '`** — ' + row.description + ' By ' + (user.email || 'someone') + (note ? ' — "' + note + '"' : '') +
      '.\nAccepted checks are attached to work items at the next Lock & Emit: GET /api/model-rules. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  redirect(back({ saved: row.rule_key + ' ' + step.verb, anchor }))
}

// A number on a check (params: tolerance_ft and the like). Only an approver changes it, on a check that is proposed or
// accepted; an accepted check stays accepted. The version goes up, so a work order compiled with the old number is stale.
// No number is ever added here: only one the check already carries can be changed, or given its first value when the
// check carries it without one (null: a number the checker needs and nothing written gives, rule A83).
export async function setModelRuleNumber(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can change a number on a check. Nothing was changed.' }))
  }
  const id = String(formData.get('rule_id') || '')
  const key = String(formData.get('param') || '')
  const raw = String(formData.get('value') || '').trim()
  if (!id || !key) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_model_rules').select('id, rule_key, description, status, version, params').eq('id', id).single()
  if (!row) redirect(back({ err: 'That check no longer exists. Nothing was changed.' }))
  const anchor = 'r-' + row.rule_key
  if (row.status === 'retired') redirect(back({ err: '"' + row.rule_key + '" is retired. Put it back as proposed first. Nothing was changed.', anchor }))
  const params = (row.params || {}) as Record<string, unknown>
  const old = params[key]
  const first = old === null && key in params // carried without a value: this is its first one
  if (!first && (typeof old !== 'number' || !Number.isFinite(old))) {
    redirect(back({ err: '"' + row.rule_key + '" carries no number called "' + key + '". Nothing was changed.', anchor }))
  }
  const value = Number(raw)
  if (raw === '' || !Number.isFinite(value) || value <= 0) redirect(back({ err: 'The number must be greater than zero. Nothing was changed.', anchor }))
  const { label, unit } = numberLabel(key)
  const show = (n: number) => String(n) + (unit ? ' ' + unit : '')
  if (value === old) redirect(back({ err: '"' + row.rule_key + '" already says ' + show(value) + '. Nothing was changed.', anchor }))
  const next: Record<string, unknown> = { ...params, [key]: value }
  if ('initial' in next) next.initial = false // it is no longer the starting value
  const now = new Date().toISOString()
  const { data: changed, error } = await supabase
    .from('intent_model_rules')
    .update({ params: next, version: (row.version || 1) + 1, params_by: user.email || user.id, params_at: now, updated_at: now })
    .eq('id', id)
    .eq('version', row.version)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The number was not saved' + (error ? ': ' + error.message : ' (the check changed in the meantime, or the database refused it).'), anchor }))
  }
  await notifyBlueprint(
    first
      ? '🧪 **Model check number set: \`' + row.rule_key + '\`** — ' + label.toLowerCase() + ' ' + show(value) + ', its first value (the check is ' + row.status + '). By ' +
          (user.email || 'someone') + '.\nThe check had no value for it and could not pass: GET /api/model-rules. This is a notice, not a go.'
      : '🧪 **Model check number changed: \`' + row.rule_key + '\`** — ' + label.toLowerCase() + ' ' + show(old as number) + ' → ' + show(value) + ' (the check is ' + row.status + '). By ' +
          (user.email || 'someone') + '.\nA work order compiled with the old number is stale: GET /api/model-rules, then --check. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  redirect(back({ saved: row.rule_key + ': ' + label.toLowerCase() + ' ' + show(value), anchor }))
}

// A colour of the palette on a check (params.palette: one row per Department, red / green / blue). Only an approver changes
// one, on a check that is proposed or accepted; an accepted check stays accepted, the version goes up. No row is added or
// removed here: only a Department the check already carries can be changed. The row's note (params.palette_source) then
// says who changed it and from what, and keeps naming where its first value came from.
export async function setModelRulePalette(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can change a colour on a check. Nothing was changed.' }))
  }
  const id = String(formData.get('rule_id') || '')
  const department = String(formData.get('department') || '')
  if (!id || !department) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_model_rules').select('id, rule_key, description, status, version, params').eq('id', id).single()
  if (!row) redirect(back({ err: 'That check no longer exists. Nothing was changed.' }))
  const anchor = 'r-' + row.rule_key
  if (row.status === 'retired') redirect(back({ err: '"' + row.rule_key + '" is retired. Put it back as proposed first. Nothing was changed.', anchor }))
  const params = (row.params || {}) as Record<string, unknown>
  const old = (rulePalette(params) || []).find((p) => p.department === department)
  if (!old) redirect(back({ err: '"' + row.rule_key + '" carries no colour for "' + department + '". Nothing was changed.', anchor }))
  const rgb = ['red', 'green', 'blue'].map((k) => colourChannel(String(formData.get(k) ?? '')))
  if (rgb.some((n) => n === null)) {
    redirect(back({ err: 'Red, green and blue are each a whole number from 0 to 255. Nothing was changed.', anchor }))
  }
  const next3 = rgb as number[]
  if (next3.every((n, i) => n === old.rgb[i])) {
    redirect(back({ err: '"' + row.rule_key + '" already says ' + next3.join('/') + ' for ' + department + '. Nothing was changed.', anchor }))
  }
  const now = new Date().toISOString()
  const who = user.email || user.id
  const sources = params.palette_source && typeof params.palette_source === 'object' && !Array.isArray(params.palette_source) ? (params.palette_source as Record<string, unknown>) : {}
  const next: Record<string, unknown> = {
    ...params,
    palette: { ...(params.palette as Record<string, unknown>), [department]: next3 },
    palette_source: { ...sources, [department]: changedPaletteSource(old.source, who, now.slice(0, 10), old.rgb, next3) },
  }
  if ('initial' in next) next.initial = false // it is no longer the starting palette
  const { data: changed, error } = await supabase
    .from('intent_model_rules')
    .update({ params: next, version: (row.version || 1) + 1, params_by: who, params_at: now, updated_at: now })
    .eq('id', id)
    .eq('version', row.version)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The colour was not saved' + (error ? ': ' + error.message : ' (the check changed in the meantime, or the database refused it).'), anchor }))
  }
  await notifyBlueprint(
    '🧪 **Model check colour changed: `' + row.rule_key + '`** — ' + department + ' ' + old.rgb.join('/') + ' → ' + next3.join('/') + ' (the check is ' + row.status + '). By ' + who +
      '.\nThe room colour check now compares with the new colour: GET /api/model-rules. A work order compiled with the old version is stale. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  redirect(back({ saved: row.rule_key + ': ' + department + ' ' + next3.join('/'), anchor }))
}

// A texture folder on a check (params.texture_folders: the shared library folders the material check compares with). Only an
// approver changes one, adds one or removes one, on a check that is proposed or accepted; an accepted check stays accepted,
// the version goes up. Only a check that already carries the list can be edited here. The folder's note
// (params.texture_folders_source) then says who changed or added it; a changed folder keeps naming where its first value came
// from. The last folder cannot be removed: with none the check cannot be run.
const FOLDER_STEPS = ['change', 'add', 'remove']
export async function setModelRuleFolder(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can change a folder on a check. Nothing was changed.' }))
  }
  const id = String(formData.get('rule_id') || '')
  const step = String(formData.get('step') || '')
  const folder = String(formData.get('folder') || '')
  if (!id || !FOLDER_STEPS.includes(step)) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_model_rules').select('id, rule_key, description, status, version, params').eq('id', id).single()
  if (!row) redirect(back({ err: 'That check no longer exists. Nothing was changed.' }))
  const anchor = 'r-' + row.rule_key
  if (row.status === 'retired') redirect(back({ err: '"' + row.rule_key + '" is retired. Put it back as proposed first. Nothing was changed.', anchor }))
  const params = (row.params || {}) as Record<string, unknown>
  const rows = ruleFolders(params)
  if (!rows) redirect(back({ err: '"' + row.rule_key + '" carries no list of folders. Nothing was changed.', anchor }))
  const old = step === 'add' ? null : rows.find((f) => f.folder === folder) || null
  if (step !== 'add' && !old) redirect(back({ err: '"' + row.rule_key + '" does not list the folder "' + folder + '". Nothing was changed.', anchor }))
  let value: string | null = null
  if (step !== 'remove') {
    value = folderPath(String(formData.get('value') ?? ''))
    if (!value) {
      redirect(back({ err: 'A folder is a full path that starts with a drive letter, such as H:\\Shared drives\\..., or with a network share. Nothing was changed.', anchor }))
    }
    if (old && value === old.folder) redirect(back({ err: '"' + row.rule_key + '" already lists ' + value + '. Nothing was changed.', anchor }))
    const twin = rows.find((f) => f !== old && sameFolder(f.folder, value as string))
    if (twin) redirect(back({ err: '"' + row.rule_key + '" already lists ' + twin.folder + '. Nothing was changed.', anchor }))
  }
  if (step === 'remove' && rows.length === 1) {
    redirect(back({ err: '"' + row.rule_key + '" would have no folder left and could not be run. Change the folder instead. Nothing was changed.', anchor }))
  }
  const now = new Date().toISOString()
  const who = user.email || user.id
  const day = now.slice(0, 10)
  const sources: Record<string, unknown> = {
    ...(params.texture_folders_source && typeof params.texture_folders_source === 'object' && !Array.isArray(params.texture_folders_source)
      ? (params.texture_folders_source as Record<string, unknown>)
      : {}),
  }
  let folders = rows.map((f) => f.folder)
  if (step === 'change' && old && value) {
    folders = folders.map((f) => (f === old.folder ? (value as string) : f))
    delete sources[old.folder]
    sources[value] = changedFolderSource(old.source, who, day, old.folder, value)
  } else if (step === 'add' && value) {
    folders = [...folders, value]
    sources[value] = addedFolderSource(who, day)
  } else if (step === 'remove' && old) {
    folders = folders.filter((f) => f !== old.folder)
    delete sources[old.folder]
  }
  const next: Record<string, unknown> = { ...params, texture_folders: folders, texture_folders_source: sources }
  if ('initial' in next) next.initial = false // it is no longer the starting list
  const { data: changed, error } = await supabase
    .from('intent_model_rules')
    .update({ params: next, version: (row.version || 1) + 1, params_by: who, params_at: now, updated_at: now })
    .eq('id', id)
    .eq('version', row.version)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The folder was not saved' + (error ? ': ' + error.message : ' (the check changed in the meantime, or the database refused it).'), anchor }))
  }
  const what =
    step === 'change' ? 'changed: `' + row.rule_key + '`** — ' + (old as { folder: string }).folder + ' → ' + value
    : step === 'add' ? 'added: `' + row.rule_key + '`** — ' + value
    : 'removed: `' + row.rule_key + '`** — ' + (old as { folder: string }).folder
  await notifyBlueprint(
    '🧪 **Model check folder ' + what + ' (the check is ' + row.status + '; it now lists ' + folders.length + (folders.length === 1 ? ' folder' : ' folders') + '). By ' + who +
      '.\nThe texture check now compares with the new list: GET /api/model-rules. A work order compiled with the old version is stale. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  redirect(back({ saved: row.rule_key + ': folder ' + (step === 'change' ? 'changed to ' + value : step === 'add' ? 'added, ' + value : 'removed, ' + (old as { folder: string }).folder), anchor }))
}
