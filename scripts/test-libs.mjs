
import { projectProgress } from '../src/lib/progress.ts'
import { lineDiff, foldDiff, diffStats } from '../src/lib/diff.ts'
import { describeRule, describeScope, ruleToFields, fieldsToRule, keyFromDescription } from '../src/lib/rule-text.ts'
import { roomNameMatches, runMathGate } from '../src/lib/rules.ts'
import { deterministicDimensionCheck } from '../src/lib/dimension-check.ts'
import { normaliseRole, suggestKind, suggestNeeds2d, suggestRole, suggestSheetGroup } from '../src/lib/vocab.ts'
import { buildContractV2, contractSha, validateContractV2 } from '../src/lib/emit-v2.ts'
import { UNREVIEWED, addedEntrySource, addedFolderSource, adoptRoles, adoptUnreviewed, adoptedRoleSource, changedFolderSource, changedPaletteSource, changedRoleSource, changedTextSource, checkText, colourChannel, folderPath, listEntry, missingNumbers, numberSource, roleName, roleNames, ruleFolders, ruleLists, ruleNumbers, rulePalette, ruleRoles, ruleTexts, sameEntry, sameFolder } from '../src/lib/model-rules.ts'
import { contentOfV1, contentOfV2, sameAsBeingWritten, sameAsEmitted } from '../src/lib/emit-same.ts'
import { ANALYSIS_PROMPT, LAYOUT_DETAILS_MAX, LAYOUT_DETAIL_CHARS, detailState, inspoUse, mergeTags, parseAnalysis, tidyLayoutDetails } from '../src/lib/inspo-analysis.ts'
import fs from 'node:fs'
let fails = 0
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v
const eq = (name, got, want) => { const g = JSON.stringify(canon(got)), w = JSON.stringify(canon(want)); if (g !== w) { fails++; console.log('FAIL', name, '\n  got ', g, '\n  want', w) } else console.log('ok  ', name) }

// ---- rule-text against the LIVE rulebook mirror ----
const seed = JSON.parse(fs.readFileSync(new URL('./smoke/rules.json', import.meta.url), 'utf8'))
const rules = Array.isArray(seed) ? seed : seed.rules
for (const r of rules) {
  console.log('    ', r.rule_key.padEnd(22), '|', describeRule(r), '|', describeScope(r))
  const { fits, fields } = ruleToFields(r)
  eq('fits ' + r.rule_key, fits, true)
  const back = fieldsToRule(r.rule_type, (n) => fields[n] ?? '')
  eq('roundtrip params ' + r.rule_key, back.ok && back.params, r.params)
  // applies_to: identical except the form always writes outline_types explicitly and "*" for all rooms
  eq('roundtrip applies_to ' + r.rule_key, back.ok && back.applies_to, r.applies_to)
}
eq('flat between does not fit', ruleToFields({ rule_type: 'min_clearance', params: { between: ['a', 'b'], min_in: 3 }, applies_to: {} }).fits, false)
eq('unknown param key does not fit', ruleToFields({ rule_type: 'forbidden_kind', params: { kind: 'x', max_count: 0, extra: 1 }, applies_to: {} }).fits, false)
eq('no types -> error', fieldsToRule('required_kind', (n) => ({ kind: 'island', min_count: '1', rooms_mode: 'all' }[n] ?? '')).ok, false)
eq('bad number -> error', fieldsToRule('required_kind', (n) => ({ kind: 'island', min_count: 'x', rooms_mode: 'all', type_plan: 'on' }[n] ?? '')).ok, false)
eq('kind normalised', fieldsToRule('required_kind', (n) => ({ kind: ' Tall Cabinet ', min_count: '2', rooms_mode: 'named', room_names: 'Kitchen, Bar', type_plan: 'on' }[n] ?? '')), { ok: true, params: { kind: 'tall_cabinet', min_count: 2 }, applies_to: { room_names: ['Kitchen', 'Bar'], outline_types: ['plan'] } })
eq('key', keyFromDescription('Vanity needs 30" clear of the wall!', 'min_clearance'), 'vanity_needs_30_clear_of_the_wall')

// ---- which rooms a rule covers ----
const M = (rule, room) => roomNameMatches(rule, room)
eq('room: exact', M('Kitchen', 'Kitchen'), true)
eq('room: case and spacing', M('butler  pantry', 'Butler Pantry'), true)
eq('room: numbered copy', [M('Bath', 'Bath 2'), M('Bath', 'Bath 3'), M('Bath', 'Bath #2'), M('Bedroom', 'Bedroom 12')], [true, true, true, true])
eq('room: combined name', [M('Butler Pantry', 'Butler Pantry / Dining'), M('Dining', 'Butler Pantry / Dining'), M('Closet', 'Master Bath / Closet'), M('Living', 'Great Room / Living')], [true, true, true, true])
eq('room: numbered part of a combined name', M('Bath', 'Bath 2 / Laundry'), true)
eq('room: a rule that names the number covers only that room', [M('Bath 2', 'Bath 2'), M('Bath 2', 'Bath 3'), M('Bath 2', 'Bath')], [true, false, false])
eq('room: not a word search', [M('Bath', 'Master Bath'), M('Bath', 'Master Bath / Closet'), M('Bed', 'Bedroom 2'), M('Kitchen', 'Kitchenette'), M('Bath', 'Bed 3 bath')], [false, false, false, false, false])
eq('room: empty rule name matches nothing', M('  ', 'Kitchen'), false)
const bathRule = { rule_key: 'tub', description: '', rule_type: 'required_kind', params: { kind: 'tub', min_count: 1 }, applies_to: { room_names: ['Bath'], outline_types: ['plan'] }, active: true }
const geo = { elements: [{ id: 'v', kind: 'vanity', x: 0, y: 0, w: 60, h: 22 }] }
const ran = (name) => runMathGate([bathRule], { name, section_code: '114' }, 'plan', geo, 3).results.map((r) => r.rule_key + ':' + r.status)
eq('gate: Bath rule runs on Bath 2', ran('Bath 2'), ['tub:fail'])
eq('gate: Bath rule does not run on Master Bath', ran('Master Bath'), [])
eq('gate: all-rooms rule still runs everywhere', runMathGate([{ ...bathRule, applies_to: { room_names: '*', outline_types: ['plan'] } }], { name: 'Garage', section_code: '1' }, 'plan', geo, 3).results.length, 1)

// ---- decided sizes against the drawing: a plan size is only compared as a pair on a plan ----
const dec = [{ topic: 'island', value: '84 x 42 island' }]
const V = (els, type) => deterministicDimensionCheck(dec, els, type).verdicts.map((v) => v.verdict)
eq('size: plan, matching island', V([{ kind: 'island', w: 84, h: 42 }], 'plan'), ['confirmed'])
eq('size: plan, wrong island is a conflict', V([{ kind: 'island', w: 96, h: 48 }], 'plan'), ['conflict'])
eq('size: default drawing type is plan', deterministicDimensionCheck(dec, [{ kind: 'island', w: 96, h: 48 }]).verdicts.map((v) => v.verdict), ['conflict'])
eq('size: section through a correct island (42 wide x 36 high) is NOT a conflict', V([{ kind: 'island', w: 42, h: 36 }], 'section'), ['confirmed'])
eq('size: elevation along a correct island (84 wide x 36 high) is NOT a conflict', V([{ kind: 'island', w: 84, h: 36 }], 'elevation'), ['confirmed'])
eq('size: elevation whose width is neither side is left to the plan, not a conflict', V([{ kind: 'island', w: 60, h: 36 }], 'elevation'), ['missing'])
eq('size: no element of that kind -> left for the visual check', deterministicDimensionCheck(dec, [{ kind: 'counter', w: 84, h: 25 }], 'section').remaining.length, 1)
const note = deterministicDimensionCheck(dec, [{ kind: 'island', w: 60, h: 36 }], 'section').verdicts[0].note
eq('size: the note says where the plan size is checked', [note.includes('checked on the plan drawing'), note.includes('60 wide x 36 high')], [true, true])

// ---- diff ----
const d = lineDiff('a\nb\nc\nd\ne\nf\ng\nh', 'a\nb\nc\nd\nE\nf\ng\nh\ni')
eq('diff stats', diffStats(d), { added: 2, removed: 1 })
eq('diff fold', foldDiff(d, 1).map((r) => r.type === 'skip' ? 'skip' + r.count : r.type[0] + ':' + r.text), ['skip3', 's:d', 'd:e', 'a:E', 's:f', 'skip1', 's:h', 'a:i'])
eq('diff identical', diffStats(lineDiff('x\ny', 'x\r\ny')), { added: 0, removed: 0 })

// ---- progress ----
const R = (id, st) => ({ id, section_code: id, name: 'Room ' + id, review_state: st })
const P = (o) => projectProgress({ project: { id: 'p', status: 'intake', emitted_version: 0 }, rooms: [], openQuestions: [], unassignedImages: 0, outlines: [], changesSinceLock: 0, ...o })
let p = P({})
eq('empty: board/blueprint', [p.current, p.next.who], ['board', 'blueprint'])
p = P({ rooms: [R('101', 'confirmed'), R('102', 'unreviewed')] })
eq('review: next room', [p.current, p.next.label, p.next.href], ['review', 'Review 1 room', '/projects/p/rooms/102?view=decide'])
p = P({ rooms: [R('101', 'confirmed')], openQuestions: [{ room_id: '101', blocking: true }, { room_id: '101', blocking: false }] })
eq('review: blocking q', [p.current, p.next.label, p.next.href], ['review', 'Answer 1 blocking question', '/projects/p/rooms/101?view=decide#questions'])
p = P({ rooms: [R('101', 'confirmed')], openQuestions: [{ room_id: '101', blocking: false }], unassignedImages: 2 })
eq('review: images', [p.current, p.next.label], ['review', 'Assign 2 images'])
p = P({ rooms: [R('101', 'confirmed'), R('102', 'defaults_accepted')] })
eq('lock', [p.current, p.next.label, p.next.href], ['lock', 'Lock & Emit', '/projects/p/emit'])
p = P({ project: { id: 'p', status: 'locked', emitted_version: 1 }, rooms: [R('101', 'confirmed')], changesSinceLock: 3 })
eq('stale', [p.current, p.stale, p.next.label, p.steps[2].detail], ['lock', true, 'Re-emit the contract (v2)', 'contract v1 · out of date'])
p = P({ project: { id: 'p', status: 'locked', emitted_version: 1 }, rooms: [R('101', 'confirmed'), R('102', 'confirmed')], outlines: [{ room_id: '102', status: 'pushed' }, { room_id: '102', status: 'approved' }] })
eq('2d: pending', [p.current, p.next.label, p.next.href], ['2d', 'Review 1 2D outline', '/projects/p/rooms/102?view=2d'])
p = P({ project: { id: 'p', status: 'locked', emitted_version: 1 }, rooms: [R('101', 'confirmed'), R('102', '2d_approved')], outlines: [{ room_id: '101', status: 'approved' }] })
eq('2d: ready to approve', [p.current, p.next.label, p.steps[3].detail], ['2d', 'Mark 1 room 2D approved', '1/2 rooms approved'])
p = P({ project: { id: 'p', status: 'locked', emitted_version: 1 }, rooms: [R('101', 'confirmed'), R('102', '2d_approved')], outlines: [{ room_id: '101', status: 'rejected' }] })
eq('2d: waiting on blueprint', [p.current, p.next.who, p.next.detail], ['2d', 'blueprint', '1 room still to draw or redraw.'])
p = P({ project: { id: 'p', status: 'locked', emitted_version: 1 }, rooms: [R('101', '2d_approved'), R('102', 'defaults_accepted')] })
eq('build: go', [p.current, p.next.who, p.next.label], ['build', 'you', 'Give Blueprint the go in chat'])
p = P({ project: { id: 'p', status: 'building', emitted_version: 1 }, rooms: [R('101', '2d_approved')] })
eq('build: running', [p.current, p.next.who], ['build', 'blueprint'])
p = P({ project: { id: 'p', status: 'done', emitted_version: 1 }, rooms: [R('101', '2d_approved')] })
eq('done', [p.current, p.steps.map((s) => s.state).join()], ['done', 'done,done,done,done,done'])
p = P({ project: { id: 'p', status: 'done', emitted_version: 0 }, rooms: [R('101', 'unreviewed')] })
eq('manual done ignored when data says review', p.current, 'review')

// ---- contract v2: vocabulary suggestions (never saved by themselves) ----
eq('role: suggestions from names', ['Master Bath', 'Bath 2', 'M Closet', 'Great Room / Living', 'Golf Room', 'Bedroom 3', 'Master Suite', 'Covered Patio', 'Outdoor Kitchen', 'Zzz'].map(suggestRole), ['primary-bath', 'bath', 'closet', 'great', 'game-room', 'bedroom', 'primary-bedroom', 'patio', 'outdoor-kitchen', null])
eq('role: normalise + alias', [normaliseRole('Game Room'), normaliseRole('golf-room'), normaliseRole('primary_bath'), normaliseRole('other'), normaliseRole('')], ['game-room', 'game-room', 'primary-bath', null, null])
eq('2d: the old heuristic, as a suggestion', [suggestNeeds2d('Kitchen', '103'), suggestNeeds2d('Bedroom 2', '110'), suggestNeeds2d('House-Level (global)', 'HOUSE'), suggestNeeds2d('Site / Exterior', 'S1')], [true, false, false, false])
eq('kind: suggestions from wording', [suggestKind('island', '84 x 42 island'), suggestKind('general', 'Trash pullout at the sink'), suggestKind('sink', 'Undermount, centred on the window'), suggestKind('counter material', 'Marble 05'), suggestKind('windows', 'casements in bedrooms'), suggestKind('fencing', 'only around the pool'), suggestKind('vanity', 'two vanities with legs'), suggestKind('x', 'y')], ['casework.place', 'casework.place', 'plumbing.sink', 'casework.counter', 'opening.modify', 'site.fence', 'plumbing.place', null])

// ---- contract v2: the builder ----
const v2seed = JSON.parse(fs.readFileSync(new URL('./smoke/v2-seed.json', import.meta.url), 'utf8'))
const KINDS = v2seed.kinds
const RULES = v2seed.model_rules.map((r) => ({ ...r, status: r.rule_key === 'casework.no_overlap' ? 'accepted' : 'proposed' }))
eq('seed: every check names kinds that exist', v2seed.model_rules.flatMap((r) => r.kinds).filter((k) => !KINDS.some((x) => x.kind === k)), [])
const vRoom = (id, code, name, extra = {}) => ({ id, section_code: code, name, role: null, needs_2d: null, shell_changed: false, model_state: {}, ...extra })
const vDec = (id, room_id, topic, value, kind, extra = {}) => ({ id, room_id, topic, value, source: 'transcript', source_ref: '11/06 14:22', kind, params: {}, ...extra })
const base = {
  project: { name: 'Scratch v2', client: null, doc_title: 'Scratch v2 D2.rvt' },
  version: 3,
  emittedAt: '2026-11-11T08:00:00.000Z',
  rooms: [
    vRoom('r1', '201', 'Kitchen', { role: 'kitchen', needs_2d: true, model_state: { casework: 4, scanned_at: '2026-11-10T20:00:00Z', bridge_build: 'f98f724' } }),
    vRoom('r2', '202', 'Bath 2', { role: 'bath', needs_2d: true }),
    vRoom('r3', '203', 'Bedroom 2', { role: 'bedroom', needs_2d: false }),
    vRoom('rh', 'HOUSE', 'House-Level (global)'),
  ],
  decisions: [
    vDec('d1', 'r1', 'island', '84 x 42 island', 'casework.place', { params: { width_in: 84, depth_in: 42 } }),
    vDec('d2', 'r1', 'counter', 'Marble slab, no waterfall', 'casework.counter'),
    vDec('d3', 'r1', 'under the stair', 'Leave it open', 'context', { source: 'manual', source_ref: null }),
    vDec('d4', 'r2', 'wall', 'Move the toilet wall 6 in', 'surface.wall'),
    vDec('d5', 'r2', 'mirror lights', 'Side lights at the mirror', 'mep.electrical'),
    vDec('d6', 'rh', 'cabinet material', 'White oak everywhere', 'finish.material'),
    vDec('d7', null, 'fencing', 'Only around the pool', 'site.fence'),
  ],
  opens: [{ room_id: 'r1', question: 'Pot filler?', answer: 'Yes', default_if_unanswered: null, blocking: false }, { room_id: null, question: 'Gutters?', answer: null, default_if_unanswered: 'Black', blocking: false }],
  redlines: [{ id: 'n1', room_id: 'r1', note_type: 'beam', text: 'Beam, not a wall', source_ref: 'A101.1', kind: 'surface.beam' }, { id: 'n2', room_id: 'r3', note_type: 'keep', text: 'Keep the window seat', source_ref: null, kind: 'context' }],
  images: [{ room_id: 'r1', storage_path: 'p/a.jpg', notes: 'hood', tags: null }],
  kinds: KINDS,
  modelRules: RULES,
  defaultTopics: ['ceiling', 'fridge'],
}
let v2 = buildContractV2(base)
eq('v2: builds when nothing is missing', [v2.ok, v2.ok && v2.work_items, v2.ok && v2.contract.schema, v2.ok && v2.contract.version], [true, 7, 'intent-contract/2.0', 3])
const C = v2.contract
const room = (code) => C.rooms.find((r) => r.section_code === code)
eq('v2: project block', C.project, { name: 'Scratch v2', slug: 'scratch-v2', doc: 'Scratch v2 D2.rvt', client: null })
eq('v2: HOUSE is not a room', C.rooms.map((r) => r.section_code), ['201', '202', '203'])
eq('v2: kitchen work items, in order, typed', room('201').work_items.map((w) => [w.kind, w.room, w.summary]), [['casework.place', '201', 'island: 84 x 42 island'], ['casework.counter', '201', 'counter: Marble slab, no waterfall'], ['surface.beam', '201', 'beam: Beam, not a wall']])
eq('v2: params and provenance carried', [room('201').work_items[0].params, room('201').work_items[0].provenance], [{ width_in: 84, depth_in: 42 }, { decision_id: 'd1', source: 'meeting', evidence: '11/06 14:22' }])
eq('v2: a redline keeps its own provenance', room('201').work_items[2].provenance, { decision_id: null, redline_id: 'n1', source: 'redline', evidence: 'A101.1' })
eq('v2: "no work" lines are carried as context, not built and not dropped', [room('201').context, room('203').context, room('203').work_items.length], [[{ text: 'under the stair: Leave it open', provenance: { decision_id: 'd3', source: 'manual', evidence: null } }], [{ text: 'keep: Keep the window seat', provenance: { decision_id: null, redline_id: 'n2', source: 'redline', evidence: null } }], 0])
eq('v2: only an ACCEPTED check is attached', [room('201').work_items[0].acceptance, room('201').work_items[2].acceptance], [['casework.no_overlap'], []])
eq('v2: a line that moves a wall marks the room shell-changed', [room('201').shell_changed, room('202').shell_changed], [false, true])
eq('v2: a later-stage kind is carried as a work item, not refused', room('202').work_items.map((w) => w.kind), ['surface.wall', 'mep.electrical'])
eq('v2: house and site are separate', [C.house.work_items.map((w) => [w.kind, w.room]), C.site.work_items.map((w) => [w.kind, w.room]), C.house.defaults_applied], [[['finish.material', 'HOUSE']], [['site.fence', 'HOUSE']], ['default:ceiling', 'default:fridge']])
eq('v2: opens keep their default and answer', [room('201').opens, C.house.opens], [[{ question: 'Pot filler?', default: null, blocking: false, answer: 'Yes' }], [{ question: 'Gutters?', default: 'Black', blocking: false, answer: null }]])
eq('v2: scan metadata is always present', [room('201').model_state, room('203').model_state], [{ casework: 4, scanned_at: '2026-11-10T20:00:00Z', bridge_build: 'f98f724' }, { scanned_at: null, bridge_build: null }])
eq('v2: vocabulary is marked draft; the context mark is not counted as a kind', C.vocabulary, { status: 'draft', kinds: KINDS.length - 1 })
eq('v2: work item ids are stable and unique', [/^wi-[0-9a-f]{8}$/.test(room('201').work_items[0].id), buildContractV2(base).contract.rooms[0].work_items[0].id === room('201').work_items[0].id, new Set([...C.rooms.flatMap((r) => r.work_items), ...C.house.work_items, ...C.site.work_items].map((w) => w.id)).size], [true, true, 7])
eq('v2: fingerprint matches, and changes with the content', [C.sha256_intent === contractSha(C), C.sha256_intent.length, buildContractV2({ ...base, version: 4 }).contract.sha256_intent === C.sha256_intent], [true, 64, false])
eq('v2: valid against the vocabulary', validateContractV2(C, KINDS), [])
eq('v2: validation catches a tampered contract', validateContractV2({ ...C, rooms: [{ ...C.rooms[0], role: 'other' }, ...C.rooms.slice(1)] }, KINDS).length, 2)
eq('v2: warnings do not stop it (no scan time on two rooms; no level and no sheet group anywhere)', [v2.warnings.length, v2.warnings.filter((w) => /No room carries a level|No room has a sheet group/.test(w)).length], [4, 2])
// level and sheet group (SPEC A71): additive, never required, never guessed
eq('v2: a room without a level or a sheet group is emitted with both empty', [room('201').level, room('201').sheet_group, 'level' in room('203'), 'sheet_group' in room('203')], [null, null, true, true])
{
  const withFields = buildContractV2({ ...base, rooms: [
    vRoom('r1', '201', 'Kitchen', { role: 'kitchen', needs_2d: true, level: ' Level  1.0 ', sheet_group: 'kitchen', model_state: { scanned_at: 's', level: 'Level 9' } }),
    vRoom('r2', '202', 'Bath 2', { role: 'bath', needs_2d: true, sheet_group: '', model_state: { scanned_at: 's', level: 'Level 2.0' } }),
    vRoom('r3', '203', 'Bedroom 2', { role: 'bedroom', needs_2d: false, model_state: { scanned_at: 's' } }),
    vRoom('rh', 'HOUSE', 'House-Level (global)'),
  ] })
  const R = (code) => withFields.contract.rooms.find((x) => x.section_code === code)
  eq('v2: the saved level wins over the scan; without one the scan level is used; neither = empty', [R('201').level, R('202').level, R('203').level], ['Level 1.0', 'Level 2.0', null])
  eq('v2: the sheet group is what a person saved; saved empty and never said are both empty in the contract', [R('201').sheet_group, R('202').sheet_group, R('203').sheet_group], ['kitchen', null, null])
  eq('v2: the rooms without a level or a say on the sheet group are named, one line each', withFields.warnings, ['Room 203 Bedroom 2: no level, so its floors and ceilings are compiled apart from the rooms that have one', 'Room 203 Bedroom 2: nobody has said which interior sheet it goes on, so no interior sheet is compiled for it'])
  eq('v2: valid with the two fields, and the fingerprint covers them', [validateContractV2(withFields.contract, KINDS), withFields.contract.sha256_intent === contractSha(withFields.contract), contractSha({ ...withFields.contract, rooms: withFields.contract.rooms.map((x) => ({ ...x, sheet_group: 'baths' })) }) === withFields.contract.sha256_intent], [[], true, false])
  eq('v2: a contract emitted before the fields existed is still valid', validateContractV2((() => { const old = { ...C, rooms: C.rooms.map((x) => { const y = { ...x }; delete y.level; delete y.sheet_group; return y }) }; old.sha256_intent = contractSha(old); return old })(), KINDS), [])
  eq('v2: a field that is not a name is caught', validateContractV2((() => { const bad = { ...C, rooms: [{ ...C.rooms[0], level: 2 }, ...C.rooms.slice(1)] }; bad.sha256_intent = contractSha(bad); return bad })(), KINDS), ['room 201: level must be a name or empty'])
}
eq('sheet group: the proposal is the room role, in words; no role = no proposal', [suggestSheetGroup('primary-bath'), suggestSheetGroup('golf-room'), suggestSheetGroup('kitchen'), suggestSheetGroup(null), suggestSheetGroup('spa')], ['primary bath', 'game room', 'kitchen', null, null])

// anything missing is listed — never guessed, never dropped
v2 = buildContractV2({ ...base, rooms: [vRoom('r1', '201', 'Kitchen'), vRoom('r2', '202', 'Bath 2', { role: 'spa', needs_2d: true }), base.rooms[2], base.rooms[3]], decisions: [vDec('d1', 'r1', 'island', '84 x 42 island', null), vDec('d2', 'r1', 'counter', 'Marble', 'counter.slab'), vDec('d7', null, 'fencing', 'Only around the pool', null)], redlines: [{ id: 'n1', room_id: 'r1', note_type: 'beam', text: 'Beam, not a wall', source_ref: null, kind: null }] })
eq('v2: not built when anything is missing', v2.ok, false)
eq('v2: every gap is named', v2.errors, [
  'Room 201 Kitchen — decision "island: 84 x 42 island": no kind of work chosen',
  'Room 201 Kitchen — decision "counter: Marble": "counter.slab" is not in the list of kinds of work',
  'House-level — decision "fencing: Only around the pool": no kind of work chosen',
  'Room 201 Kitchen — redline note "Beam, not a wall": no kind of work chosen',
  'Room 201 Kitchen: no role chosen',
  'Room 201 Kitchen: nobody has said whether it gets 2D drawings',
  'Room 202 Bath 2: "spa" is not in the list of room roles',
])
eq('v2: no vocabulary -> refused outright', buildContractV2({ ...base, kinds: [] }).ok, false)
eq('v2: a kind that was turned off is not accepted', buildContractV2({ ...base, kinds: KINDS.map((k) => (k.kind === 'site.fence' ? { ...k, active: false } : k)) }).errors, ['House-level — decision "fencing: Only around the pool": "site.fence" is not in the list of kinds of work'])

// ---- numbers on a model check: a number with no value (null) is listed as waiting; flags, text and absent keys are not numbers ----
eq('check numbers: values and waiting ones are listed, by name; flags and text are not', ruleNumbers({ tolerance_in: 1, initial: true, clear_depth_in: null, note: 'x', bad: NaN }), [{ key: 'clear_depth_in', value: null, label: 'Clear depth', unit: 'in' }, { key: 'tolerance_in', value: 1, label: 'Tolerance', unit: 'in' }])
eq('check numbers: only the ones with no value are waiting', missingNumbers({ tolerance_in: 1, clear_depth_in: null }).map((n) => n.key), ['clear_depth_in'])
eq('check numbers: no params = nothing, nothing waiting', [ruleNumbers(null), missingNumbers(undefined), missingNumbers({})], [[], [], []])
// ---- a number on a model check may carry a note (params.<name>_source): where its value comes from, marked when nobody reviewed it ----
const NUM = { touch_tol_in: 0.5, touch_tol_in_source: UNREVIEWED + ': how close the top of one box is to the bottom of the other to count as standing on it.', footprint_overlap_min_pct: 50, tolerance_in: 1 }
eq('check numbers: the note of a number is not a number itself, and a share is shown in percent', ruleNumbers(NUM).map((n) => [n.key, n.value, n.label, n.unit]), [['footprint_overlap_min_pct', 50, 'Footprint overlap min', '%'], ['tolerance_in', 1, 'Tolerance', 'in'], ['touch_tol_in', 0.5, 'Touch tol', 'in']])
eq('check numbers: a number gives its note; a number without one, a blank note, a note that is not text and no params give null', [numberSource(NUM, 'touch_tol_in').startsWith(UNREVIEWED), numberSource(NUM, 'tolerance_in'), numberSource({ a_in: 1, a_in_source: '  ' }, 'a_in'), numberSource({ a_in: 1, a_in_source: { x: 'y' } }, 'a_in'), numberSource(null, 'a_in')], [true, null, null, null, null])
eq('check numbers: accepting the check says who adopted a number still marked as not reviewed, and keeps the marking', (() => { const a = adoptUnreviewed(NUM, 'mitch@x', '2026-11-12'); return [a.touch_tol_in, a.touch_tol_in_source.startsWith(UNREVIEWED), a.touch_tol_in_source.endsWith('mitch@x on 2026-11-12, without a change to this row.')] })(), [0.5, true, true])
eq('check numbers: a changed number says who changed it and from what, and still where its first value came from', changedTextSource(numberSource(NUM, 'touch_tol_in'), 'mitch@x', '2026-11-12', '0.5 in', '0.25 in'), 'Changed on this page by mitch@x on 2026-11-12, from "0.5 in" to "0.25 in". Source of the first value: ' + NUM.touch_tol_in_source)

// ---- the palette on a model check: one row per Department, each with its source; a number is never read as a colour ----
const PAL = { palette: { Kitchen: [252, 246, 214], Bedroom: [230, 217, 200] }, palette_source: { Kitchen: 'Graphic standard: doc, 2026-11-08.' }, initial: true }
eq('check palette: rows by Department, with the source of each; a row without one says so with null', rulePalette(PAL), [{ department: 'Bedroom', rgb: [230, 217, 200], source: null }, { department: 'Kitchen', rgb: [252, 246, 214], source: 'Graphic standard: doc, 2026-11-08.' }])
eq('check palette: no palette on the check = null, not an empty list', [rulePalette(null), rulePalette({}), rulePalette({ tolerance_in: 1 }), rulePalette({ palette: null }), rulePalette({ palette: [1, 2, 3] })], [null, null, null, null, null])
eq('check palette: a row that is not three whole numbers from 0 to 255 is not shown as a colour', rulePalette({ palette: { A: [1, 2], B: [1, 2, 256], C: [1.5, 2, 3], D: ['1', 2, 3], E: [0, 0, 0], F: [-1, 0, 0] } }).map((p) => p.department), ['E'])
eq('check palette: the palette and its notes are not numbers, so nothing waits for a value', [ruleNumbers(PAL), missingNumbers(PAL)], [[], []])
eq('check palette: a colour value is a whole number from 0 to 255', ['0', '255', ' 12 ', '256', '-1', '1.5', '', 'abc', '0012', '1e2'].map(colourChannel), [0, 255, 12, null, null, null, null, null, null, null])
const ch1 = changedPaletteSource('Graphic standard: doc, 2026-11-08.', 'mitch@x', '2026-11-12', [252, 246, 214], [250, 240, 200])
eq('check palette: a changed row says who, when, from what, and still names its first source', ch1, 'Changed on this page by mitch@x on 2026-11-12, from 252/246/214 to 250/240/200. Source of the first value: Graphic standard: doc, 2026-11-08.')
eq('check palette: a second change keeps the first source, not the chain', changedPaletteSource(ch1, 'michael@x', '2026-11-13', [250, 240, 200], [1, 2, 3]), 'Changed on this page by michael@x on 2026-11-13, from 250/240/200 to 1/2/3. Source of the first value: Graphic standard: doc, 2026-11-08.')
eq('check palette: a row that had no source says so', changedPaletteSource(null, 'm', '2026-11-12', [1, 1, 1], [2, 2, 2]), 'Changed on this page by m on 2026-11-12, from 1/1/1 to 2/2/2. Source of the first value: no source was recorded')
// ---- the texture folders on a model check: one row per folder, in the order of the check, each with its source ----
const FA = 'H:\\Shared drives\\Barnhaus\\Revit\\Revit\\Blueprint Families\\09_Patterns & Images'
const FB = 'H:\\Shared drives\\Barnhaus\\Revit\\Revit\\Library\\Patterns & Images'
const FOL = { texture_folders: [FB, FA], texture_folders_source: { [FA]: 'Runbook: doc, section 8 (b), 2026-11-08.' }, initial: true }
eq('check folders: rows in the order the check lists them, with the source of each; a row without one says so with null', ruleFolders(FOL), [{ folder: FB, source: null }, { folder: FA, source: 'Runbook: doc, section 8 (b), 2026-11-08.' }])
eq('check folders: no list on the check = null, not an empty list', [ruleFolders(null), ruleFolders({}), ruleFolders({ tolerance_in: 1 }), ruleFolders({ texture_folders: null }), ruleFolders({ texture_folders: { a: 1 } }), ruleFolders({ texture_folders: 'H:\\x' })], [null, null, null, null, null, null])
eq('check folders: an entry that is not text is not shown as a folder', ruleFolders({ texture_folders: [FA, 3, '', '  ', null, ['x']] }).map((f) => f.folder), [FA])
eq('check folders: the list and its notes are not numbers, so nothing waits for a value; they are not a palette either', [ruleNumbers(FOL), missingNumbers(FOL), rulePalette(FOL)], [[], [], null])
eq('check folders: a typed folder is a full Windows path, tidied', ['H:\\Shared drives\\Lib\\', ' h:/Shared drives/Lib ', 'H:\\\\a\\\\\\b', '\\\\server\\share\\Textures\\', 'C:\\Program Files (x86)\\Common Files\\Autodesk Shared\\Materials\\Textures'].map(folderPath), ['H:\\Shared drives\\Lib', 'h:\\Shared drives\\Lib', 'H:\\a\\b', '\\\\server\\share\\Textures', 'C:\\Program Files (x86)\\Common Files\\Autodesk Shared\\Materials\\Textures'])
eq('check folders: a relative path, a bare drive, a bare server, forbidden characters, blank and an over-long path are refused', ['Library\\Patterns', 'H:', 'H:\\', '\\\\server', 'H:\\a*b', 'H:\\a|b', 'H:\\a\\b:c', '', '   ', '..\\x', 'H:\\' + 'a'.repeat(300)].map(folderPath), [null, null, null, null, null, null, null, null, null, null, null])
eq('check folders: the same folder in another case or with other slashes is the same folder', [sameFolder(FA, FA.toUpperCase()), sameFolder(FA, FA.replace(/\\/g, '/') + '/'), sameFolder(FA, FB)], [true, true, false])
const fc1 = changedFolderSource('Runbook: doc, section 8 (b), 2026-11-08.', 'mitch@x', '2026-11-12', FA, 'H:\\New')
eq('check folders: a changed folder says who, when, from what, and still names its first source', fc1, 'Changed on this page by mitch@x on 2026-11-12, from ' + FA + ' to H:\\New. Source of the first value: Runbook: doc, section 8 (b), 2026-11-08.')
eq('check folders: a second change keeps the first source, not the chain', changedFolderSource(fc1, 'michael@x', '2026-11-13', 'H:\\New', 'H:\\Newer'), 'Changed on this page by michael@x on 2026-11-13, from H:\\New to H:\\Newer. Source of the first value: Runbook: doc, section 8 (b), 2026-11-08.')
eq('check folders: a folder added on the page says a person added it and that no standard names it', addedFolderSource('mitch@x', '2026-11-12'), 'Added on this page by mitch@x on 2026-11-12. No standard document names this folder: it is on the check on their word.')
// ---- the words on a model check (a text the checker looks for), with their source ----
const TXT = { note_text: 'CONCEPTUAL SITE PLAN ONLY', note_text_source: 'Graphic standard: doc, section A100.2, 2026-11-07.', initial: true }
eq('check words: the text a check carries, with its label and its source', ruleTexts(TXT), [{ key: 'note_text', value: 'CONCEPTUAL SITE PLAN ONLY', label: 'Note text', source: 'Graphic standard: doc, section A100.2, 2026-11-07.' }])
eq('check words: nothing that is not a text under a name ending in _text; a text without a source says so with null', [ruleTexts(null), ruleTexts({ tolerance_in: 1, note: 'x', note_text: '  ', other_text: 3 }), ruleTexts({ note_text: 'A' })], [[], [], [{ key: 'note_text', value: 'A', label: 'Note text', source: null }]])
eq('check words: the words and their note are not numbers, so nothing waits for a value; not a palette, folders or roles either', [ruleNumbers(TXT), missingNumbers(TXT), rulePalette(TXT), ruleFolders(TXT), ruleRoles(TXT)], [[], [], null, null, null])
eq('check words: typed words are tidied to single spaces; blank, over-long and control characters are refused', ['  CONCEPTUAL   SITE PLAN\n ONLY ', 'x', '', '   ', 'a'.repeat(201), 'a\u0007b'].map(checkText), ['CONCEPTUAL SITE PLAN ONLY', 'x', null, null, null, null])
const tc1 = changedTextSource(TXT.note_text_source, 'mitch@x', '2026-11-12', 'CONCEPTUAL SITE PLAN ONLY', 'CONCEPTUAL SITE PLAN')
eq('check words: changed words say who, when, from what, and still name their first source', tc1, 'Changed on this page by mitch@x on 2026-11-12, from "CONCEPTUAL SITE PLAN ONLY" to "CONCEPTUAL SITE PLAN". Source of the first value: Graphic standard: doc, section A100.2, 2026-11-07.')
eq('check words: a second change keeps the first source, not the chain', changedTextSource(tc1, 'michael@x', '2026-11-13', 'CONCEPTUAL SITE PLAN', 'CONCEPT'), 'Changed on this page by michael@x on 2026-11-13, from "CONCEPTUAL SITE PLAN" to "CONCEPT". Source of the first value: Graphic standard: doc, section A100.2, 2026-11-07.')
// ---- the material roles on a model check: one row per role, each with a note that keeps its marking ----
const RN = UNREVIEWED + '. From the standard, section 2, line 27.'
const ROL = { roles: { Hardware: { parameters: ['Handle Material'], material: 'Metal - Black Matte', accents: [] }, 'Casework wood': { parameters: ['Cabinet Material', 'Door/Drawer Material'], material: 'Cabinets', accents: ['Cabinets - Navy'] } }, roles_source: { 'Casework wood': RN }, initial: true }
eq('check roles: one row per role in name order, with the source of each; a row without one says so with null', ruleRoles(ROL), [{ role: 'Casework wood', parameters: ['Cabinet Material', 'Door/Drawer Material'], material: 'Cabinets', accents: ['Cabinets - Navy'], source: RN }, { role: 'Hardware', parameters: ['Handle Material'], material: 'Metal - Black Matte', accents: [], source: null }])
eq('check roles: no roles on the check = null, not an empty list', [ruleRoles(null), ruleRoles({}), ruleRoles({ roles: null }), ruleRoles({ roles: ['a'] }), ruleRoles({ roles: 'x' })], [null, null, null, null, null])
eq('check roles: a role the checker could not read is not shown as a row', ruleRoles({ roles: { A: { parameters: [], material: 'M' }, B: { parameters: ['P'], material: '' }, C: { parameters: ['P'], material: 'M', accents: [3] }, D: 'x', E: { parameters: ['P'], material: 'M' } } }).map((x) => x.role), ['E'])
eq('check roles: the roles and their notes are not numbers, so nothing waits for a value; not a palette, folders or words either', [ruleNumbers(ROL), missingNumbers(ROL), rulePalette(ROL), ruleFolders(ROL), ruleTexts(ROL)], [[], [], null, null, []])
eq('check roles: a typed name is tidied; blank, a comma, over-long and control characters are refused', ['  Metal -  Black Matte ', 'Door/Drawer Material', '', '  ', 'a, b', 'a'.repeat(121), 'a\nb'].map(roleName), ['Metal - Black Matte', 'Door/Drawer Material', null, null, null, null, null])
eq('check roles: typed names separated by commas, each once, in order; blank = none; an unreadable name refuses the list', [roleNames('Cabinet Material,  Door/Drawer Material , Cabinet Material,'), roleNames(''), roleNames(' , '), roleNames('a, ' + 'b'.repeat(121)), roleNames('a\tb')], [['Cabinet Material', 'Door/Drawer Material'], [], [], null, null])
const rc1 = changedRoleSource(RN, 'mitch@x', '2026-11-12', ['material from "Cabinets" to "Cabinets - White Oak"', 'accents from Cabinets - Navy to none'])
eq('check roles: a changed role says who, when and what, and its first source keeps its marking', rc1, 'Changed on this page by mitch@x on 2026-11-12: material from "Cabinets" to "Cabinets - White Oak"; accents from Cabinets - Navy to none. Source of the first value: ' + RN)
eq('check roles: a second change keeps the first source, not the chain', changedRoleSource(rc1, 'michael@x', '2026-11-13', ['material from "Cabinets - White Oak" to "Oak"']), 'Changed on this page by michael@x on 2026-11-13: material from "Cabinets - White Oak" to "Oak". Source of the first value: ' + RN)
eq('check roles: a row nobody reviewed, accepted as shown, keeps its marking and says who adopted it; once only', [adoptedRoleSource(RN, 'mitch@x', '2026-11-12'), adoptedRoleSource(adoptedRoleSource(RN, 'mitch@x', '2026-11-12'), 'michael@x', '2026-11-13')], [RN + ' Accepted as shown by mitch@x on 2026-11-12, without a change to this row.', RN + ' Accepted as shown by mitch@x on 2026-11-12, without a change to this row.'])
eq('check roles: a row a person changed, or one that comes from a standard, is not rewritten by an acceptance', [adoptedRoleSource(rc1, 'mitch@x', '2026-11-12'), adoptedRoleSource('Standard: section 2, line 29.', 'mitch@x', '2026-11-12')], [rc1, 'Standard: section 2, line 29.'])
eq('check roles: an acceptance writes the adoption onto the marked rows only, and nothing when there is none', [adoptRoles({ ...ROL, roles_source: { 'Casework wood': RN, Hardware: rc1 } }, 'mitch@x', '2026-11-12').roles_source, adoptRoles({ ...ROL, roles_source: { Hardware: rc1 } }, 'mitch@x', '2026-11-12'), adoptRoles(TXT, 'm', 'd'), adoptRoles(null, 'm', 'd')], [{ 'Casework wood': RN + ' Accepted as shown by mitch@x on 2026-11-12, without a change to this row.', Hardware: rc1 }, null, null, null])
// ---- a list of texts on a model check (the sheet list, the tag families): one row per entry, in the order of the check ----
const LN = UNREVIEWED + '. From the graphic standard, section Sheet index. The * is my reading.'
const LST = { sheet_list: ['A100', 'A107.*', 'A100.3?'], sheet_list_source: { A100: 'Graphic standard: doc, section Sheet index, 2026-11-07.', 'A107.*': LN }, initial: true }
eq('check lists: the rows of a list in the order the check lists them, with the source of each; a row without one says so with null', ruleLists(LST).map((l) => [l.key, l.spec.one, l.rows]), [['sheet_list', 'sheet', [{ value: 'A100', source: 'Graphic standard: doc, section Sheet index, 2026-11-07.' }, { value: 'A107.*', source: LN }, { value: 'A100.3?', source: null }]]])
eq('check lists: only a list under a name the app knows is shown; the texture folders keep their own rows', [ruleLists(null), ruleLists({}), ruleLists({ sheet_list: null }), ruleLists({ sheet_list: 'A100' }), ruleLists({ other_list: ['a'] }), ruleLists(FOL), ruleLists({ tag_families: ['Door Tag - Text Only', 3, '', null] }).map((l) => [l.key, l.rows.map((x) => x.value)])], [[], [], [], [], [], [], [['tag_families', ['Door Tag - Text Only']]]])
eq('check lists: the list and its notes are not numbers, so nothing waits for a value; not a palette, folders, words or roles either', [ruleNumbers(LST), missingNumbers(LST), rulePalette(LST), ruleFolders(LST), ruleTexts(LST), ruleRoles(LST)], [[], [], null, null, [], null])
eq('check lists: a typed sheet entry is a sheet number, with * and then ? at the end at most', ['A100', '  a107.*  ', 'A100.3?', 'A106.3*?', 'A107.5   B', 'A107.* ?'].map((x) => listEntry('sheet_list', x)), ['A100', 'a107.*', 'A100.3?', 'A106.3*?', 'A107.5 B', 'A107.* ?'])
eq('check lists: blank, a bare * or ?, a * or ? inside, ? before *, over-long and control characters are refused; so is a list the app does not know', [...['', '   ', '*', '?', '*?', 'A1*7', 'A10?.1', 'A100?*', 'A'.repeat(41), 'A\u0007100'].map((x) => listEntry('sheet_list', x)), listEntry('other_list', 'A100'), listEntry('texture_folders', 'H:\\x')], [null, null, null, null, null, null, null, null, null, null, null, null])
eq('check lists: a typed tag family is its name, tidied; a * or a ? is part of a name there; blank and over-long are refused', ['  Door Tag -  Text Only ', 'Tag (new)?', '', 'a'.repeat(121)].map((x) => listEntry('tag_families', x)), ['Door Tag - Text Only', 'Tag (new)?', null, null])
const CN = { counter_names: ['counter top', 'countertop'], counter_names_source: { 'counter top': LN }, touch_tol_in: 0.5 }
eq('check lists: the countertop names of a check are a list the app knows, with the source of each word', ruleLists(CN).map((l) => [l.key, l.spec.one, l.rows]), [['counter_names', 'name', [{ value: 'counter top', source: LN }, { value: 'countertop', source: null }]]])
eq('check lists: a typed countertop name is a word or a few, tidied; one letter, blank and over-long are refused', ['  Vanity   Top ', 'slab 1 1/2"', 'x', '', 'a'.repeat(61)].map((x) => listEntry('counter_names', x)), ['Vanity Top', 'slab 1 1/2"', null, null, null])
const WL = { exterior_finish_words: ['pbr', 'siding'], exterior_finish_words_source: { pbr: LN }, outside_departments: ['Outdoor', 'Carport'], outside_departments_source: { Carport: LN }, probe_offset_in: 6 }
eq('check lists: the exterior finish words and the outside Departments of a check are lists the app knows, each row with its source', ruleLists(WL).map((l) => [l.key, l.spec.one, l.rows]), [['exterior_finish_words', 'word', [{ value: 'pbr', source: LN }, { value: 'siding', source: null }]], ['outside_departments', 'Department', [{ value: 'Outdoor', source: null }, { value: 'Carport', source: LN }]]])
eq('check lists: a typed exterior finish word is a word or a few, tidied, at least two characters; a Department may be one character; blank and over-long are refused', [...['  Metal   Siding ', 'x', '', 'a'.repeat(61)].map((x) => listEntry('exterior_finish_words', x)), ...['  Outdoor ', 'A', '', 'a'.repeat(61)].map((x) => listEntry('outside_departments', x))], ['Metal Siding', null, null, null, 'Outdoor', 'A', null, null])
const SL = { riser_words: ['RISERS', 'RISER'], riser_words_source: { RISERS: LN }, tread_words: ['TREADS', 'TREAD'], tread_words_source: { TREAD: LN } }
eq('check lists: the riser words and the tread words of a check are lists the app knows, each row with its source', ruleLists(SL).map((l) => [l.key, l.spec.one, l.rows]), [['riser_words', 'word', [{ value: 'RISERS', source: LN }, { value: 'RISER', source: null }]], ['tread_words', 'word', [{ value: 'TREADS', source: null }, { value: 'TREAD', source: LN }]]])
eq('check lists: a typed riser or tread word is a word or a few, tidied, at least two characters; blank and over-long are refused', [...['  Risers ', 'R', '', 'a'.repeat(41)].map((x) => listEntry('riser_words', x)), ...[' going   up ', 'T', '', 'a'.repeat(41)].map((x) => listEntry('tread_words', x))], ['Risers', null, null, null, 'going up', null, null, null])
eq('check lists: the same entry in another case or with other spacing is the same entry, as the checker reads it', [sameEntry('A107.5 B', ' a107.5   b '), sameEntry('Door Tag - Text Only', 'DOOR TAG - TEXT ONLY'), sameEntry('A100.3', 'A100.3?'), sameEntry('A100', 'A100.1')], [true, true, false, false])
eq('check lists: an entry added on the page says a person added it and that no standard names it', addedEntrySource('mitch@x', '2026-11-12', 'sheet'), 'Added on this page by mitch@x on 2026-11-12. No standard document names this sheet: it is on the check on their word.')
const lc1 = changedTextSource(LN, 'mitch@x', '2026-11-12', 'A107.*', 'A107.1*')
eq('check lists: a changed entry says who, when and from what, and its first source keeps its marking', lc1, 'Changed on this page by mitch@x on 2026-11-12, from "A107.*" to "A107.1*". Source of the first value: ' + LN)
// ---- an acceptance, for every kind of note: the marking of a row nobody changed is kept and says who adopted it ----
const AD = ' Accepted as shown by mitch@x on 2026-11-12, without a change to this row.'
eq('adoption: an acceptance writes onto the marked rows of a list only; a stated row and a changed row are left as they were', adoptUnreviewed({ ...LST, sheet_list_source: { A100: LST.sheet_list_source.A100, 'A107.*': LN, 'A100.3?': lc1 } }, 'mitch@x', '2026-11-12'), { ...LST, sheet_list_source: { A100: LST.sheet_list_source.A100, 'A107.*': LN + AD, 'A100.3?': lc1 } })
eq('adoption: the roles are adopted as before, and marked words too; every other value of the check is untouched', [adoptUnreviewed({ ...ROL, roles_source: { 'Casework wood': RN, Hardware: rc1 } }, 'mitch@x', '2026-11-12'), adoptUnreviewed({ note_text: 'X', note_text_source: UNREVIEWED + '. Mine.', tolerance_in: 1 }, 'mitch@x', '2026-11-12')], [{ ...ROL, roles_source: { 'Casework wood': RN + AD, Hardware: rc1 } }, { note_text: 'X', note_text_source: UNREVIEWED + '. Mine.' + AD, tolerance_in: 1 }])
eq('adoption: nothing marked, nothing to write; a second acceptance does not adopt twice', [adoptUnreviewed(TXT, 'm', 'd'), adoptUnreviewed(FOL, 'm', 'd'), adoptUnreviewed(PAL, 'm', 'd'), adoptUnreviewed(null, 'm', 'd'), adoptUnreviewed({}, 'm', 'd'), adoptUnreviewed(adoptUnreviewed(LST, 'mitch@x', '2026-11-12'), 'michael@x', '2026-11-13')], [null, null, null, null, null, null])
// ---- emit-same: would a press of Lock & Emit write anything new? (flag 52) ----
const E1 = { project: { name: 'S', client: null, emitted_version: 3, emitted_at: '2026-11-12T01:00:00Z' }, rooms: [{ section_code: '101', name: 'Kitchen', review_state: 'confirmed', area_sf: null, model_state: { doors: 2 }, decisions: [{ topic: 'island', value: '84 x 42', source: 'transcript', source_ref: null, meeting_date: null, superseded_by: [] }], open_questions: [], redline_notes: [], images: [] }], unassigned_images: 0, parked_images: 1 }
const E1next = { ...E1, project: { ...E1.project, emitted_version: 4, emitted_at: '2026-11-12T02:00:00Z' } }
const E2 = { schema: 'intent-contract/2.0', project: { name: 'S', slug: 's', doc: null, client: null }, version: 3, emitted_at: '2026-11-12T01:00:00Z', sha256_intent: 'aaa', vocabulary: { status: 'draft', kinds: 35 }, rooms: [{ section_code: '101', role: 'kitchen', work_items: [{ id: 'wi-1', kind: 'casework.place' }] }], house: { work_items: [], context: [], opens: [], defaults_applied: [] }, site: { work_items: [] } }
const E2next = { ...E2, version: 4, emitted_at: '2026-11-12T02:00:00Z', sha256_intent: 'bbb' }
const EROW = { version: 3, emitted_at: '2026-11-12T01:00:00Z', intent_json: E1, intent_v2_json: E2, v2_errors: null }
const flip = (v) => Array.isArray(v) ? v.map(flip) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, flip(v[k])])) : v
const withRoom = (c, patch) => ({ ...c, rooms: [{ ...c.rooms[0], ...patch }] })
eq('emit-same: the same content built again is the same, whatever its version, time and fingerprint', sameAsEmitted(EROW, E1next, E2next, null), true)
eq('emit-same: the order of the keys in the stored row does not matter, nor a value that is undefined', sameAsEmitted({ ...EROW, intent_json: flip(E1), intent_v2_json: flip(E2) }, { ...E1next, extra: undefined }, E2next, null), true)
eq('emit-same: a changed decision, a new room, a parked picture, another project name: each is a change', [sameAsEmitted(EROW, withRoom(E1next, { decisions: [{ ...E1.rooms[0].decisions[0], value: '96 x 42' }] }), E2next, null), sameAsEmitted(EROW, { ...E1next, rooms: [...E1.rooms, { ...E1.rooms[0], section_code: '102' }] }, E2next, null), sameAsEmitted(EROW, { ...E1next, parked_images: 2 }, E2next, null), sameAsEmitted(EROW, { ...E1next, project: { ...E1next.project, name: 'T' } }, E2next, null)], [false, false, false, false])
eq('emit-same: the order of the rooms and of a list counts (a list is not sorted)', sameAsEmitted({ ...EROW, intent_json: { ...E1, rooms: [E1.rooms[0], { ...E1.rooms[0], section_code: '102' }] } }, { ...E1next, rooms: [{ ...E1.rooms[0], section_code: '102' }, E1.rooms[0]] }, E2next, null), false)
eq('emit-same: a change in the typed half alone is a change (a role, a kind of work)', [sameAsEmitted(EROW, E1next, withRoom(E2next, { role: 'pantry' }), null), sameAsEmitted(EROW, E1next, withRoom(E2next, { work_items: [{ id: 'wi-1', kind: 'casework.counter' }] }), null)], [false, false])
eq('emit-same: no typed contract both times: the same gaps are the same, other gaps are a change, a typed contract now is a change', [sameAsEmitted({ ...EROW, intent_v2_json: null, v2_errors: ['Room 101 Kitchen: no role chosen'] }, E1next, null, ['Room 101 Kitchen: no role chosen']), sameAsEmitted({ ...EROW, intent_v2_json: null, v2_errors: ['Room 101 Kitchen: no role chosen'] }, E1next, null, ['Room 102 Bath: no role chosen']), sameAsEmitted({ ...EROW, intent_v2_json: null, v2_errors: ['Room 101 Kitchen: no role chosen'] }, E1next, E2next, null), sameAsEmitted(EROW, E1next, null, ['x'])], [true, false, false, false])
eq('emit-same: no emission, an empty one, or one that holds no contract is never the same', [sameAsEmitted(null, E1next, E2next, null), sameAsEmitted(undefined, E1next, E2next, null), sameAsEmitted({ version: 1, intent_json: {} }, {}, null, null), sameAsEmitted({ version: 1, intent_json: null }, null, null, null)], [false, false, false, false])
eq('emit-same: only the version and the time are left out of the contract, only version, time and fingerprint out of the typed one', [contentOfV1(E1) === contentOfV1(E1next), contentOfV1(E1).includes('emitted_'), contentOfV1(E1).includes('"name":"S"'), contentOfV2(E2, null) === contentOfV2(E2next, null), /version|emitted_at|sha256_intent/.test(contentOfV2(E2, null)), contentOfV2(E2, null).includes('intent-contract/2.0')], [true, false, true, true, false, true])
eq('emit-same: the inputs are not changed by the comparison', [E1next.project.emitted_version, E2next.sha256_intent, EROW.intent_json.project.emitted_at], [4, 'bbb', '2026-11-12T01:00:00Z'])
eq('emit-same, two presses at once: the other press wrote the contract and not yet the typed half = the same; other content = not', [sameAsBeingWritten({ version: 4, intent_json: E1next, intent_v2_json: null, v2_errors: null }, E1next, E2next, null), sameAsBeingWritten({ version: 4, intent_json: E1next, intent_v2_json: E2next, v2_errors: null }, E1next, E2next, null), sameAsBeingWritten({ version: 4, intent_json: { ...E1next, parked_images: 5 }, intent_v2_json: null, v2_errors: null }, E1next, E2next, null), sameAsBeingWritten({ version: 4, intent_json: E1next, intent_v2_json: withRoom(E2next, { role: 'pantry' }), v2_errors: null }, E1next, E2next, null), sameAsBeingWritten(null, E1next, E2next, null)], [true, true, false, false, false])

// ---- inspiration pictures feed the 2D drawings (spec A97) ----
eq('inspo: layout details are short texts, one line each, no doubles, no closing full stop, at most ' + LAYOUT_DETAILS_MAX,
  [tidyLayoutDetails([' Island with  seating on one side. ', 'island with seating on one side', 7, null, '', 'Range on the back wall;', ...Array.from({ length: 10 }, (_, i) => 'detail ' + i)]).slice(0, 3), tidyLayoutDetails(Array.from({ length: 12 }, (_, i) => 'd' + i)).length, tidyLayoutDetails('island'), tidyLayoutDetails(null), tidyLayoutDetails(['x'.repeat(200)])[0].length],
  [['Island with seating on one side', 'Range on the back wall', 'detail 0'], LAYOUT_DETAILS_MAX, [], [], LAYOUT_DETAIL_CHARS])
const ANS = 'thinking...\n{"description": "Walnut island under a black hood", "tags": ["walnut", "black"], "palette": ["#222222"], "suggested_room": "Kitchen", "layout_details": ["island with seating on one side", "range on the back wall", 3]}'
eq('inspo: the model answer is read with its layout details; an answer written before they existed gives an empty list; no JSON gives nothing',
  [parseAnalysis(ANS), parseAnalysis('{"description": "d", "tags": [], "palette": [], "suggested_room": "Bath"}').layout_details, parseAnalysis('no json here'), parseAnalysis('{bad'), parseAnalysis('[1]')],
  [{ description: 'Walnut island under a black hood', tags: ['walnut', 'black'], palette: ['#222222'], suggested_room: 'Kitchen', layout_details: ['island with seating on one side', 'range on the back wall'] }, [], null, null, null])
eq('inspo: the prompt asks for layout details a plan can show, and rules out colours and materials', [ANALYSIS_PROMPT.includes('"layout_details"'), ANALYSIS_PROMPT.includes('FLOOR PLAN'), ANALYSIS_PROMPT.includes('No colours, no materials')], [true, true, true])
eq('inspo: reading a picture again keeps the tags that were there and adds the new ones once', mergeTags(['mine', 'walnut', 'color:#222222'], { tags: ['walnut', 'oak'], palette: ['#222222', '#ffffff'] }), ['mine', 'walnut', 'color:#222222', 'oak', 'color:#ffffff'])
const GEO = { elements: [], meta: { inspo: { pictures: [{ storage_path: 'p/a.jpg', details: 2 }], used: [{ picture: 'p/a.jpg', detail: 'island with seating on one side', element: 'isl', source: 'app' }, { picture: 'p/b.jpg', detail: 'pantry beside the fridge', source: 'blueprint' }, { detail: '' }, 'x'], not_used: [{ picture: 'p/a.jpg', detail: 'range on the back wall', reason: 'the typed decision puts the range on the island' }, { picture: null, detail: 'tub under the window' }] } } }
const USE = inspoUse(GEO)
eq('inspo: what a drawing says it did with the pictures is read from its meta; entries without a detail are dropped; a missing reason is said',
  [USE.said, USE.used, USE.not_used],
  [true, [{ picture: 'p/a.jpg', detail: 'island with seating on one side', element: 'isl', source: 'app' }, { picture: 'p/b.jpg', detail: 'pantry beside the fridge', element: null, source: 'blueprint' }],
    [{ picture: 'p/a.jpg', detail: 'range on the back wall', reason: 'the typed decision puts the range on the island' }, { picture: null, detail: 'tub under the window', reason: 'no reason given' }]])
eq('inspo: a drawing made before pictures fed the drawings says nothing, and that is not an empty list', [inspoUse({ elements: [] }), inspoUse(null), inspoUse({ meta: { inspo: null } }), inspoUse({ meta: { inspo: [] } }).said], [{ said: false, used: [], not_used: [] }, { said: false, used: [], not_used: [] }, { said: false, used: [], not_used: [] }, false])
eq('inspo: one detail of one picture as the drawing treated it: used, not used with the reason, or not mentioned; an entry that names no picture covers any; another picture does not',
  [detailState(USE, 'p/a.jpg', 'Island with seating  on one side'), detailState(USE, 'p/a.jpg', 'range on the back wall'), detailState(USE, 'p/a.jpg', 'double vanity'), detailState(USE, 'p/z.jpg', 'tub under the window').state, detailState(USE, 'p/z.jpg', 'island with seating on one side').state],
  [{ state: 'used', reason: null }, { state: 'not_used', reason: 'the typed decision puts the range on the island' }, { state: 'unsaid', reason: null }, 'not_used', 'unsaid'])
{
  const withDetails = buildContractV2({ ...base, images: [{ room_id: 'r1', storage_path: 'p/a.jpg', notes: 'hood', tags: ['walnut'], layout_details: [' island with seating on one side. ', 3, 'island with seating on one side'] }, { room_id: 'r1', storage_path: 'p/b.jpg', notes: null, tags: null }, { room_id: null, storage_path: 'p/parked.jpg', notes: null, tags: [] }] })
  const plain = buildContractV2(base)
  eq('v2 inspo: a room\'s pictures carry notes, tags and layout details; a picture never read has an empty list; a picture on no room is not in the contract',
    [withDetails.ok && withDetails.contract.rooms.find((r) => r.section_code === '201').inspo, plain.ok && plain.contract.rooms.find((r) => r.section_code === '201').inspo],
    [[{ storage_path: 'p/a.jpg', notes: 'hood', tags: ['walnut'], layout_details: ['island with seating on one side'] }, { storage_path: 'p/b.jpg', notes: null, tags: [], layout_details: [] }], [{ storage_path: 'p/a.jpg', notes: 'hood', tags: [], layout_details: [] }]])
  eq('v2 inspo: the details are part of the fingerprint, and a typed contract with them is valid', [withDetails.contract.sha256_intent !== plain.contract.sha256_intent, validateContractV2(withDetails.contract, KINDS), validateContractV2(plain.contract, KINDS)], [true, [], []])
  const old = JSON.parse(JSON.stringify(plain.contract)); for (const r of old.rooms) for (const p of r.inspo) delete p.layout_details
  const bad = JSON.parse(JSON.stringify(withDetails.contract)); bad.rooms.find((r) => r.section_code === '201').inspo[0].layout_details = ['ok', 4]
  eq('v2 inspo: a contract emitted before the details existed is still valid; details that are not texts are not', [validateContractV2({ ...old, sha256_intent: contractSha(old) }, KINDS), validateContractV2({ ...bad, sha256_intent: contractSha(bad) }, KINDS)], [[], ['room 201: layout_details of a picture must be a list of texts']])
}
console.log(fails ? 'FAILED ' + fails : 'ALL PASS')
process.exit(fails ? 1 : 0)
