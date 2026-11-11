
import { projectProgress } from '../src/lib/progress.ts'
import { lineDiff, foldDiff, diffStats } from '../src/lib/diff.ts'
import { describeRule, describeScope, ruleToFields, fieldsToRule, keyFromDescription } from '../src/lib/rule-text.ts'
import { roomNameMatches, runMathGate } from '../src/lib/rules.ts'
import { deterministicDimensionCheck } from '../src/lib/dimension-check.ts'
import { normaliseRole, suggestKind, suggestNeeds2d, suggestRole } from '../src/lib/vocab.ts'
import { buildContractV2, contractSha, validateContractV2 } from '../src/lib/emit-v2.ts'
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
eq('v2: "no work" lines are carried as context, not built and not dropped', [room('201').context, room('203').context, room('203').work_items.length], [[{ text: 'under the stair: Leave it open', source: 'manual', evidence: null }], [{ text: 'keep: Keep the window seat', source: 'redline', evidence: null }], 0])
eq('v2: only an ACCEPTED check is attached', [room('201').work_items[0].acceptance, room('201').work_items[2].acceptance], [['casework.no_overlap'], []])
eq('v2: a line that moves a wall marks the room shell-changed', [room('201').shell_changed, room('202').shell_changed], [false, true])
eq('v2: a later-stage kind is carried as a work item, not refused', room('202').work_items.map((w) => w.kind), ['surface.wall', 'mep.electrical'])
eq('v2: house and site are separate', [C.house.work_items.map((w) => [w.kind, w.room]), C.site.work_items.map((w) => [w.kind, w.room]), C.house.defaults_applied], [[['finish.material', 'HOUSE']], [['site.fence', 'HOUSE']], ['default:ceiling', 'default:fridge']])
eq('v2: opens keep their default and answer', [room('201').opens, C.house.opens], [[{ question: 'Pot filler?', default: null, blocking: false, answer: 'Yes' }], [{ question: 'Gutters?', default: 'Black', blocking: false, answer: null }]])
eq('v2: scan metadata is always present', [room('201').model_state, room('203').model_state], [{ casework: 4, scanned_at: '2026-11-10T20:00:00Z', bridge_build: 'f98f724' }, { scanned_at: null, bridge_build: null }])
eq('v2: vocabulary is marked draft', C.vocabulary, { status: 'draft', kinds: KINDS.length })
eq('v2: work item ids are stable and unique', [/^wi-[0-9a-f]{8}$/.test(room('201').work_items[0].id), buildContractV2(base).contract.rooms[0].work_items[0].id === room('201').work_items[0].id, new Set([...C.rooms.flatMap((r) => r.work_items), ...C.house.work_items, ...C.site.work_items].map((w) => w.id)).size], [true, true, 7])
eq('v2: fingerprint matches, and changes with the content', [C.sha256_intent === contractSha(C), C.sha256_intent.length, buildContractV2({ ...base, version: 4 }).contract.sha256_intent === C.sha256_intent], [true, 64, false])
eq('v2: valid against the vocabulary', validateContractV2(C, KINDS), [])
eq('v2: validation catches a tampered contract', validateContractV2({ ...C, rooms: [{ ...C.rooms[0], role: 'other' }, ...C.rooms.slice(1)] }, KINDS).length, 2)
eq('v2: warnings do not stop it (no scan time on two rooms)', v2.warnings.length, 2)

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
console.log(fails ? 'FAILED ' + fails : 'ALL PASS')
process.exit(fails ? 1 : 0)
