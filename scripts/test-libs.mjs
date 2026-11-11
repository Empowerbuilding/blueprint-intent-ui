
import { projectProgress } from '../src/lib/progress.ts'
import { lineDiff, foldDiff, diffStats } from '../src/lib/diff.ts'
import { describeRule, describeScope, ruleToFields, fieldsToRule, keyFromDescription } from '../src/lib/rule-text.ts'
import fs from 'node:fs'
let fails = 0
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v
const eq = (name, got, want) => { const g = JSON.stringify(canon(got)), w = JSON.stringify(canon(want)); if (g !== w) { fails++; console.log('FAIL', name, '\n  got ', g, '\n  want', w) } else console.log('ok  ', name) }

// ---- rule-text against the LIVE rulebook mirror ----
const seed = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/automation/rules_seed.json', 'utf8'))
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
