// Exercises the server actions end to end: reads the real rendered form, posts it
// back the way a browser without JavaScript would, then inspects what the backend
// was told to change. node scripts/smoke/actions.mjs <appUrl> <mockUrl>
const [app, mock] = process.argv.slice(2)
const b64u = (s) => Buffer.from(s).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 86400 * 30
const user = { id: 'user-mitch', aud: 'authenticated', role: 'authenticated', email: 'mitch@barnhaus.test', app_metadata: {}, user_metadata: {} }
const jwt = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp, email: user.email })) + '.c2ln'
const cookie = 'sb-127-auth-token=base64-' + b64u(JSON.stringify({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'mock-refresh', user }))
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

let fails = 0
const ok = (name, cond, info = '') => {
  if (!cond) fails++
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + info))
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const getDb = async () => (await fetch(mock + '/__db')).json()
const setMode = (body) => fetch(mock + '/__mode', { method: 'POST', body: JSON.stringify(body) })
const page = async (path) => (await fetch(app + path, { headers: { cookie } })).text()

// the <form> whose markup satisfies pick(); returns its hidden inputs (Next's action reference + ours)
function form(html, pick, label) {
  const forms = html.match(/<form[\s\S]*?<\/form>/g) || []
  const hit = forms.filter(pick)
  if (hit.length !== 1) throw new Error(label + ': expected exactly one matching form, found ' + hit.length)
  const hidden = {}
  for (const tag of hit[0].match(/<input[^>]*type="hidden"[^>]*>/g) || []) {
    const name = /name="([^"]*)"/.exec(tag)
    const value = /value="([^"]*)"/.exec(tag)
    if (name) hidden[decode(name[1])] = value ? decode(value[1]) : ''
  }
  return hidden
}
async function post(path, hidden, fields = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...hidden, ...fields })) fd.append(k, v)
  const res = await fetch(app + path, { method: 'POST', body: fd, headers: { cookie, origin: app }, redirect: 'manual' })
  await res.arrayBuffer()
  return { status: res.status, location: decodeURIComponent(res.headers.get('location') || '') }
}

// ---------- A. rule editor ----------
let html = await page('/rulebook/checks?new=min_clearance')
let h = form(html, (f) => f.includes('name="primary"') && !f.includes('name="id"'), 'add-rule form')
let before = await getDb()
let r = await post('/rulebook/checks?new=min_clearance', h, {
  primary: 'Vanity', reference: 'wall, Toilet', min_in: '30', rooms_mode: 'named', room_names: 'Bath 2, Bath 3', section_codes: '',
  type_plan: 'on', description: 'Vanity needs 30" clear of walls and the toilet.',
})
let db = await getDb()
let added = db.intent_rules.find((x) => x.rule_key === 'vanity_needs_30_clear_of_walls_and_the_toilet')
ok('add rule: redirects to saved', r.status === 303 && r.location.includes('/rulebook/checks?saved=vanity_needs_30_clear_of_walls_and_the_toilet'), JSON.stringify(r))
ok('add rule: stored params', added && same(added.params, { between: [['vanity'], ['wall', 'toilet']], min_in: 30 }), JSON.stringify(added && added.params))
ok('add rule: stored scope', added && same(added.applies_to, { room_names: ['Bath 2', 'Bath 3'], outline_types: ['plan'] }), JSON.stringify(added && added.applies_to))
ok('add rule: active, type kept', added && added.active === true && added.rule_type === 'min_clearance')
ok('add rule: rulebook snapshot v3 with 9 active rules', db.intent_rulebook_versions.some((v) => v.version === 3 && v.snapshot.length === 9), JSON.stringify(db.intent_rulebook_versions.map((v) => [v.version, v.snapshot.length])))

// same description again -> key collision -> suffixed key, not an overwrite
r = await post('/rulebook/checks?new=min_clearance', h, { primary: 'vanity', reference: 'door', min_in: '30', rooms_mode: 'all', type_plan: 'on', description: 'Vanity needs 30" clear of walls and the toilet.' })
db = await getDb()
ok('add rule: duplicate name gets a suffix', r.location.includes('saved=vanity_needs_30_clear_of_walls_and_the_toilet_2') && db.intent_rules.filter((x) => x.rule_key.startsWith('vanity_needs_30')).length === 2, JSON.stringify(r))

// invalid: no drawing type
const countBefore = db.intent_rules.length
r = await post('/rulebook/checks?new=min_clearance', h, { primary: 'vanity', reference: 'door', min_in: '30', rooms_mode: 'all', description: 'x' })
db = await getDb()
ok('add rule: no drawing type -> refused, nothing saved', r.location.includes('error=') && r.location.includes('Pick at least one drawing type') && db.intent_rules.length === countBefore, JSON.stringify(r))

// edit the island rule: 42 -> 44, key and type untouched
const island = before.intent_rules.find((x) => x.rule_key === 'island_clearance_42')
html = await page('/rulebook/checks')
h = form(html, (f) => f.includes('value="' + island.id + '"') && f.includes('name="primary"'), 'edit island form')
r = await post('/rulebook/checks', h, {
  primary: 'island', reference: 'counter, appliance, fridge, range, tall_cabinet', min_in: '44', rooms_mode: 'named',
  room_names: 'Kitchen, Butler Pantry, Bar', section_codes: '', type_plan: 'on', description: 'Island needs 44" minimum clear.',
})
db = await getDb()
const island2 = db.intent_rules.find((x) => x.id === island.id)
ok('edit rule: number changed, key + type kept, version bumped', island2.params.min_in === 44 && island2.rule_key === 'island_clearance_42' && island2.rule_type === 'min_clearance' && island2.version === (island.version || 1) + 1, JSON.stringify(island2))
ok('edit rule: room list changed', same(island2.applies_to.room_names, ['Kitchen', 'Butler Pantry', 'Bar']))
ok('edit rule: still active', island2.active === true)

// turn an inactive rule on
h = form(html, (f) => f.includes('value="rule-off"') && f.includes('Turn on'), 'toggle form')
r = await post('/rulebook/checks', h)
db = await getDb()
ok('toggle: rule turned on', db.intent_rules.find((x) => x.id === 'rule-off').active === true && r.status === 303, JSON.stringify(r))

// ---------- B. approving drawings ----------
const W = '/projects/p-whitaker/rooms/r-wb3'
html = await page(W + '?view=2d')
const unreviewedForm = form(html, (f) => />\s*unreviewed\s*</.test(f), 'review-state "unreviewed" form') // kept for the guard test below
h = form(html, (f) => f.includes('name="override_reason"') && f.includes('value="o-plan"'), 'approve-anyway form')
r = await post(W, h, { override_reason: '   ' })
db = await getDb()
ok('approve failed rule without a reason: refused', r.location.includes('err2d=') && db.intent_outlines.find((o) => o.id === 'o-plan').status === 'pushed', JSON.stringify(r))
r = await post(W, h, { override_reason: 'Range is a 30 in slide-in, drawn at 36' })
db = await getDb()
let o = db.intent_outlines.find((x) => x.id === 'o-plan')
ok('approve failed rule with a reason: approved', o.status === 'approved' && o.approved_by === 'user-mitch')
ok('approve failed rule: reason + failed rule stored, checks kept', o.checks.override && o.checks.override.reason === 'Range is a 30 in slide-in, drawn at 36' && same(o.checks.override.failed_rules, ['island_clearance_42']) && o.checks.override.by === 'mitch@barnhaus.test' && o.checks.math.results.length === 3 && o.checks.vision.status === 'ok', JSON.stringify(o.checks.override))

html = await page('/projects/p-whitaker/rooms/r-wb2?view=2d')
h = form(html, (f) => f.includes('Approve this drawing'), 'plain approve form')
r = await post('/projects/p-whitaker/rooms/r-wb2', h)
db = await getDb()
o = db.intent_outlines.find((x) => x.id === 'o-gr')
ok('approve clean drawing: approved, no override recorded', o.status === 'approved' && !o.checks.override)

// ---------- C. room states ----------
html = await page(W + '?view=2d')
ok('room with everything reviewed offers 2D approval', html.includes('Mark room 2D approved'))
h = form(html, (f) => f.includes('Mark room 2D approved'), '2D approve form')
r = await post(W, h)
db = await getDb()
ok('mark 2D approved', db.intent_rooms.find((x) => x.id === 'r-wb3').review_state === '2d_approved')
r = await post(W, unreviewedForm) // an old tab still showing the three-state control
db = await getDb()
ok('old "unreviewed" button on a 2D-approved room: refused, approval kept', db.intent_rooms.find((x) => x.id === 'r-wb3').review_state === '2d_approved' && r.location.includes('err2d='), JSON.stringify(r))
html = await page(W)
h = form(html, (f) => f.includes('Reopen room'), 'reopen form')
r = await post(W, h)
db = await getDb()
ok('reopen: back to confirmed', db.intent_rooms.find((x) => x.id === 'r-wb3').review_state === 'confirmed')

// ---------- D. delete ----------
const D = '/projects/p-deubner'
html = await page(D)
h = form(html, (f) => f.includes('name="confirm_name"'), 'delete form')
r = await post(D, h, { confirm_name: 'deubner' })
db = await getDb()
ok('delete: wrong name -> nothing deleted', r.location.includes('delete_error=') && db.intent_projects.some((p) => p.id === 'p-deubner') && db.intent_rooms.filter((x) => x.project_id === 'p-deubner').length === 4, JSON.stringify(r))

await setMode({ fk: 'block' }) // database without cascade: project row cannot go first
const whitakerRooms = db.intent_rooms.filter((x) => x.project_id === 'p-whitaker').length
let callsBefore = (await (await fetch(mock + '/__calls')).json()).length
r = await post(D, h, { confirm_name: 'Deubner' })
db = await getDb()
let calls = (await (await fetch(mock + '/__calls')).json()).slice(callsBefore)
const left = Object.entries(db).filter(([, v]) => Array.isArray(v) && v.some((x) => x.project_id === 'p-deubner' || x.id === 'p-deubner')).map(([k]) => k)
ok('delete (no cascade): everything for the project is gone', left.length === 0 && r.location.startsWith('/projects?deleted=Deubner'), JSON.stringify({ left, r }))
ok('delete (no cascade): project first, then children in order, then project', same(calls.filter((c) => c.op.startsWith('delete')).map((c) => c.op + ':' + c.table.replace('intent_', '')), ['delete-rejected:projects', 'delete:outlines', 'delete:emissions', 'delete:inspo_images', 'delete:redline_notes', 'delete:open_questions', 'delete:decisions', 'delete:rooms', 'delete:projects']), JSON.stringify(calls.map((c) => c.op + ':' + (c.table || c.bucket))))
ok('delete: stored files removed after the rows', same(calls.filter((c) => c.op === 'storage.remove').map((c) => [c.bucket, c.prefixes.length]), [['intent-inspo', 3]]) && calls.findIndex((c) => c.op === 'storage.remove') > calls.findIndex((c) => c.op === 'delete' && c.table === 'intent_projects'), JSON.stringify(calls.filter((c) => c.op === 'storage.remove')))
ok('delete: other projects untouched', db.intent_rooms.filter((x) => x.project_id === 'p-whitaker').length === whitakerRooms && db.intent_projects.length === 4)
ok('delete: no leftover-files warning', !r.location.includes('files_left'))

await setMode({ fk: 'cascade', loseBucket: 'intent-outlines' }) // cascading database; storage refuses outline files
html = await page('/projects/p-schwan')
h = form(html, (f) => f.includes('name="confirm_name"'), 'delete form (schwan)')
callsBefore = (await (await fetch(mock + '/__calls')).json()).length
r = await post('/projects/p-schwan', h, { confirm_name: 'Schwan' })
db = await getDb()
calls = (await (await fetch(mock + '/__calls')).json()).slice(callsBefore)
ok('delete (cascade): one statement', same(calls.filter((c) => c.op.startsWith('delete')).map((c) => c.op + ':' + c.table), ['delete:intent_projects']) && !db.intent_rooms.some((x) => x.project_id === 'p-schwan'), JSON.stringify(calls.map((c) => c.op + ':' + (c.table || c.bucket))))
ok('delete: files that could not be removed are reported', r.location.includes('deleted=Schwan') && r.location.includes('files_left=1'), JSON.stringify(r))
html = await page('/projects?deleted=Schwan&files_left=1')
ok('delete: confirmation + leftover warning shown', html.includes('was deleted') && html.includes('could not be removed'))
ok('delete: deleted project page is a 404', (await fetch(app + '/projects/p-schwan', { headers: { cookie } })).status === 404)

const unknown = await (await fetch(mock + '/__unknown')).json()
ok('mock understood every request', unknown.length === 0, unknown.join(' ; '))
console.log(fails ? 'ACTIONS FAILED: ' + fails : 'ACTIONS PASS')
process.exit(fails ? 1 : 0)
