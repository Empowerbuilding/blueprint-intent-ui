// Fixture data for the smoke test: one project in every stage of the pipeline,
// outlines in every review state, the live rulebook mirror, real standards text.
// node scripts/smoke/fixtures.mjs <out.json>
import fs from 'node:fs'
import { DEFAULTS } from '../../src/lib/defaults.ts'

const HERE = new URL('.', import.meta.url).pathname
const now = Date.now()
const t = (minsAgo) => new Date(now - minsAgo * 60000).toISOString()
const out = process.argv[2]

const P = { deu: 'p-deubner', whi: 'p-whitaker', man: 'p-mann', sch: 'p-schwan', ban: 'p-banks' }
const room = (id, project_id, section_code, name, review_state, sort_order, extra = {}) => ({
  id, project_id, section_code, name, review_state, sort_order, area_sf: null, model_state: {}, source: 'model_scan', ...extra,
})
const dec = (id, project_id, room_id, topic, value, status, minsAgo, extra = {}) => ({
  id, project_id, room_id, topic, value, status, source: 'transcript', source_ref: '11/06 14:22', meeting_date: '2026-11-06',
  superseded_by: null, created_at: t(minsAgo), ...extra,
})
const lesson = (id, status, kind, title, what_happened, proposed_rule, minsAgo, extra = {}) => ({
  id, status, kind, title, what_happened, proposed_rule, accepted_rule: null, project_id: null, project_name: null, source: 'blueprint', source_ref: null,
  proposed_by: 'blueprint', decided_by: null, decided_by_email: null, decided_at: null, accepted_at: null, decision_note: null, created_at: t(minsAgo), ...extra,
})
const math = (results) => ({
  ran_at: t(118), rulebook_version: 2,
  passed: results.some((r) => r.status === 'fail') ? false : results.some((r) => r.status === 'pass') ? true : null,
  results,
})
const outline = (id, project_id, room_id, outline_type, label, status, minsAgo, checks, extra = {}) => ({
  id, project_id, room_id, outline_type, label, status, pushed_at: t(minsAgo), pushed_by: 'blueprint',
  storage_path: project_id + '/' + room_id + '/' + id + '.png',
  geometry: { units: 'in', elements: [{ id: 'i1', kind: 'island', x: 40, y: 60, w: 84, h: 42 }, { id: 'c1', kind: 'counter', x: 0, y: 0, w: 200, h: 25 }] },
  checks, feedback: null, replaces: null, approved_by: null, approved_at: null, ...extra,
})

const seed = JSON.parse(fs.readFileSync(HERE + 'rules.json', 'utf8'))
const rules = seed.rules.map((r, i) => ({ id: 'rule-' + i, active: true, version: r.version || 1, created_at: t(3000), updated_at: t(2800), ...r }))
rules.push({ id: 'rule-off', rule_key: 'tub_required', description: 'Master bath has a tub.', rule_type: 'required_kind', params: { kind: 'tub', min_count: 1 }, applies_to: { room_names: ['Master Bath'], outline_types: ['plan'] }, active: false, version: 3, created_at: t(3000), updated_at: t(900) })
rules.push({ id: 'rule-raw', rule_key: 'appliance_spacing_flat', description: 'Appliances keep 3 in apart.', rule_type: 'min_clearance', params: { between: ['fridge', 'range', 'dishwasher'], min_in: 3 }, applies_to: { room_names: '*', outline_types: ['plan'] }, active: true, version: 1, created_at: t(3000), updated_at: t(2900) })

// synthetic documents — long enough to exercise folding in the what-changed view
const doc = (title, n) => ['# ' + title, '', ...Array.from({ length: n }, (_, i) => (i % 9 === 0 ? '## Section ' + (i / 9 + 1) : '- Rule ' + (i + 1) + ': sample standard text for line ' + (i + 1) + '.'))].join('\n')
const runbook = doc('D1 to D2 Runbook', 70)
const build = doc('Design Build Standard', 30)
const lines = runbook.split('\n')
const runbookV1 = lines.filter((_, i) => i !== 12 && i !== 40).join('\n')
const runbookV2 = [...lines.slice(0, 20), 'A line that only existed in version 2.', ...lines.slice(20)].join('\n')

const db = {
  __user: { id: 'user-mitch', aud: 'authenticated', role: 'authenticated', email: 'mitch@barnhaus.test', app_metadata: {}, user_metadata: {}, created_at: t(90000) },
  intent_projects: [
    { id: P.deu, name: 'Deubner', client: 'Deubner family', status: 'intake', emitted_version: 0, created_at: t(4000) },
    { id: P.whi, name: 'Whitaker', client: null, status: 'locked', emitted_version: 1, created_at: t(4100) },
    { id: P.man, name: 'Mann', client: null, status: 'intake', emitted_version: 0, created_at: t(4050) },
    { id: P.sch, name: 'Schwan', client: 'Schwan', status: 'building', emitted_version: 1, created_at: t(9000) },
    { id: P.ban, name: 'Banks', client: 'Banks', status: 'done', emitted_version: 1, created_at: t(20000) },
  ],
  intent_rooms: [
    room('r-d101', P.deu, '101', 'Foyer', 'unreviewed', 0, { area_sf: 96.4 }),
    room('r-d103', P.deu, '103', 'Kitchen', 'confirmed', 1, { area_sf: 386.1, model_state: { windows: 3, island: true, casework_runs: 6 } }),
    room('r-d114', P.deu, '114', 'Bath 2', 'unreviewed', 2, { area_sf: 61 }),
    room('r-dh', P.deu, 'HOUSE', 'House-Level (global)', 'unreviewed', 3, { source: 'template' }),
    room('r-wb2', P.whi, 'B2', 'Great Room / Living', 'confirmed', 0),
    room('r-wb3', P.whi, 'B3', 'Kitchen', 'confirmed', 1, { area_sf: 402 }),
    room('r-wb5', P.whi, 'B5', 'Master Suite', '2d_approved', 2),
    room('r-wh', P.whi, 'HOUSE', 'House-Level (global)', 'defaults_accepted', 3),
    room('r-s1', P.sch, '101', 'Kitchen', '2d_approved', 0),
    room('r-s2', P.sch, 'HOUSE', 'House-Level (global)', 'defaults_accepted', 1),
    room('r-b1', P.ban, '101', 'Kitchen', '2d_approved', 0),
  ],
  intent_decisions: [
    dec('d1', P.deu, 'r-d103', 'island', '84 x 42 island, seating on the great-room side', 'active', 3000),
    dec('d2', P.deu, 'r-d103', 'backsplash', 'Full-height slab behind the range only', 'active', 2000),
    dec('d3', P.deu, 'r-d103', 'backsplash', 'Subway tile to the uppers', 'superseded', 3000, { superseded_by: 'd2', meeting_date: '2026-10-30' }),
    dec('d4', P.whi, 'r-wb3', 'island', '96 x 48 island', 'active', 3000),
    dec('d5', P.whi, 'r-wb3', 'hood', 'Plaster hood, no wood', 'active', 30), // added AFTER the lock
    dec('d6', P.sch, 'r-s1', 'island', '84 x 42 island', 'active', 8000),
    // real board pushes: several ACTIVE lines under one topic, sources are long transcript quotes (overflowed the row live, 11-11)
    dec('d7', P.deu, 'r-d103', 'general', 'Appliance garage left of the fridge', 'active', 1500, { source_ref: "[23:51] Client: I think we do an appliance garage over there by the fridge, that way the coffee stuff is not sitting out on the counter all the time, and it lines up with the uppers" }),
    dec('d8', P.deu, 'r-d103', 'general', 'Trash pullout at the sink, right side', 'active', 1400, { source_ref: '38:01 — yeah, trash pullout next to the sink, right-hand side, double bin, and keep it out of the dishwasher swing' }),
    dec('d9', P.deu, 'r-d103', 'general', 'No microwave drawer in the island', 'active', 1300),
    // one line taken out by hand (superseded, nothing in its place) and a topic whose only line was taken out
    dec('d10', P.deu, 'r-d103', 'general', 'Wine fridge under the bar end', 'superseded', 1200, { status_changed_at: t(100) }),
    dec('d11', P.deu, 'r-d103', 'pot rack', 'Hanging pot rack over the island', 'superseded', 1100, { status_changed_at: t(90) }),
  ],
  intent_open_questions: [
    { id: 'q1', project_id: P.deu, room_id: 'r-d103', question: 'Floating shelves or uppers on the window wall?', answer: null, default_if_unanswered: 'Uppers to 10 ft', blocking: true, created_at: t(2500) },
    { id: 'q2', project_id: P.deu, room_id: 'r-d103', question: 'Pot filler?', answer: 'Yes, centred on the range', default_if_unanswered: null, blocking: false, created_at: t(2600) },
    { id: 'q3', project_id: P.deu, room_id: 'r-d114', question: 'Tub or shower only?', answer: null, default_if_unanswered: null, blocking: false, created_at: t(2400) },
  ],
  intent_redline_notes: [
    { id: 'n1', project_id: P.deu, room_id: 'r-d103', note_type: 'beam', text: 'Beam, not a wall, between kitchen and great room', source_ref: 'A101.1', created_at: t(2500) },
  ],
  intent_inspo_images: [
    { id: 'i1', project_id: P.deu, room_id: null, parked: false, storage_path: P.deu + '/a.jpg', notes: 'Walnut island with waterfall edge', tags: ['walnut'], assigned_at: null, created_at: t(2000) },
    { id: 'i2', project_id: P.deu, room_id: null, parked: false, storage_path: P.deu + '/b.jpg', notes: null, tags: [], assigned_at: null, created_at: t(2000) },
    { id: 'i3', project_id: P.deu, room_id: 'r-d103', parked: false, storage_path: P.deu + '/c.jpg', notes: 'Black range hood', tags: [], assigned_at: t(1900), created_at: t(2000) },
  ],
  intent_emissions: [
    { id: 'e1', project_id: P.whi, version: 1, emitted_at: t(600), blueprint_status: 'handed_off', intent_json: {}, brief_md: '# Whitaker' },
    { id: 'e2', project_id: P.sch, version: 1, emitted_at: t(7000), blueprint_status: 'handed_off', intent_json: {}, brief_md: '# Schwan' },
    { id: 'e3', project_id: P.ban, version: 1, emitted_at: t(18000), blueprint_status: 'handed_off', intent_json: {}, brief_md: '# Banks' },
  ],
  intent_outlines: [
    outline('o-plan', P.whi, 'r-wb3', 'plan', 'Zone map', 'pushed', 120, {
      math: math([
        { rule_key: 'island_clearance_42', description: 'Island needs 42" minimum clear to counters, appliances, and tall cabinets.', status: 'fail', measured: '38"', required: '≥ 42"', detail: 'Island ↔ Range' },
        { rule_key: 'walkway_min_36', description: 'Walkways must be at least 36" wide.', status: 'pass', measured: '44"', required: '≥ 36"', detail: 'Walkway (min(w,h))' },
        { rule_key: 'no_blind_corners', description: 'Blind corner cabinets are forbidden.', status: 'na', detail: 'no "blind_corner" elements in this outline' },
      ]),
      vision: { ran_at: t(117), model: 'glm-4.6v+code', status: 'ok', results: [
        { topic: 'island', verdict: 'conflict', note: 'geometry check: decision says 96x48 but drawn island is 84x42' },
        { topic: 'range wall', verdict: 'confirmed', note: 'range centred on the north wall' },
        { topic: 'sink', verdict: 'confirmed', note: 'sink under the window' },
        { topic: 'pendants', verdict: 'missing', note: 'not visible on a plan' },
        { topic: 'hardware', verdict: 'na', note: 'finish, not drawable' },
      ] },
    }),
    outline('o-elev', P.whi, 'r-wb3', 'elevation', 'North wall', 'approved', 300, {
      math: math([{ rule_key: 'uppers_aff_54', description: 'Upper cabinets mount at 54" above finished floor (±1").', status: 'fail', measured: 'bottom @ 60" AFF', required: '54" ± 1"', detail: 'Uppers' }]),
      vision: { ran_at: t(299), model: 'glm-4.6v+code', status: 'ok', results: [{ topic: 'range wall', verdict: 'confirmed', note: 'hood centred' }] },
      override: { reason: 'Client is 6 ft 4 — uppers raised on purpose', by: 'michael@barnhaus.test', at: t(200), failed_rules: ['uppers_aff_54'] },
    }),
    outline('o-sec', P.whi, 'r-wb3', 'section', 'Through island', 'rejected', 400, { math: math([]) }, { feedback: 'Soffit should stop at the beam, not run past it' }),
    outline('o-old', P.whi, 'r-wb3', 'plan', 'Zone map', 'superseded', 900, { math: math([]) }),
    outline('o-gr', P.whi, 'r-wb2', 'plan', 'Zone map', 'pushed', 2, {
      math: math([{ rule_key: 'walkway_min_36', description: 'Walkways must be at least 36" wide.', status: 'pass', measured: '48"', required: '≥ 36"' }]),
      vision: { ran_at: t(1), model: 'glm-4.6v', status: 'running' },
    }),
    outline('o-ms', P.whi, 'r-wb5', 'plan', 'Zone map', 'approved', 500, { math: math([{ rule_key: 'door_clearance_36', description: 'Doors need 36" clear.', status: 'pass', measured: '40"', required: '≥ 36"' }]), vision: { ran_at: t(499), status: 'skipped', skipped: 'no active decisions for this room (nothing to verify)' } }),
    outline('o-s1', P.sch, 'r-s1', 'plan', 'Zone map', 'approved', 6000, { math: math([]) }),
  ],
  intent_rules: rules,
  intent_rulebook_versions: [
    { id: 'rb2', version: 2, created_at: seed.rulebook_version_at, snapshot: seed.rules },
    { id: 'rb1', version: 1, created_at: t(4000), snapshot: seed.rules },
  ],
  intent_standards: [
    { id: 's-run', slug: 'd1-to-d2-runbook', category: 'process', title: 'D1 → D2 Runbook', description: 'The Draft 1 to Draft 2 pipeline, stage by stage.', content: runbook, format: 'markdown', source_path: 'standards/D1_TO_D2_RUNBOOK.md', version: 3, active: true, updated_at: t(1250) },
    { id: 's-build', slug: 'design-build-standard', category: 'modeling', title: 'Design Build Standard', description: 'Palette, casework, bath and floor rules.', content: build, format: 'markdown', source_path: 'standards/DESIGN_BUILD_STANDARD.md', version: 1, active: true, updated_at: t(1400) },
  ],
  intent_standards_versions: [
    { id: 'sv1', standard_id: 's-run', version: 1, content: runbookV1, note: 'created by blueprint', edited_by: null, created_at: t(1400) },
    { id: 'sv2', standard_id: 's-run', version: 2, content: runbookV2, note: 'Room numbering pass moved early (Mitch 11/10)', edited_by: null, created_at: t(1300) },
    { id: 'sv3', standard_id: 's-run', version: 3, content: runbook, note: 'Removed a stray line', edited_by: 'user-mitch', created_at: t(1250) },
    { id: 'sv4', standard_id: 's-build', version: 1, content: build, note: 'created by blueprint', edited_by: null, created_at: t(1400) },
  ],
  portal_messages: [], // what the app tells Blueprint
  // capabilities: Mitch's machine on a newer bridge build than Michael's (two commands Michael does not have yet)
  intent_bridge_reports: [
    { id: 'br3', machine: 'mitch', bridge_build: 'f98f724', revit_version: '2025', reported_by: 'blueprint', first_reported_at: t(300), reported_at: t(40),
      commands: ['revit.create_wall', 'revit.create_family_box', 'revit.delete_element', 'revit.get_elements_info', 'revit.rehost_element', 'revit.save_document', 'revit.set_parameter_value'].map((name) => ({ name, description: name === 'revit.save_document' ? 'Save the active document.' : null })) },
    { id: 'br2', machine: 'mitch', bridge_build: '8eb2a8b', revit_version: '2025', reported_by: 'blueprint', first_reported_at: t(3000), reported_at: t(400),
      commands: ['revit.create_wall', 'revit.delete_element', 'revit.get_elements_info', 'revit.save_document', 'revit.set_parameter_value'].map((name) => ({ name, description: null })) },
    { id: 'br1', machine: 'michael', bridge_build: '8eb2a8b', revit_version: '2025', reported_by: 'blueprint', first_reported_at: t(3000), reported_at: t(60),
      commands: ['revit.create_wall', 'revit.delete_element', 'revit.get_elements_info', 'revit.save_document', 'revit.set_parameter_value'].map((name) => ({ name, description: null })) },
  ],
  intent_bridge_proven: [
    { command: 'revit.save_document', machine: 'mitch', bridge_build: '8eb2a8b', note: 'Deubner D2, saved and reopened', proven_at: t(2900) },
    { command: 'revit.delete_element', machine: 'michael', bridge_build: '8eb2a8b', note: 'Patel, existence checked after', proven_at: t(1500) },
  ],
  intent_gaps: [
    { id: 'g1', status: 'open', title: 'Deleting several elements in one call reports success without deleting', detail: 'The plural delete command returned success and nothing was removed.', workaround: 'Delete one at a time and check each is gone.', project_name: 'Patel', source_ref: 'build 8eb2a8b', proposed_by: 'blueprint', created_at: t(1400), closed_by: null, closed_by_email: null, closed_at: null, close_note: null },
    { id: 'g2', status: 'closed', title: 'A failed write reported success', detail: 'A rolled-back transaction came back as success.', workaround: 'Read every edit back.', project_name: null, source_ref: null, proposed_by: 'blueprint', created_at: t(5000), closed_by: 'user-mitch', closed_by_email: 'mitch@barnhaus.test', closed_at: t(350), close_note: 'Fixed in build f98f724' },
  ],
  // defaults are data: the built-in list, one line changed by Michael, one extra line turned off
  intent_defaults: [
    ...DEFAULTS.map((d, i) => ({ id: 'def-' + i, ...d, active: true, sort_order: (i + 1) * 10, updated_by: null, updated_by_email: null, updated_at: null, created_at: t(9000),
      ...(d.topic === 'counter material' ? { updated_by: 'user-michael', updated_by_email: 'michael@barnhaus.test', updated_at: t(700) } : {}) })),
    { id: 'def-off', topic: 'pot filler', value: 'none unless asked for', scope: 'house', active: false, sort_order: 900, updated_by: 'user-mitch', updated_by_email: 'mitch@barnhaus.test', updated_at: t(650), created_at: t(9000) },
  ],
  intent_defaults_history: [
    { id: 'dh1', default_id: 'def-' + DEFAULTS.findIndex((d) => d.topic === 'counter material'), topic: 'counter material', action: 'changed', old_value: 'Counter Top = Quartz', new_value: 'Counter Top = Marble 05', old_scope: 'house', new_scope: 'house', note: 'Marble on every job now', changed_by: 'user-michael', changed_by_email: 'michael@barnhaus.test', changed_at: t(700) },
    { id: 'dh2', default_id: 'def-off', topic: 'pot filler', action: 'turned_off', old_value: 'none unless asked for', new_value: 'none unless asked for', old_scope: 'house', new_scope: 'house', note: null, changed_by: 'user-mitch', changed_by_email: 'mitch@barnhaus.test', changed_at: t(650) },
  ],
  // lessons: Blueprint proposes, only the two approvers decide
  intent_approvers: [
    { user_id: 'user-mitch', email: 'mitch@barnhaus.test', name: 'Mitch', added_at: t(5000) },
    { user_id: 'user-michael', email: 'michael@barnhaus.test', name: 'Michael', added_at: t(5000) },
  ],
  intent_lessons: [
    lesson('l1', 'proposed', 'modeling', 'Read every edit back after a write batch', 'The bridge reported success on a transaction that Revit had rolled back, so a stair edit was reported as done when it was not.', 'After every write batch, read the changed elements back and compare before reporting done.', 400, { project_id: P.whi, project_name: 'Whitaker', source_ref: 'blueprint-michael 11-10 22:59Z' }),
    lesson('l2', 'proposed', 'app', 'Test screens with data shaped like the real pushes', 'Sample data had one decision line per topic; real board pushes store many, and a page scrolled sideways once live.', 'Before calling a screen done, shape the sample data from what the push tools actually write.', 300),
    lesson('l3', 'accepted', 'components', 'No built-in backsplash on any countertop', 'A stock counter family carried an integral 4 in splash.', 'Counter families are slab-only; backsplash is always its own element.', 3000, { accepted_rule: 'Countertops are slab-only. A backsplash is always its own element, only where the design calls for it.', decided_by: 'user-michael', decided_by_email: 'michael@barnhaus.test', decided_at: t(2800), accepted_at: t(2800), decision_note: 'Applies to every project' }),
    lesson('l4', 'dismissed', 'process', 'Ask before every save', '', 'Ask Mitch before saving the model.', 3200, { decided_by: 'user-mitch', decided_by_email: 'mitch@barnhaus.test', decided_at: t(3100), decision_note: 'No: Blueprint saves, I am not the save button' }),
    lesson('l5', 'retired', 'construction_docs', 'Schedules on the plan sheet', '', 'Put door and window schedules on the plan sheet.', 6000, { accepted_rule: 'Door and window schedules go on the plan sheet.', decided_by: 'user-mitch', decided_by_email: 'mitch@barnhaus.test', decided_at: t(1000), accepted_at: t(5900), decision_note: 'Schedules moved to their own sheet 11/10', source: 'person', proposed_by: 'michael@barnhaus.test' }),
  ],
}
fs.writeFileSync(out, JSON.stringify(db))
console.log('fixtures written', out, Object.keys(db).filter((k) => !k.startsWith('__')).map((k) => k.replace('intent_', '') + ':' + db[k].length).join(' '))
