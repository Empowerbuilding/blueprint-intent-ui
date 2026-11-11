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

// ---------- C2. decision lines: one at a time ----------
const K = '/projects/p-deubner/rooms/r-d103'
const lineOf = (d, id) => d.intent_decisions.find((x) => x.id === id)
const activeIn = (d, topic) => d.intent_decisions.filter((x) => x.room_id === 'r-d103' && x.topic === topic && x.status === 'active').map((x) => x.id).sort()
html = await page(K + '?view=decide&edit=d8')
ok('line editor: only the chosen line has one', (html.match(/name="decision_id"/g) || []).length === 4 && html.includes('value="d8"'), String((html.match(/name="decision_id"/g) || []).length)) // d8 replace + d8 remove + 2 put-backs
const replaceForm = form(html, (f) => f.includes('value="d8"') && f.includes('name="value"'), 'replace-line form')
const removeFormD8 = form(html, (f) => f.includes('value="d8"') && f.includes('Remove this line'), 'remove-line form')
before = await getDb()
r = await post(K, replaceForm, { value: 'Trash pullout LEFT of the sink, double bin', source: 'manual', source_ref: '', meeting_date: '' })
db = await getDb()
const fresh = db.intent_decisions.find((x) => !before.intent_decisions.some((y) => y.id === x.id))
ok('replace one line: new line saved under the same topic', fresh && fresh.topic === 'general' && fresh.value === 'Trash pullout LEFT of the sink, double bin' && fresh.room_id === 'r-d103' && fresh.project_id === 'p-deubner' && (fresh.status || 'active') === 'active', JSON.stringify(fresh))
ok('replace one line: only that line is crossed out, pointing at its replacement', lineOf(db, 'd8').status === 'superseded' && lineOf(db, 'd8').superseded_by === fresh.id, JSON.stringify(lineOf(db, 'd8')))
ok('replace one line: the other lines of the topic are untouched', lineOf(db, 'd7').status === 'active' && lineOf(db, 'd9').status === 'active' && same(lineOf(db, 'd7'), lineOf(before, 'd7')) && same(lineOf(db, 'd9'), lineOf(before, 'd9')) && db.intent_decisions.length === before.intent_decisions.length + 1)
ok('replace one line: lands back on the new line', r.status === 303 && r.location.endsWith('?view=decide#d-' + fresh.id), JSON.stringify(r))
html = await page(K + '?view=decide')
ok('replace one line: old wording shown crossed out under the new one', html.includes('Trash pullout LEFT of the sink, double bin') && html.includes('Trash pullout at the sink, right side') && !html.includes('New wording for this line'))

// the same form again (an old tab): the line is no longer active -> refused, nothing added
before = await getDb()
r = await post(K, replaceForm, { value: 'Second attempt from an old tab' })
db = await getDb()
ok('replace a line that was already replaced: refused, nothing added', r.location.includes('err=') && r.location.includes('already changed or removed') && db.intent_decisions.length === before.intent_decisions.length, JSON.stringify(r))
r = await post(K, removeFormD8)
db = await getDb()
ok('remove a line that was already replaced: refused', r.location.includes('already changed or removed') && lineOf(db, 'd8').superseded_by === fresh.id, JSON.stringify(r))
ok('refusal is shown on the page', (await page(K + '?view=decide&err=' + encodeURIComponent('That line was already changed or removed. Nothing was changed.'))).includes('That line was already changed or removed.'))

// empty wording
html = await page(K + '?view=decide&edit=d9')
h = form(html, (f) => f.includes('value="d9"') && f.includes('name="value"'), 'replace-line form (d9)')
before = await getDb()
r = await post(K, h, { value: '   ' })
db = await getDb()
ok('replace with empty wording: refused, line kept', r.location.includes('err=') && lineOf(db, 'd9').status === 'active' && db.intent_decisions.length === before.intent_decisions.length, JSON.stringify(r))

// remove one line, then put it back
h = form(html, (f) => f.includes('value="d9"') && f.includes('Remove this line'), 'remove-line form (d9)')
r = await post(K, h)
db = await getDb()
ok('remove one line: crossed out with nothing in its place, time recorded', lineOf(db, 'd9').status === 'superseded' && lineOf(db, 'd9').superseded_by == null && !!lineOf(db, 'd9').status_changed_at && r.location.endsWith('?view=decide#d-d9'), JSON.stringify([lineOf(db, 'd9'), r]))
ok('remove one line: the rest of the topic is untouched, no row deleted', same(activeIn(db, 'general'), ['d7', fresh.id].sort()) && db.intent_decisions.length === before.intent_decisions.length)
html = await page(K + '?view=decide')
h = form(html, (f) => f.includes('value="d9"') && f.includes('Put back'), 'put-back form (d9)')
r = await post(K, h)
db = await getDb()
ok('put back: line is active again', lineOf(db, 'd9').status === 'active' && lineOf(db, 'd9').superseded_by == null && same(activeIn(db, 'general'), ['d7', 'd9', fresh.id].sort()), JSON.stringify(lineOf(db, 'd9')))
r = await post(K, h)
ok('put back twice: refused', r.location.includes('cannot be put back'), JSON.stringify(r))
// a replaced line cannot be put back (its replacement is the live wording)
r = await post(K, { ...h, decision_id: 'd8' })
db = await getDb()
ok('put back a replaced line: refused', r.location.includes('cannot be put back') && lineOf(db, 'd8').status === 'superseded', JSON.stringify(r))
// a line id from another project's room: refused
r = await post(K, { ...h, decision_id: 'd4' })
db = await getDb()
ok('line from another project: refused, untouched', r.location.includes('err=') && lineOf(db, 'd4').status === 'active', JSON.stringify(r))

// a topic whose only line was removed still lists it and offers to put it back
h = form(html, (f) => f.includes('value="d11"') && f.includes('Put back'), 'put-back form (d11)')
r = await post(K, h)
db = await getDb()
ok('put back the only line of an emptied topic', lineOf(db, 'd11').status === 'active')

// adding to a topic never replaces what is there
html = await page(K + '?view=decide')
h = form(html, (f) => f.includes('name="topic"') && f.includes('value="general"') && f.includes('Add line'), 'add-line form (general)')
before = await getDb()
r = await post(K, h, { value: 'Paper towel holder under the upper', source: 'manual' })
db = await getDb()
ok('add a line to a topic: added, nothing replaced', same(activeIn(db, 'general'), [...activeIn(before, 'general'), db.intent_decisions.find((x) => x.value === 'Paper towel holder under the upper').id].sort()) && db.intent_decisions.filter((x) => x.status === 'superseded').length === before.intent_decisions.filter((x) => x.status === 'superseded').length, JSON.stringify(activeIn(db, 'general')))
h = form(html, (f) => f.includes('placeholder="Topic (e.g. ceiling)"'), 'new-topic form')
r = await post(K, h, { topic: 'island', value: 'Outlet in the island end panel', source: 'manual' })
db = await getDb()
ok('new-topic form naming an existing topic: adds a line, the existing one stays', lineOf(db, 'd1').status === 'active' && activeIn(db, 'island').length === 2, JSON.stringify(activeIn(db, 'island')))

// removing a line after the contract was locked marks the contract out of date
ok('locked project starts in date', !(await page('/projects/p-schwan')).includes('out of date'))
html = await page('/projects/p-schwan/rooms/r-s1?view=decide&edit=d6')
h = form(html, (f) => f.includes('value="d6"') && f.includes('Remove this line'), 'remove-line form (schwan d6)')
r = await post('/projects/p-schwan/rooms/r-s1', h)
db = await getDb()
ok('remove after lock: line removed', lineOf(db, 'd6').status === 'superseded' && lineOf(db, 'd6').superseded_by == null)
ok('remove after lock: contract shows out of date', (await page('/projects/p-schwan')).includes('out of date'))

// ---------- C3. stored images are handed out as expiring signed links only ----------
let api = await (await fetch(app + '/api/outlines?project_id=p-whitaker', { headers: { cookie } })).json()
let urls = (api.rooms || []).flatMap((x) => x.outlines || []).map((o) => o.image_url).filter(Boolean)
ok('/api/outlines: image_url is a signed link, never a public one', urls.length > 0 && urls.every((x) => x.includes('/storage/v1/object/sign/intent-outlines/') && x.includes('token=')) , JSON.stringify(urls).slice(0, 300))
ok('/api/outlines: the signed link loads', (await fetch(urls[0])).status === 200)
ok('a public storage URL is refused', (await fetch(mock + '/storage/v1/object/public/intent-outlines/' + urls[0].split('/intent-outlines/')[1].split('?')[0])).status === 400)
await fetch(mock + '/__unknown?clear=1') // the line above asked for a public URL on purpose
await setMode({ denySign: true }) // storage refuses to sign: pages say so, and still carry no public URL
html = await page('/projects/p-deubner/images')
ok('images page when signing is refused: "image unavailable", no public URL', html.includes('image unavailable') && !html.includes('/object/public/') && !html.includes('/object/sign/'))
html = await page('/projects/p-whitaker/rooms/r-wb3?view=2d')
ok('room page when signing is refused: says the drawing could not be loaded, no public URL', html.includes('The drawing could not be loaded') && !html.includes('/object/public/'))
api = await (await fetch(app + '/api/outlines?project_id=p-whitaker', { headers: { cookie } })).json()
ok('/api/outlines when signing is refused: image_url is null', (api.rooms || []).flatMap((x) => x.outlines || []).every((o) => o.image_url === null))
await setMode({ denySign: false })

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
