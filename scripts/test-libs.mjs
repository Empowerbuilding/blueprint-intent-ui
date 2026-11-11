
import { projectProgress } from '../src/lib/progress.ts'
import { lineDiff, foldDiff, diffStats } from '../src/lib/diff.ts'
import { describeRule, describeScope, ruleToFields, fieldsToRule, keyFromDescription } from '../src/lib/rule-text.ts'
import { roomNameMatches, runMathGate } from '../src/lib/rules.ts'
import { deterministicDimensionCheck } from '../src/lib/dimension-check.ts'
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
console.log(fails ? 'FAILED ' + fails : 'ALL PASS')
process.exit(fails ? 1 : 0)
