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
let r2
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
// a rule change re-checks the drawings that are still awaiting review, and tells Blueprint
const outl = (d, id) => d.intent_outlines.find((x) => x.id === id)
ok('rule change: both drawings awaiting review were measured again against v3', r.location.includes('&rechecked=2') && outl(db, 'o-plan').checks.math.rulebook_version === 3 && outl(db, 'o-gr').checks.math.rulebook_version === 3 && outl(db, 'o-plan').checks.math.ran_at > outl(before, 'o-plan').checks.math.ran_at, JSON.stringify([r.location, outl(db, 'o-plan').checks.math.rulebook_version]))
ok('rule change: the decision check results on those drawings are kept', same(outl(db, 'o-plan').checks.vision, outl(before, 'o-plan').checks.vision) && outl(db, 'o-gr').checks.vision.status === 'running')
ok('rule change: approved, rejected and replaced drawings are not rewritten', ['o-elev', 'o-sec', 'o-old', 'o-ms', 'o-s1'].every((id) => same(outl(db, id), outl(before, id))))
let wake = db.portal_messages[db.portal_messages.length - 1]
ok('rule change: Blueprint is told what changed', db.portal_messages.length === 1 && wake.channel_id === 'blueprint-mitch' && wake.sender_name === 'WorkOrderUI' && wake.content.includes('Rulebook changed → v3') && wake.content.includes('vanity_needs_30_clear_of_walls_and_the_toilet') && wake.content.includes('added by mitch@barnhaus.test') && wake.content.includes('Re-checked 2 drawings awaiting review; no result changed.') && wake.content.includes('not a go') && r.location.includes('told=1'), JSON.stringify(wake))
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

// turning a rule off / on changes a waiting drawing's result: counted, written, reported
h = form(html, (f) => f.includes('value="' + island.id + '"') && f.includes('Turn off'), 'toggle island off')
r = await post('/rulebook/checks', h)
db = await getDb()
wake = db.portal_messages[db.portal_messages.length - 1]
ok('rule turned off: the waiting kitchen plan no longer fails, and that is reported', r.location.includes('&changed=1') && !outl(db, 'o-plan').checks.math.results.some((x) => x.status === 'fail') && wake.content.includes('island_clearance_42') && wake.content.includes('turned off') && wake.content.includes('1 changed result:') && /Whitaker · B3 Kitchen \(plan "Zone map"\): now (passes|nothing measured)/.test(wake.content), JSON.stringify([r.location, wake.content]))
html = await page('/rulebook/checks')
h = form(html, (f) => f.includes('value="' + island.id + '"') && f.includes('Turn on'), 'toggle island on')
r = await post('/rulebook/checks', h)
db = await getDb()
wake = db.portal_messages[db.portal_messages.length - 1]
ok('rule turned back on: the plan fails again, and that is reported', r.location.includes('&changed=1') && outl(db, 'o-plan').checks.math.results.some((x) => x.rule_key === 'island_clearance_42' && x.status === 'fail') && wake.content.includes('turned on') && wake.content.includes('now fails — island_clearance_42'), JSON.stringify([r.location, wake.content]))
// a new rule that an APPROVED drawing would fail: the drawing stays approved and untouched, and is reported
html = await page('/rulebook/checks?new=min_clearance')
h = form(html, (f) => f.includes('name="primary"') && !f.includes('name="id"'), 'add-rule form (suite)')
before = await getDb()
r = await post('/rulebook/checks?new=min_clearance', h, { primary: 'island', reference: 'counter', min_in: '40', rooms_mode: 'named', room_names: 'Master Suite', section_codes: '', type_plan: 'on', description: 'Suite island needs 40 in clear.' })
db = await getDb()
wake = db.portal_messages[db.portal_messages.length - 1]
ok('new rule an approved drawing would fail: it stays approved and unchanged, and is reported', r.location.includes('&approved=1') && same(outl(db, 'o-ms'), outl(before, 'o-ms')) && outl(db, 'o-ms').status === 'approved' && wake.content.includes('Approved drawings that would fail the new rulebook (left approved, not rewritten):') && wake.content.includes('Whitaker · B5 Master Suite (plan "Zone map"): now fails — suite_island_needs_40_in_clear') && !wake.content.includes('Schwan'), JSON.stringify([r.location, wake.content]))
ok('saved banner after a real save', (await page(r.location)).replace(/<!-- -->/g, '').includes('1 approved drawing would fail the new rulebook; it stays approved'))

// times are shown in the viewer's time zone (cookie "tz"), Central until the browser has reported it
const tzPage = async (tz) => (await (await fetch(app + '/blueprint', { headers: { cookie: cookie + (tz ? '; tz=' + encodeURIComponent(tz) : '') } })).text()).replace(/<!-- -->/g, '')
let feed = await tzPage('')
ok('times: Central by default', /\d{1,2}:\d{2} [AP]M (CST|CDT)/.test(feed) && !/GMT\+9|UTC/.test(feed), (feed.match(/\d{1,2}:\d{2} [AP]M \S+/) || [''])[0])
feed = await tzPage('Asia/Tokyo')
ok('times: the viewer\'s zone when the browser has reported it', /\d{1,2}:\d{2} [AP]M GMT\+9/.test(feed) && !/ (CST|CDT)/.test(feed), (feed.match(/\d{1,2}:\d{2} [AP]M \S+/) || [''])[0])
feed = await tzPage('Not/AZone')
ok('times: a bad zone value falls back to Central', /\d{1,2}:\d{2} [AP]M (CST|CDT)/.test(feed))
ok('times: the page reports the zone it used, so the browser can correct it', (await tzPage('America/Denver')).includes('America/Denver'))

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
ok('approve failed rule: reason + failed rule stored, checks kept', o.checks.override && o.checks.override.reason === 'Range is a 30 in slide-in, drawn at 36' && same(o.checks.override.failed_rules, ['island_clearance_42']) && o.checks.override.by === 'mitch@barnhaus.test' && o.checks.math.results.some((x) => x.rule_key === 'island_clearance_42' && x.status === 'fail') && o.checks.vision.status === 'ok' && o.checks.vision.results.length === 5, JSON.stringify(o.checks.override))

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
ok('line editor: only the chosen line has one', (html.match(/name="decision_id"/g) || []).length === 5 && html.includes('value="d8"'), String((html.match(/name="decision_id"/g) || []).length)) // d8 kind + d8 replace + d8 remove + 2 put-backs
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

// ---------- C4. lessons: Blueprint proposes, only Mitch or Michael decide ----------
const cookieFor = (id, email) => {
  const u = { ...user, id, email }
  const t = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated', exp, email })) + '.c2ln'
  return 'sb-127-auth-token=base64-' + b64u(JSON.stringify({ access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'mock-refresh', user: u }))
}
const asBlueprint = cookieFor('user-blueprint', 'blueprint@barnhaus.test')
// React puts <!-- --> between pieces of text; strip them so sentences can be matched
const pageAs = async (path, c) => (await (await fetch(app + path, { headers: { cookie: c } })).text()).replace(/<!-- -->/g, '')
const postAs = async (path, hidden, fields, c) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...hidden, ...fields })) fd.append(k, v)
  const res = await fetch(app + path, { method: 'POST', body: fd, headers: { cookie: c, origin: app }, redirect: 'manual' })
  await res.arrayBuffer()
  return { status: res.status, location: decodeURIComponent(res.headers.get('location') || '') }
}
const L = '/blueprint/lessons'
const lessonOf = (d, id) => d.intent_lessons.find((x) => x.id === id)
const SECRET = { 'x-prefill-secret': 'smoke-secret', 'Content-Type': 'application/json' }

// machine route: propose only
let res = await fetch(app + '/api/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'x', proposed_rule: 'y' }) })
ok('api propose without the secret: 401', res.status === 401)
res = await fetch(app + '/api/lessons', { method: 'POST', headers: SECRET, body: JSON.stringify({ title: 'Save after every verified phase', what_happened: 'A crash lost an unsaved pad.', proposed_rule: 'Save in the same script, right after verification.', kind: 'modeling', project: 'Whitaker', source_ref: 'test' }) })
let made = await res.json()
db = await getDb()
let row = lessonOf(db, made.id)
ok('api propose: stored as proposed, by blueprint, project resolved', res.status === 201 && made.status === 'proposed' && row && row.status === 'proposed' && row.proposed_by === 'blueprint' && row.source === 'blueprint' && row.project_id === 'p-whitaker' && row.project_name === 'Whitaker' && row.kind === 'modeling' && !row.accepted_rule && !row.decided_at, JSON.stringify(row))
res = await fetch(app + '/api/lessons', { method: 'POST', headers: SECRET, body: JSON.stringify({ title: 'save after every VERIFIED phase', proposed_rule: 'again' }) })
let dup = await res.json()
ok('api propose the same title again: not added twice', res.status === 200 && dup.duplicate === true && dup.id === made.id && (await getDb()).intent_lessons.length === db.intent_lessons.length, JSON.stringify(dup))
for (const bad of [{ status: 'accepted' }, { accepted_rule: 'self-approved' }, { decided_by_email: 'mitch@barnhaus.test' }]) {
  res = await fetch(app + '/api/lessons', { method: 'POST', headers: SECRET, body: JSON.stringify({ title: 'Sneak ' + Object.keys(bad)[0], proposed_rule: 'r', ...bad }) })
  ok('api cannot accept its own lesson (' + Object.keys(bad)[0] + '): refused, nothing stored', res.status === 400 && !(await getDb()).intent_lessons.some((x) => x.title.startsWith('Sneak')), String(res.status))
}
res = await fetch(app + '/api/lessons', { method: 'POST', headers: SECRET, body: JSON.stringify({ title: 'No rule' }) })
ok('api propose without a rule: refused', res.status === 400)
for (const m of ['PATCH', 'PUT', 'DELETE']) {
  res = await fetch(app + '/api/lessons', { method: m, headers: SECRET, body: JSON.stringify({ id: 'l1', status: 'accepted' }) })
  ok('api has no ' + m + ' (no machine way to decide a lesson)', res.status === 405, String(res.status))
}
api = await (await fetch(app + '/api/lessons', { headers: SECRET })).json()
ok('api read: accepted lessons only by default, with the accepted wording', api.lessons.length === 1 && api.lessons[0].id === 'l3' && api.lessons[0].rule.startsWith('Countertops are slab-only') && api.counts.proposed === 3 && same(api.approvers, ['Michael', 'Mitch']), JSON.stringify(api).slice(0, 400))
api = await (await fetch(app + '/api/lessons?status=proposed', { headers: SECRET })).json()
ok('api read ?status=proposed', api.lessons.length === 3 && api.lessons.every((x) => x.status === 'proposed'))
ok('api read without secret or login: 401', (await fetch(app + '/api/lessons')).status === 401)

// a signed-in account that is not an approver (Blueprint's own login): sees the list, gets no decision forms
html = await pageAs(L, asBlueprint)
ok('non-approver: page lists the lessons, read-only', html.includes('Read every edit back after a write batch') && html.includes('read-only for decisions') && html.includes('Waiting on Mitch or Michael'))
ok('non-approver: no accept / dismiss / retire forms', !html.includes('name="accepted_rule"') && !html.includes('Retire this lesson') && (html.match(/name="lesson_id"/g) || []).length === 0)
html = await pageAs('/', asBlueprint)
ok('non-approver inbox: lessons shown as waiting on Mitch or Michael', html.includes('Lessons to accept (3)') && html.includes('They wait on Mitch or Michael') && !html.includes('Review lessons'))
// ...and posting the approver's own form as that account is refused
html = await page(L)
const acceptL1 = form(html, (f) => f.includes('value="l1"') && f.includes('name="accepted_rule"'), 'accept form l1')
const dismissL2 = form(html, (f) => f.includes('value="l2"') && f.includes('Dismiss'), 'dismiss form l2')
const retireL3 = form(html, (f) => f.includes('value="l3"') && f.includes('Retire this lesson'), 'retire form l3')
before = await getDb()
r = await postAs(L, acceptL1, { accepted_rule: 'self-approved' }, asBlueprint)
db = await getDb()
ok('non-approver posts the accept form: refused, lesson untouched', r.location.includes('Only Mitch or Michael can accept a lesson') && same(lessonOf(db, 'l1'), lessonOf(before, 'l1')), JSON.stringify(r))
r = await postAs(L, dismissL2, { decision_note: 'no' }, asBlueprint)
r2 = await postAs(L, retireL3, { decision_note: 'no' }, asBlueprint)
db = await getDb()
ok('non-approver posts dismiss / retire: refused, lessons untouched', r.location.includes('can dismiss a lesson') && r2.location.includes('can retire a lesson') && same(lessonOf(db, 'l2'), lessonOf(before, 'l2')) && same(lessonOf(db, 'l3'), lessonOf(before, 'l3')), JSON.stringify([r, r2]))
ok('refusal is shown on the page', (await page(L + '?err=' + encodeURIComponent('Only Mitch or Michael can accept a lesson. Nothing was changed.'))).includes('Only Mitch or Michael can accept a lesson.'))

// an approver (Mitch) decides
r = await post(L, acceptL1, { accepted_rule: '   ', decision_note: '' })
db = await getDb()
ok('accept with empty wording: refused', r.location.includes('wording was empty') && lessonOf(db, 'l1').status === 'proposed', JSON.stringify(r))
r = await post(L, acceptL1, { accepted_rule: 'Read back every changed element after each write batch, before saying it is done.', decision_note: 'Yes' })
db = await getDb()
row = lessonOf(db, 'l1')
ok('approver accepts with reworded rule: stored with who and when', row.status === 'accepted' && row.accepted_rule.startsWith('Read back every changed element') && row.proposed_rule.startsWith('After every write batch') && row.decided_by === 'user-mitch' && row.decided_by_email === 'mitch@barnhaus.test' && !!row.decided_at && row.accepted_at === row.decided_at && row.decision_note === 'Yes' && r.location.endsWith(L + '#l-l1'), JSON.stringify([row, r]))
r = await post(L, acceptL1, { accepted_rule: 'again' })
ok('accept a lesson that is already decided: refused', r.location.includes('already decided') && lessonOf(await getDb(), 'l1').accepted_rule.startsWith('Read back every'), JSON.stringify(r))
r = await post(L, dismissL2, { decision_note: '  ' })
ok('dismiss without a reason: refused', r.location.includes('Say why') && lessonOf(await getDb(), 'l2').status === 'proposed', JSON.stringify(r))
r = await post(L, dismissL2, { decision_note: 'Covered by the smoke harness now' })
row = lessonOf(await getDb(), 'l2')
ok('approver dismisses with a reason', row.status === 'dismissed' && row.decision_note === 'Covered by the smoke harness now' && row.decided_by_email === 'mitch@barnhaus.test' && !row.accepted_rule && !row.accepted_at, JSON.stringify(row))
r = await post(L, retireL3, { decision_note: '' })
ok('retire without a reason: refused', r.location.includes('Say why') && lessonOf(await getDb(), 'l3').status === 'accepted')
const acceptedAt = lessonOf(await getDb(), 'l3').accepted_at
r = await post(L, retireL3, { decision_note: 'Superseded by the new counter family' })
row = lessonOf(await getDb(), 'l3')
ok('approver retires an accepted lesson: kept on record with when it was accepted', row.status === 'retired' && row.accepted_at === acceptedAt && row.decided_by_email === 'mitch@barnhaus.test' && row.accepted_rule.startsWith('Countertops are slab-only'), JSON.stringify(row))
api = await (await fetch(app + '/api/lessons', { headers: SECRET })).json()
ok('api read after the decisions: only the lesson accepted just now', api.lessons.length === 1 && api.lessons[0].id === 'l1' && api.lessons[0].rule.startsWith('Read back every changed element') && api.lessons[0].decided_by === 'mitch@barnhaus.test', JSON.stringify(api.lessons).slice(0, 300))

// a person adds a lesson: it is only proposed, even when the person is an approver
h = form(html, (f) => f.includes('name="proposed_rule"') && f.includes('name="title"'), 'add-lesson form')
before = await getDb()
r = await post(L, h, { title: 'Dimension to face of stud', what_happened: '', proposed_rule: 'Plan dimensions go to face of stud, not finish.', kind: 'construction_docs' })
db = await getDb()
row = db.intent_lessons.find((x) => !before.intent_lessons.some((y) => y.id === x.id))
ok('person adds a lesson: proposed, not accepted', row && row.status === 'proposed' && row.source === 'person' && row.proposed_by === 'mitch@barnhaus.test' && row.kind === 'construction_docs' && !row.accepted_rule && !row.decided_at, JSON.stringify(row))
r = await post(L, h, { title: '', proposed_rule: '' })
ok('add a lesson with nothing in it: refused', r.location.includes('needs a one-line title') && (await getDb()).intent_lessons.length === db.intent_lessons.length)
ok('lessons are never deleted', !(await (await fetch(mock + '/__calls')).json()).some((c) => c.op.startsWith('delete') && c.table === 'intent_lessons'))

// ---------- C5. defaults: data that only Mitch or Michael change ----------
const DF = '/rulebook/defaults'
const defOf = (d, id) => d.intent_defaults.find((x) => x.id === id)
const lastChange = (d) => d.intent_defaults_history[d.intent_defaults_history.length - 1]
const roomDefaults = async () => (await page('/projects/p-whitaker/rooms/r-wb3?view=decide')).replace(/<!-- -->/g, '')
ok('room shows the default from the saved list', (await roomDefaults()).includes('built in'))
// read-only for a signed-in account that is not an approver
html = await pageAs(DF, asBlueprint)
ok('defaults, non-approver: list shown, read-only', html.includes('spice pullouts both sides of range') && html.includes('Only Mitch or Michael can change this list') && !html.includes('name="default_id"') && !html.includes('+ Add a default') && !html.includes('>Change<'))
html = await pageAs(DF + '?edit=def-3', asBlueprint)
ok('defaults, non-approver: the edit address shows no editor either', !html.includes('Save default') && !html.includes('name="default_id"'))
html = await page(DF + '?edit=def-3')
const saveFridge = form(html, (f) => f.includes('value="def-3"') && f.includes('name="value"'), 'save default (fridge)')
const offFridge = form(html, (f) => f.includes('value="def-3"') && f.includes('Turn this default off'), 'turn off default (fridge)')
const addDef = form(html, (f) => f.includes('name="topic"') && f.includes('Add default'), 'add default')
before = await getDb()
r = await postAs(DF, saveFridge, { value: 'self-approved', scope: 'house', note: '' }, asBlueprint)
r2 = await postAs(DF, offFridge, {}, asBlueprint)
let r3 = await postAs(DF, addDef, { topic: 'sneak', value: 'x', scope: 'house', note: '' }, asBlueprint)
db = await getDb()
ok('defaults, non-approver posts change / turn off / add: all refused, nothing changed', [r, r2, r3].every((x) => x.location.includes('Only Mitch or Michael can change a default')) && same(db.intent_defaults, before.intent_defaults) && same(db.intent_defaults_history, before.intent_defaults_history), JSON.stringify([r, r2, r3]))
// an approver changes one
const msgs = db.portal_messages.length
r = await post(DF, saveFridge, { value: '   ', scope: 'house', note: '' })
ok('default with empty value: refused', r.location.includes('was empty') && defOf(await getDb(), 'def-3').value === 'built in', JSON.stringify(r))
r = await post(DF, saveFridge, { value: 'built in', scope: 'house', note: '' })
ok('default saved with nothing different: refused, no history', r.location.includes('Nothing was different') && (await getDb()).intent_defaults_history.length === before.intent_defaults_history.length, JSON.stringify(r))
r = await post(DF, saveFridge, { value: 'panel-ready, built in', scope: 'house', note: 'Per Mitch 11/11' })
db = await getDb()
ok('approver changes a default: stored with who and when', defOf(db, 'def-3').value === 'panel-ready, built in' && defOf(db, 'def-3').updated_by_email === 'mitch@barnhaus.test' && !!defOf(db, 'def-3').updated_at && r.location.includes('saved=fridge') && r.location.endsWith('#d-def-3'), JSON.stringify([defOf(db, 'def-3'), r]))
ok('approver changes a default: the change is kept (was / now / who / why)', same([lastChange(db).action, lastChange(db).topic, lastChange(db).old_value, lastChange(db).new_value, lastChange(db).changed_by_email, lastChange(db).note], ['changed', 'fridge', 'built in', 'panel-ready, built in', 'mitch@barnhaus.test', 'Per Mitch 11/11']) && db.intent_defaults_history.length === before.intent_defaults_history.length + 1, JSON.stringify(lastChange(db)))
wake = db.portal_messages[db.portal_messages.length - 1]
ok('approver changes a default: Blueprint is told', db.portal_messages.length === msgs + 1 && wake.content.includes('Default changed: **fridge**') && wake.content.includes('was "built in"') && wake.content.includes('now "panel-ready, built in"') && wake.content.includes('mitch@barnhaus.test') && wake.content.includes('not a go'), JSON.stringify(wake))
ok('room now shows the changed default', (await roomDefaults()).includes('panel-ready, built in'))
ok('other defaults untouched', db.intent_defaults.filter((x) => x.id !== 'def-3').every((x) => same(x, defOf(before, x.id))))
// machine read
api = await (await fetch(app + '/api/defaults', { headers: SECRET })).json()
ok('api defaults: the list in force, with the change', api.defaults.length === 28 && api.defaults.find((x) => x.topic === 'fridge').value === 'panel-ready, built in' && same(api.turned_off, ['pot filler']) && api.source === 'app' && !!api.updated_at, JSON.stringify(api).slice(0, 300))
ok('api defaults: 401 without the secret or a login', (await fetch(app + '/api/defaults')).status === 401)
ok('api defaults: read only (no POST)', (await fetch(app + '/api/defaults', { method: 'POST', headers: SECRET, body: '{}' })).status === 405)
// turn off, then back on
r = await post(DF, offFridge, {})
db = await getDb()
ok('turn a default off: kept, marked off, recorded', defOf(db, 'def-3').active === false && lastChange(db).action === 'turned_off' && db.intent_defaults.length === before.intent_defaults.length, JSON.stringify(defOf(db, 'def-3')))
html = await roomDefaults()
ok('room no longer builds that default', !html.includes('panel-ready, built in'))
api = await (await fetch(app + '/api/defaults', { headers: SECRET })).json()
ok('api defaults: turned-off default is not in force', api.defaults.length === 27 && api.turned_off.includes('fridge'))
html = await page(DF)
h = form(html, (f) => f.includes('value="def-3"') && f.includes('Turn back on'), 'turn default back on')
r = await post(DF, h, {})
db = await getDb()
ok('turn it back on', defOf(db, 'def-3').active === true && lastChange(db).action === 'turned_on' && (await roomDefaults()).includes('panel-ready, built in'))
// add one
r = await post(DF, addDef, { topic: 'Hood', value: 'steel', scope: 'house', note: '' })
ok('add a default whose topic already exists (any capitals): refused', r.location.includes('already a default for "hood"') && (await getDb()).intent_defaults.length === before.intent_defaults.length, JSON.stringify(r))
r = await post(DF, addDef, { topic: 'pantry shelving', value: 'adjustable melamine, 16 in deep', scope: 'nowhere', note: '' })
ok('add a default with a bad scope: refused', r.location.includes('Pick where the default applies') && (await getDb()).intent_defaults.length === before.intent_defaults.length)
r = await post(DF, addDef, { topic: 'pantry shelving', value: 'adjustable melamine, 16 in deep', scope: 'house', note: 'Standard on every job' })
db = await getDb()
row = db.intent_defaults.find((x) => x.topic === 'pantry shelving')
ok('approver adds a default: stored last in the list, recorded, shown in rooms', row && row.active === true && row.scope === 'house' && row.sort_order > 900 && row.updated_by_email === 'mitch@barnhaus.test' && lastChange(db).action === 'added' && lastChange(db).default_id === row.id && (await roomDefaults()).includes('adjustable melamine, 16 in deep'), JSON.stringify(row))
ok('defaults and their history are never deleted', !(await (await fetch(mock + '/__calls')).json()).some((c) => c.op.startsWith('delete') && (c.table === 'intent_defaults' || c.table === 'intent_defaults_history')))

// ---------- C6. capabilities: reported by Blueprint, gaps closed only by Mitch or Michael ----------
const CP = '/blueprint/capabilities'
const capPost = async (b, headers = SECRET) => { const x = await fetch(app + '/api/capabilities', { method: 'POST', headers, body: JSON.stringify(b) }); return { status: x.status, j: await x.json().catch(() => null) } }
const michaelCmds = ['revit.create_wall', 'revit.delete_element', 'revit.get_elements_info', 'revit.save_document', 'revit.set_parameter_value']
ok('capabilities report without the secret: 401', (await capPost({ machine: 'michael', bridge_build: 'x', commands: michaelCmds }, { 'Content-Type': 'application/json' })).status === 401)
for (const [why, b] of [['no machine', { bridge_build: 'x', commands: michaelCmds }], ['bad machine name', { machine: 'Mitch PC', bridge_build: 'x', commands: michaelCmds }], ['no build', { machine: 'michael', commands: michaelCmds }], ['no commands', { machine: 'michael', bridge_build: 'x', commands: [] }], ['a command that is not a name', { machine: 'michael', bridge_build: 'x', commands: ['revit.ok', 'DROP TABLE'] }], ['proven command not in the report', { machine: 'michael', bridge_build: 'x', commands: michaelCmds, proven: [{ command: 'revit.create_family_box' }] }]]) {
  before = await getDb()
  r = await capPost(b)
  db = await getDb()
  ok('capabilities report refused: ' + why, r.status === 400 && same(db.intent_bridge_reports, before.intent_bridge_reports) && same(db.intent_bridge_proven, before.intent_bridge_proven), JSON.stringify(r))
}
// the same build and commands again: only "last confirmed" moves
before = await getDb()
r = await capPost({ machine: 'michael', bridge_build: '8eb2a8b', revit_version: '2025', commands: michaelCmds })
db = await getDb()
ok('same report again: no new row, last-confirmed time moves', r.status === 200 && r.j.new_build === false && same(r.j.added, []) && same(r.j.removed, []) && db.intent_bridge_reports.length === before.intent_bridge_reports.length && db.intent_bridge_reports.find((x) => x.id === 'br1').reported_at > before.intent_bridge_reports.find((x) => x.id === 'br1').reported_at && db.intent_bridge_reports.find((x) => x.id === 'br1').first_reported_at === before.intent_bridge_reports.find((x) => x.id === 'br1').first_reported_at, JSON.stringify(r))
// Michael updates his bridge: new build, two new commands, one proven
r = await capPost({ machine: 'Michael', bridge_build: 'f98f724', revit_version: '2025', commands: [...michaelCmds.map((name) => ({ name })), { name: 'revit.rehost_element', description: 'Move a hosted element to a new host.' }, 'revit.create_family_box', 'revit.create_wall', 'revit.boolean_union', 'revit.create_text_type'], proven: [{ command: 'revit.rehost_element', note: 'Patel fire pit chairs, host read back' }, { command: 'revit.save_document', note: 'again' }] })
db = await getDb()
row = db.intent_bridge_reports.filter((x) => x.machine === 'michael').sort((a, b) => (a.reported_at < b.reported_at ? 1 : -1))[0]
ok('new build reported: a new row, history kept, what changed returned', r.status === 200 && r.j.new_build === true && r.j.previous_build === '8eb2a8b' && same(r.j.added, ['revit.boolean_union', 'revit.create_family_box', 'revit.create_text_type', 'revit.rehost_element']) && same(r.j.removed, []) && db.intent_bridge_reports.length === before.intent_bridge_reports.length + 1 && row.bridge_build === 'f98f724' && row.commands.length === 9 && row.commands.find((c) => c.name === 'revit.rehost_element').description === 'Move a hosted element to a new host.' && !!db.intent_bridge_reports.find((x) => x.id === 'br1'), JSON.stringify(r))
ok('proven: new proof stored with machine and build; an earlier proof is not overwritten', r.j.proven_added === 1 && db.intent_bridge_proven.find((x) => x.command === 'revit.rehost_element').bridge_build === 'f98f724' && db.intent_bridge_proven.find((x) => x.command === 'revit.rehost_element').machine === 'michael' && db.intent_bridge_proven.find((x) => x.command === 'revit.save_document').note === 'Deubner D2, saved and reopened', JSON.stringify(db.intent_bridge_proven))
html = (await page(CP)).replace(/<!-- -->/g, '')
ok('page after the update: same build on both machines, no mismatch warning', html.includes('Every machine is on the same build with the same commands.') && !html.includes('different bridge builds') && html.includes('before that: 8eb2a8b') && html.includes('Patel fire pit chairs, host read back'))
api = await (await fetch(app + '/api/capabilities', { headers: SECRET })).json()
ok('capabilities read: latest per machine, proven, open gaps', api.machines.length === 2 && api.machines.every((m) => m.bridge_build === 'f98f724' && m.commands.length === 9) && api.proven.length === 3 && api.gaps_open.length === 1 && api.gaps_open[0].title.startsWith('Deleting several elements'), JSON.stringify(api).slice(0, 300))
ok('capabilities read: the commands that do not act come with their mark and its wording', api.marked.length === 3 && api.marked.find((m) => m.command === 'revit.boolean_union').label === 'stub: returns success, no effect' && api.marked.filter((m) => m.mark === 'disabled').every((m) => m.label === 'listed, dispatch disabled' && m.bridge_build === 'f98f724'), JSON.stringify(api.marked))
ok('page: a marked command shows its mark on every machine that lists it', html.includes('2 commands on the list do not act') && html.includes('stub: returns success, no effect') && html.includes('listed, dispatch disabled') && !html.includes('get_render_settings'))
ok('marks are not written by any request', same((await getDb()).intent_bridge_command_marks, before.intent_bridge_command_marks))
ok('capabilities read without secret or login: 401', (await fetch(app + '/api/capabilities')).status === 401)
// gaps through the machine route: add only
const gapPost = async (b) => { const x = await fetch(app + '/api/gaps', { method: 'POST', headers: SECRET, body: JSON.stringify(b) }); return { status: x.status, j: await x.json().catch(() => null) } }
ok('gap without the secret: 401', (await fetch(app + '/api/gaps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 401)
r = await gapPost({ title: 'Soffits need one drawn by hand first', detail: 'A soffit can only be created by copying one that already exists in the model.', workaround: 'Ask for one soffit drawn in Revit, then copy it.', project: 'Whitaker', source_ref: 'test' })
db = await getDb()
row = db.intent_gaps.find((x) => x.id === r.j.id)
ok('gap logged by Blueprint: stored open', r.status === 201 && row && row.status === 'open' && row.proposed_by === 'blueprint' && row.project_name === 'Whitaker' && row.workaround.startsWith('Ask for one soffit') && !row.closed_at, JSON.stringify(row))
r2 = await gapPost({ title: 'soffits need one drawn by hand FIRST', detail: 'again' })
ok('same gap again: not added twice', r2.status === 200 && r2.j.duplicate === true && r2.j.id === r.j.id && (await getDb()).intent_gaps.length === db.intent_gaps.length)
r2 = await gapPost({ title: 'Self-closed', detail: 'x', status: 'closed', close_note: 'fixed' })
ok('gap sent as already closed: refused', r2.status === 400 && !(await getDb()).intent_gaps.some((x) => x.title === 'Self-closed'))
ok('gap without detail: refused', (await gapPost({ title: 'No detail' })).status === 400)
ok('no machine way to close a gap', (await fetch(app + '/api/gaps', { method: 'PATCH', headers: SECRET, body: JSON.stringify({ id: 'g1', status: 'closed' }) })).status === 405)
// non-approver: read-only for closing
html = await pageAs(CP, asBlueprint)
ok('capabilities, non-approver: sees machines and gaps, no close or reopen controls', html.includes('f98f724') && html.includes('Deleting several elements') && !html.includes('name="gap_id"') && !html.includes('Close gap') && html.includes('+ Add a gap yourself'))
html = await page(CP)
const closeG1 = form(html, (f) => f.includes('value="g1"') && f.includes('Close gap'), 'close gap g1')
const reopenG2 = form(html, (f) => f.includes('value="g2"') && f.includes('Reopen'), 'reopen gap g2')
const addGapForm = form(html, (f) => f.includes('name="detail"') && f.includes('Add gap'), 'add gap')
before = await getDb()
r = await postAs(CP, closeG1, { close_note: 'self-closed' }, asBlueprint)
r2 = await postAs(CP, reopenG2, {}, asBlueprint)
db = await getDb()
ok('non-approver posts close / reopen: refused, gaps untouched', r.location.includes('Only Mitch or Michael can close a gap') && r2.location.includes('Only Mitch or Michael can reopen a gap') && same(db.intent_gaps, before.intent_gaps), JSON.stringify([r, r2]))
r = await postAs(CP, addGapForm, { title: 'Cannot place railings', detail: 'No railing command exists.', workaround: '' }, asBlueprint)
db = await getDb()
row = db.intent_gaps.find((x) => x.title === 'Cannot place railings')
ok('anyone signed in can add a gap', row && row.status === 'open' && row.proposed_by === 'blueprint@barnhaus.test' && r.location.endsWith('#g-' + row.id), JSON.stringify(r))
// approver
r = await post(CP, closeG1, { close_note: '  ' })
ok('close without saying how: refused', r.location.includes('Say how it was closed') && (await getDb()).intent_gaps.find((x) => x.id === 'g1').status === 'open')
r = await post(CP, closeG1, { close_note: 'Fixed in build f98f724, re-tested on Patel' })
row = (await getDb()).intent_gaps.find((x) => x.id === 'g1')
ok('approver closes a gap: who, when and how are kept', row.status === 'closed' && row.closed_by === 'user-mitch' && row.closed_by_email === 'mitch@barnhaus.test' && !!row.closed_at && row.close_note === 'Fixed in build f98f724, re-tested on Patel' && r.location.endsWith('#g-g1'), JSON.stringify(row))
r = await post(CP, closeG1, { close_note: 'again' })
ok('close a gap that is already closed: refused', r.location.includes('already changed') && (await getDb()).intent_gaps.find((x) => x.id === 'g1').close_note.startsWith('Fixed in build'))
r = await post(CP, reopenG2, {})
row = (await getDb()).intent_gaps.find((x) => x.id === 'g2')
ok('approver reopens a closed gap', row.status === 'open' && row.closed_at === null && row.closed_by_email === null && row.close_note === null, JSON.stringify(row))
ok('reports, proofs and gaps are never deleted', !(await (await fetch(mock + '/__calls')).json()).some((c) => c.op.startsWith('delete') && ['intent_bridge_reports', 'intent_bridge_proven', 'intent_gaps'].includes(c.table)))

// ---------- C7. contract v2: typed pushes, typing by hand, dual emit, model checks ----------
const kindRows = (await getDb()).intent_kinds
const V2 = await import('../../src/lib/emit-v2.ts')
const vocabRes = await fetch(app + '/api/vocabulary', { headers: SECRET })
const vocabBody = await vocabRes.json()
ok('api vocabulary: draft list of kinds, roles, the no-work kind', vocabRes.status === 200 && vocabBody.status === 'draft' && vocabBody.locked === 31 && vocabBody.draft === 4 && vocabBody.by_backing.recipe === 8 && vocabBody.kinds.find((k) => k.kind === 'site.modify').backing === 'recipe' && vocabBody.kinds.find((k) => k.kind === 'site.modify').bridge_commands.includes('revit.edit_sketch_boundary') && vocabBody.by_backing.unmapped === 1 && vocabBody.kinds.find((k) => k.kind === 'site.pool').backing === 'unmapped' && vocabBody.kinds.find((k) => k.kind === 'surface.ceiling').recipe.proven === true && vocabBody.kinds.find((k) => k.kind === 'site.fence').recipe.proven === true && vocabBody.kinds.find((k) => k.kind === 'structure.stairs').status === 'locked' && vocabBody.kinds.find((k) => k.kind === 'structure.stairs').backing === 'recipe' && vocabBody.kinds.find((k) => k.kind === 'mep.plumbing').status === 'locked' && vocabBody.kinds.find((k) => k.kind === 'opening.place').backing === 'command' && vocabBody.kinds.find((k) => k.kind === 'opening.place').target_need === 'location' && vocabBody.kinds.find((k) => k.kind === 'opening.replace').target_need === 'element' && vocabBody.kinds.find((k) => k.kind === 'qa.run').target_need === 'none' && vocabBody.kinds.find((k) => k.kind === 'plumbing.niche').target_need === 'any' && vocabBody.kinds.every((k) => !!k.target_need) && vocabBody.kinds.find((k) => k.kind === 'casework.rehost').status === 'locked' && vocabBody.kinds.find((k) => k.kind === 'casework.rehost').locked_build === 'f98f724' && same(vocabBody.kinds.find((k) => k.kind === 'room.config').bridge_commands, ['revit.create_room', 'revit.set_parameter_value']) && vocabBody.kinds.find((k) => k.kind === 'surface.ceiling').status === 'locked' && vocabBody.kinds.find((k) => k.kind === 'surface.ceiling').backing === 'recipe' && same(vocabBody.kinds.find((k) => k.kind === 'surface.ceiling').bridge_commands, ['revit.invoke_method', 'revit.set_parameter_value']) && vocabBody.kinds.length === 35 && !vocabBody.kinds.some((k) => k.kind === 'context') && vocabBody.kinds.some((k) => k.kind === 'casework.counter') && vocabBody.kinds.find((k) => k.kind === 'mep.electrical').stage_scope === 'd2_to_d3' && vocabBody.context_marker === 'context' && vocabBody.roles.length === 34 && vocabBody.role_aliases['golf-room'] === 'game-room', JSON.stringify(vocabBody).slice(0, 200))
ok('api vocabulary without the secret or a session: 401', (await fetch(app + '/api/vocabulary')).status === 401)

// a push with a kind or a role that is not in the vocabulary is refused whole
before = await getDb()
res = await fetch(app + '/api/prefill', { method: 'POST', headers: SECRET, body: JSON.stringify({ project: { name: 'Scratch v2' }, rooms: [{ section_code: '201', name: 'Kitchen', role: 'spa', decisions: [{ topic: 'island', value: '84 x 42', kind: 'casework.island' }, { topic: 'counter', value: 'Marble', kind: 'casework.counter' }] }] }) })
let refused = await res.json()
db = await getDb()
ok('typed push with an unknown kind and role: 422, both named, NOTHING written', res.status === 422 && same(refused.unknown_kinds, ['casework.island']) && same(refused.unknown_roles, ['201: spa']) && db.intent_projects.length === before.intent_projects.length && db.intent_rooms.length === before.intent_rooms.length && db.intent_decisions.length === before.intent_decisions.length, JSON.stringify(refused))

// the scratch project, pushed typed (one line left without a kind on purpose)
res = await fetch(app + '/api/prefill', { method: 'POST', headers: SECRET, body: JSON.stringify({
  project: { name: 'Scratch v2', doc: 'Scratch v2 D2.rvt' },
  rooms: [
    { section_code: '201', name: 'Kitchen', source: 'model_scan', area_sf: 300, model_state: { casework: 4, scanned_at: '2026-11-11T06:00:00Z', bridge_build: 'f98f724' }, role: 'kitchen', needs_2d: true,
      decisions: [
        { topic: 'island', value: '84 x 42 island', kind: 'casework.place', params: { width_in: 84, depth_in: 42 } },
        { topic: 'counter', value: 'Marble slab, no waterfall', kind: 'casework.counter' },
        { topic: 'sink', value: 'Undermount, centred on the window', kind: 'plumbing.sink' },
        { topic: 'under the stair', value: 'Leave it open', kind: 'context' },
        { topic: 'hood', value: 'Plaster hood, no wood' },
      ],
      redline_notes: [{ note_type: 'beam', text: 'Beam, not a wall', source_ref: 'A101.1', kind: 'surface.beam' }] },
    { section_code: '202', name: 'Bath 2', source: 'model_scan', role: 'bath', shell_changed: true,
      decisions: [{ topic: 'wall', value: 'Move the toilet wall 6 in', kind: 'surface.wall' }, { topic: 'mirror lights', value: 'Side lights at the mirror', kind: 'mep.electrical' }] },
    { section_code: '203', name: 'Golf Room', source: 'model_scan', role: 'golf-room' },
    { section_code: 'HOUSE', name: 'House-Level (global)', decisions: [{ topic: 'cabinet material', value: 'White oak everywhere', kind: 'finish.material' }, { topic: 'fencing', value: 'Only around the pool', kind: 'site.fence' }] },
  ],
}) })
made = await res.json()
db = await getDb()
const SP = made.project_id
const sRoom = (d, code) => d.intent_rooms.find((x) => x.project_id === SP && x.section_code === code)
const sDec = (d, topic) => d.intent_decisions.find((x) => x.project_id === SP && x.topic === topic)
ok('typed push: project, rooms and lines stored with their kinds, numbers and roles', res.status === 200 && made.rooms === 4 && made.decisions.inserted === 9 && made.redline_notes === 1 && db.intent_projects.find((p) => p.id === SP).doc_title === 'Scratch v2 D2.rvt' && sRoom(db, '201').role === 'kitchen' && sRoom(db, '203').role === 'game-room' && sRoom(db, '202').shell_changed === true && sDec(db, 'island').kind === 'casework.place' && same(sDec(db, 'island').params, { width_in: 84, depth_in: 42 }) && sDec(db, 'island').kind_set_by === 'blueprint' && !sDec(db, 'hood').kind && db.intent_redline_notes.find((n) => n.project_id === SP).kind === 'surface.beam', JSON.stringify(made))
ok('typed push: a machine cannot say a room gets 2D drawings', db.intent_rooms.filter((x) => x.project_id === SP).every((x) => x.needs_2d == null))

// test setup only: the rooms are marked reviewed straight in the mock (the review buttons are covered in section C)
await fetch(mock + '/rest/v1/intent_rooms?project_id=eq.' + SP, { method: 'PATCH', body: JSON.stringify({ review_state: 'confirmed', sort_order: 0 }) })
const SE = '/projects/' + SP + '/emit'
const gaps = (t) => (/(\d+) things? missing/.exec(t) || [])[1]
html = (await page(SE)).replace(/<!-- -->/g, '')
ok('emit page: gates pass, and the typed contract lists exactly what is missing', html.includes('Lock &amp; Emit contract v1') && gaps(html) === '4' && html.includes('Room 201 Kitchen: nobody has said whether it gets 2D drawings') && html.includes('Room 203 Golf Room: nobody has said') && html.includes('decision &quot;hood: Plaster hood, no wood&quot;: no kind of work chosen') && !html.includes('no role chosen'), gaps(html))

// emit now: v1 goes out exactly as before; v2 is not written and says why
h = form(html, (f) => f.includes('Lock &amp; Emit contract'), 'emit form')
r = await post(SE, h, {})
db = await getDb()
let em = db.intent_emissions.find((e) => e.project_id === SP && e.version === 1)
ok('emit with gaps: v1 emitted and the project locked', r.status === 303 && r.location.includes('emitted=1') && r.location.includes('v2=no-4') && em && em.intent_json.rooms.length === 4 && em.brief_md.includes('# Scratch v2') && db.intent_projects.find((p) => p.id === SP).status === 'locked' && db.intent_projects.find((p) => p.id === SP).emitted_version === 1, JSON.stringify(r))
ok('emit with gaps: no typed contract, the gaps are on the emission', em.intent_v2_json === null && em.v2_work_items === null && em.v2_errors.length === 4, JSON.stringify(em.v2_errors))
const v1Decision = em.intent_json.rooms.find((x) => x.section_code === '201').decisions[0]
ok('contract v1 is unchanged: same fields, nothing typed leaks in', same(Object.keys(em.intent_json).sort(), ['parked_images', 'project', 'rooms', 'unassigned_images']) && same(Object.keys(v1Decision).sort(), ['meeting_date', 'source', 'source_ref', 'superseded_by', 'topic', 'value']) && same(Object.keys(em.intent_json.rooms[0]).sort(), ['area_sf', 'decisions', 'images', 'model_state', 'name', 'open_questions', 'redline_notes', 'review_state', 'section_code']), JSON.stringify(Object.keys(em.intent_json.rooms[0])))
res = await fetch(app + '/api/contract/' + SP + '?schema=2', { headers: SECRET })
let c2 = await res.json()
ok('api contract schema=2 on an emission without v2: 409 with the gaps; v1 still served', res.status === 409 && c2.v2_errors.length === 4 && (await fetch(app + '/api/contract/' + SP, { headers: SECRET })).status === 200, JSON.stringify(c2).slice(0, 200))
const told1 = db.portal_messages[db.portal_messages.length - 1]
ok('handoff message says the typed contract was not emitted', told1.content.includes('Intent contract v1 for Scratch v2') && told1.content.includes('was NOT emitted: 4 things missing'), told1.content.slice(-200))
html = (await page(SE + '?emitted=1&handoff=x&v2=no-4')).replace(/<!-- -->/g, '')
ok('emit page after: says v2 was not written, history shows no typed contract', html.includes('Typed contract (v2) was not written: 4 things missing') && html.includes('no typed contract'))

// a person types what is missing: the two rooms, then the one line
const roomPath = (code) => '/projects/' + SP + '/rooms/' + sRoom(db, code).id
html = (await page(roomPath('201') + '?view=decide')).replace(/<!-- -->/g, '')
ok('room page: role is saved from the push, 2D is only a suggestion', html.includes('Gets 2D drawings before it is built — suggested, not saved yet') && html.includes('room not set · 1 line without a kind') && html.includes('kind: Casework: place') && html.includes('context only — nothing is built from this line') && html.includes('Nothing to build — context only') && html.includes('no kind of work yet'))
h = form(html, (f) => f.includes('name="needs_2d"'), 'room typing form (201)')
r = await post(roomPath('201'), h, { role: 'kitchen', needs_2d: 'yes' })
r2 = await post(roomPath('203'), form(await page(roomPath('203') + '?view=decide'), (f) => f.includes('name="needs_2d"'), 'room typing form (203)'), { role: 'game-room', needs_2d: 'no' })
h = form(await page(roomPath('202') + '?view=decide'), (f) => f.includes('name="needs_2d"'), 'room typing form (202)')
r3 = await post(roomPath('202'), h, { role: 'bath', needs_2d: 'yes', shell_changed: 'on' })
db = await getDb()
ok('room typing: saved by a person, with who and when', [r, r2, r3].every((x) => x.status === 303 && x.location.endsWith('?view=decide#typing')) && sRoom(db, '201').needs_2d === true && sRoom(db, '203').needs_2d === false && sRoom(db, '202').needs_2d === true && sRoom(db, '202').shell_changed === true && sRoom(db, '201').typed_by === 'mitch@barnhaus.test' && !!sRoom(db, '201').typed_at, JSON.stringify([r, r2, r3]))
r = await post(roomPath('202'), h, { role: 'spa', needs_2d: 'yes' })
ok('room typing: a role that is not in the list is refused', r.location.includes('is not in the list of room roles') && sRoom(await getDb(), '202').role === 'bath', JSON.stringify(r))

html = (await page(roomPath('201') + '?view=decide')).replace(/<!-- -->/g, '')
h = form(html, (f) => f.includes('name="topic"') && f.includes('value="hood"') && f.includes('Save for these lines'), 'topic kind form (hood)')
r = await post(roomPath('201'), h, { kind: 'casework.island' })
ok('line typing: a kind that is not in the list is refused', r.location.includes('is not in the list of kinds of work') && !sDec(await getDb(), 'hood').kind, JSON.stringify(r))
before = await getDb()
r = await post(roomPath('201'), h, { kind: 'casework.place' })
db = await getDb()
ok('line typing by topic: only the lines without a kind are typed; wording and other lines untouched', r.status === 303 && sDec(db, 'hood').kind === 'casework.place' && sDec(db, 'hood').kind_set_by === 'mitch@barnhaus.test' && sDec(db, 'hood').value === 'Plaster hood, no wood' && sDec(db, 'hood').status === 'active' && same(sDec(db, 'island'), sDec(before, 'island')) && db.intent_decisions.length === before.intent_decisions.length, JSON.stringify(r))
// one line, from its editor: kind + numbers; the line is not replaced
html = (await page(roomPath('201') + '?view=decide&edit=' + sDec(db, 'sink').id)).replace(/<!-- -->/g, '')
h = form(html, (f) => f.includes('Save kind — the wording stays as it is'), 'line kind form (sink)')
r = await post(roomPath('201'), h, { kind: 'plumbing.sink', params: 'not json' })
ok('line typing: numbers that are not name: value pairs are refused', r.location.includes('name: value pairs') && same(sDec(await getDb(), 'sink').params || {}, {}), JSON.stringify(r))
r = await post(roomPath('201'), h, { kind: 'plumbing.sink', params: '{"bowl_in": 30}' })
db = await getDb()
ok('line typing: kind and numbers saved on the same line', r.status === 303 && same(sDec(db, 'sink').params, { bowl_in: 30 }) && sDec(db, 'sink').status === 'active' && db.intent_decisions.length === before.intent_decisions.length, JSON.stringify(r))
// new wording keeps the kind
html = (await page(roomPath('201') + '?view=decide&edit=' + sDec(db, 'hood').id)).replace(/<!-- -->/g, '')
h = form(html, (f) => f.includes('name="value"') && f.includes('Save — replaces this line only'), 'replace form (hood)')
r = await post(roomPath('201'), h, { value: 'Plaster hood with a wood band', source: 'manual', source_ref: '', meeting_date: '' })
db = await getDb()
const newHood = db.intent_decisions.find((x) => x.project_id === SP && x.topic === 'hood' && x.status === 'active')
ok('new wording keeps the kind of work', newHood && newHood.value === 'Plaster hood with a wood band' && newHood.kind === 'casework.place', JSON.stringify(newHood))

// model checks: Blueprint proposes, only Mitch or Michael decide
const MC = '/rulebook/model-checks'
const ruleOf = (d, key) => d.intent_model_rules.find((x) => x.rule_key === key)
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
let mr = await res.json()
ok('api model-rules: the backlog, one accepted', res.status === 200 && mr.rules.length === 41 && mr.counts.accepted === 1 && mr.counts.proposed === 39 && mr.counts.retired === 1 && (await (await fetch(app + '/api/model-rules', { headers: SECRET })).json()).rules.map((x) => x.rule_key).join() === 'counter.no_builtin_splash', JSON.stringify(mr.counts))
res = await fetch(app + '/api/model-rules', { method: 'POST', headers: SECRET, body: JSON.stringify({ rule_key: 'stairs.headroom_80', description: 'Every stair has 80 inches of headroom.', kinds: ['structure.stairs'], status: 'accepted' }) })
ok('api model-rules: a machine cannot accept its own check', res.status === 400 && !ruleOf(await getDb(), 'stairs.headroom_80'))
res = await fetch(app + '/api/model-rules', { method: 'POST', headers: SECRET, body: JSON.stringify({ rule_key: 'stairs.headroom_80', description: 'Every stair has 80 inches of headroom.', kinds: ['structure.stair'] }) })
ok('api model-rules: a check attached to an unknown kind is refused', res.status === 422)
res = await fetch(app + '/api/model-rules', { method: 'POST', headers: SECRET, body: JSON.stringify({ rule_key: 'stairs.headroom_80', description: 'Every stair has 80 inches of headroom.', kinds: ['structure.stairs'] }) })
row = ruleOf(await getDb(), 'stairs.headroom_80')
ok('api model-rules: proposed, by blueprint, not in force', res.status === 201 && row.status === 'proposed' && row.proposed_by === 'blueprint' && !row.decided_at && same(row.kinds, ['structure.stairs']), JSON.stringify(row))
html = await pageAs(MC, asBlueprint)
ok('model checks, non-approver: listed, no accept buttons', html.includes('No two casework solids overlap.') && html.includes('Only Mitch or Michael can accept or retire a check') && !html.includes('name="rule_id"'))
html = (await page(MC)).replace(/<!-- -->/g, '')
const acceptOverlap = form(html, (f) => f.includes('value="' + ruleOf(db, 'casework.no_overlap').id + '"'), 'decide form (casework.no_overlap)')
before = await getDb()
r = await postAs(MC, acceptOverlap, { decision: 'accept', note: '' }, asBlueprint)
ok('model checks, non-approver posts accept: refused, nothing changed', r.location.includes('Only Mitch or Michael can accept or retire a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, acceptOverlap, { decision: 'accept', note: 'Solids, not boxes' })
db = await getDb()
row = ruleOf(db, 'casework.no_overlap')
ok('model checks, approver accepts: in force, who and when kept, Blueprint told', r.location.includes('saved=casework.no_overlap accepted') && row.status === 'accepted' && row.decided_by_email === 'mitch@barnhaus.test' && row.decision_note === 'Solids, not boxes' && row.version === 2 && db.portal_messages[db.portal_messages.length - 1].content.includes('Model check accepted: `casework.no_overlap`'), JSON.stringify(row))
r = await post(MC, acceptOverlap, { decision: 'accept', note: '' })
ok('model checks: accepting twice is refused', r.location.includes('is already accepted'), JSON.stringify(r))

// a number on a check (a tolerance): only Mitch or Michael change it, the check keeps its status, Blueprint is told
const shellRule = ruleOf(await getDb(), 'shell.outline_matches_model')
html = await pageAs(MC, asBlueprint)
ok('number on a check, non-approver: sees the number, has no field', html.includes('Tolerance: 0.25 ft') && html.includes('starting value; nobody has changed the number') && !html.includes('name="param"'))
html = (await page(MC)).replace(/<!-- -->/g, '')
const numForm = form(html, (f) => f.includes('name="param"') && f.includes('value="' + shellRule.id + '"'), 'number form (shell tolerance)')
before = await getDb()
r = await postAs(MC, numForm, { value: '0.5' }, asBlueprint)
ok('number on a check, non-approver posts a number: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a number on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
let badNumbers = []
for (const bad of ['0', '-1', 'abc', '']) {
  r = await post(MC, numForm, { value: bad })
  if (!r.location.includes('The number must be greater than zero')) badNumbers.push(bad)
}
ok('number on a check: zero, a negative, text and blank are refused, nothing changed', badNumbers.length === 0 && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(badNumbers))
r = await post(MC, numForm, { value: '0.25' })
ok('number on a check: the same number changes nothing', r.location.includes('already says 0.25 ft') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, { ...numForm, param: 'made_up_ft' }, { value: '2' })
ok('number on a check: a number the check does not carry cannot be added', r.location.includes('carries no number called') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, numForm, { value: '0.4' })
db = await getDb()
row = ruleOf(db, 'shell.outline_matches_model')
let lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('number on a check, approver changes it: saved, version up, status kept, who and when kept, Blueprint told', r.location.includes('saved=shell.outline_matches_model: tolerance 0.4 ft') && row.params.tolerance_ft === 0.4 && row.params.initial === false && row.version === shellRule.version + 1 && row.status === shellRule.status && row.params_by === 'mitch@barnhaus.test' && !!row.params_at && lastMsg.includes('Model check number changed: \`shell.outline_matches_model\`') && lastMsg.includes('0.25 ft → 0.4 ft') && lastMsg.includes('not a go'), JSON.stringify([r, row, lastMsg]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'shell.outline_matches_model')
ok('api model-rules: the new number is what Blueprint reads', mr.params.tolerance_ft === 0.4 && mr.version === shellRule.version + 1 && mr.params_by === 'mitch@barnhaus.test' && !!mr.params_at, JSON.stringify(mr))
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('number on a check: the page shows who set it', html.includes('number set by Mitch'), '')
// a tolerance in inches (the placed-opening check) has the same field, with its own unit
const openRule = ruleOf(await getDb(), 'opening.bbox_verified')
r = await post(MC, form(html, (f) => f.includes('name="param"') && f.includes('value="tolerance_in"') && f.includes('value="' + openRule.id + '"'), 'number form (opening tolerance)'), { value: '0.5' })
row = ruleOf(await getDb(), 'opening.bbox_verified')
ok('number on a check: an inch tolerance is saved with its unit', r.location.includes('saved=opening.bbox_verified: tolerance 0.5 in') && row.params.tolerance_in === 0.5 && row.params.initial === false && row.version === openRule.version + 1, JSON.stringify([r, row.params]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
ok('api model-rules: the inch tolerance is what the checker reads', (await res.json()).rules.find((x) => x.rule_key === 'opening.bbox_verified').params.tolerance_in === 0.5)
// the same check carries a second number: how far past half the wall's thickness the host-wall search reaches (flag 48, A70)
html = (await page(MC)).replace(/<!-- -->/g, '')
const openRule2 = ruleOf(await getDb(), 'opening.bbox_verified')
r = await post(MC, form(html, (f) => f.includes('name="param"') && f.includes('value="host_search_margin_in"') && f.includes('value="' + openRule2.id + '"'), 'number form (host search margin)'), { value: '3' })
row = ruleOf(await getDb(), 'opening.bbox_verified')
ok('number on a check: the host search margin is saved with its unit, and the tolerance next to it is untouched', r.location.includes('saved=opening.bbox_verified: host search margin 3 in') && row.params.host_search_margin_in === 3 && row.params.tolerance_in === 0.5 && row.version === openRule2.version + 1, JSON.stringify([r, row.params]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'opening.bbox_verified')
ok('api model-rules: the host search margin and the new sentence are what the checker reads', mr.params.host_search_margin_in === 3 && mr.description.includes('is in the wall the approved drawing puts it in'), JSON.stringify(mr))
// an accepted check keeps its number field and stays accepted when the number changes
const tgt = ruleOf(db, 'target.element_where_drawn')
r = await post(MC, form(html, (f) => f.includes('name="decision"') && f.includes('value="' + tgt.id + '"'), 'decide form (target.element_where_drawn)'), { decision: 'accept', note: '' })
html = (await page(MC)).replace(/<!-- -->/g, '')
r = await post(MC, form(html, (f) => f.includes('name="param"') && f.includes('value="' + tgt.id + '"'), 'number form (element tolerance)'), { value: '0.5' })
row = ruleOf(await getDb(), 'target.element_where_drawn')
ok('number on a check: an accepted check stays accepted when its number changes', row.status === 'accepted' && row.params.tolerance_ft === 0.5 && row.version === 3, JSON.stringify(row))
r = await post(MC, form(html, (f) => f.includes('name="decision"') && f.includes('value="' + tgt.id + '"'), 'decide form (target, retire)'), { decision: 'retire', note: '' })
html = (await page(MC)).replace(/<!-- -->/g, '')
r = await post(MC, { ...numForm, rule_id: tgt.id }, { value: '0.6' })
ok('number on a check: a retired check has no field and refuses a posted number', r.location.includes('is retired') && ruleOf(await getDb(), 'target.element_where_drawn').params.tolerance_ft === 0.5 && html.includes('Tolerance: 0.5 ft'), JSON.stringify(r))

// kinds of work: what a kind must be pinned to before it is built. Only Mitch or Michael change it; Blueprint reads it.
const KP = '/rulebook/kinds'
html = await pageAs(KP, asBlueprint)
ok('kinds, non-approver: sees what each kind is pinned to, no form', html.includes('pinned to: an existing element in the model') && html.includes('Only Mitch or Michael can change it') && !html.includes('name="target_need"'))
html = (await page(KP)).replace(/<!-- -->/g, '')
const needForm = form(html, (f) => f.includes('name="target_need"') && f.includes('value="plumbing.niche"'), 'pinned-to form (plumbing.niche)')
before = await getDb()
r = await postAs(KP, needForm, { target_need: 'element' }, asBlueprint)
ok('kinds, non-approver posts a change: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a kind of work') && same((await getDb()).intent_kinds, before.intent_kinds), JSON.stringify(r))
r = await post(KP, needForm, { target_need: 'somewhere' })
ok('kinds: a value outside the four is refused', r.location.includes('Nothing was changed') && same((await getDb()).intent_kinds, before.intent_kinds), JSON.stringify(r))
r = await post(KP, needForm, { target_need: 'element' })
db = await getDb()
row = db.intent_kinds.find((x) => x.kind === 'plumbing.niche')
ok('kinds, approver changes what a kind is pinned to: saved, who kept, Blueprint told', r.location.includes('saved=' + row.label + ': an existing element in the model') && row.target_need === 'element' && row.target_need_by === 'mitch@barnhaus.test' && !!row.target_need_at && db.portal_messages[db.portal_messages.length - 1].content.includes('`plumbing.niche`') && db.portal_messages[db.portal_messages.length - 1].content.includes('not a go'), JSON.stringify(r))
res = await fetch(app + '/api/vocabulary', { headers: SECRET })
ok('api vocabulary: the change is what Blueprint reads', (await res.json()).kinds.find((k) => k.kind === 'plumbing.niche').target_need === 'element')

// emit again: nothing is missing now, so v1 AND v2 go out on the same emission
html = (await page(SE)).replace(/<!-- -->/g, '')
ok('emit page: nothing missing', html.includes('Nothing missing. Emitting now also writes the typed contract: 9 work items') && !html.includes('things missing'), gaps(html))
h = form(html, (f) => f.includes('Lock &amp; Emit contract'), 'emit form (again)')
r = await post(SE, h, {})
db = await getDb()
em = db.intent_emissions.find((e) => e.project_id === SP && e.version === 2)
ok('emit, nothing missing: v1 and v2 on the same emission', r.location.includes('emitted=2') && r.location.includes('v2=ok-9') && em && em.intent_json.rooms.length === 4 && em.v2_work_items === 9 && em.v2_errors === null && em.intent_v2_json.schema === 'intent-contract/2.0', JSON.stringify(r))
res = await fetch(app + '/api/contract/' + SP + '?version=2&schema=2', { headers: SECRET })
c2 = await res.json()
const K2 = c2.contract
const k2room = (code) => K2.rooms.find((x) => x.section_code === code)
ok('SCRATCH PROJECT EMITS A VALID v2: fetched by the machine route and valid against the vocabulary', res.status === 200 && c2.schema === 'intent-contract/2.0' && c2.version === 2 && same(V2.validateContractV2(K2, kindRows), []), JSON.stringify(V2.validateContractV2(K2, kindRows)))
ok('v2: project, version and fingerprint', same(K2.project, { name: 'Scratch v2', slug: 'scratch-v2', doc: 'Scratch v2 D2.rvt', client: null }) && K2.version === 2 && K2.sha256_intent === V2.contractSha(K2) && K2.vocabulary.status === 'draft')
ok('v2: rooms carry role, 2D yes/no and shell-changed; HOUSE is not a room', same(K2.rooms.map((x) => [x.section_code, x.role, x.needs_2d, x.shell_changed]), [['201', 'kitchen', true, false], ['202', 'bath', true, true], ['203', 'game-room', false, false]]), JSON.stringify(K2.rooms.map((x) => [x.section_code, x.role, x.needs_2d, x.shell_changed])))
ok('v2: kitchen work items are typed, with numbers and where they came from', same(k2room('201').work_items.map((w) => w.kind).sort(), ['casework.counter', 'casework.place', 'casework.place', 'plumbing.sink', 'surface.beam']) && same(k2room('201').work_items.find((w) => w.summary.startsWith('island')).params, { width_in: 84, depth_in: 42 }) && same(k2room('201').work_items.find((w) => w.kind === 'plumbing.sink').params, { bowl_in: 30 }) && k2room('201').work_items.find((w) => w.summary.startsWith('island')).provenance.decision_id === sDec(db, 'island').id, JSON.stringify(k2room('201').work_items.map((w) => [w.kind, w.summary])))
ok('v2: only accepted checks are attached', same(k2room('201').work_items.find((w) => w.summary.startsWith('island')).acceptance, ['casework.no_overlap']) && same(k2room('201').work_items.find((w) => w.kind === 'casework.counter').acceptance, ['casework.no_overlap', 'counter.no_builtin_splash']) && same(k2room('201').work_items.find((w) => w.kind === 'surface.beam').acceptance, []), JSON.stringify(k2room('201').work_items.map((w) => w.acceptance)))
ok('v2: the no-work line is carried as context with its provenance, never as a work item', same(k2room('201').context.map((x) => x.text), ['under the stair: Leave it open']) && k2room('201').context[0].provenance.decision_id === sDec(db, 'under the stair').id && k2room('201').context[0].provenance.source === 'meeting' && !k2room('201').work_items.some((w) => w.summary.includes('under the stair')) && K2.vocabulary.kinds === 35)
ok('v2: a later-stage kind is carried, house and site are split', same(k2room('202').work_items.map((w) => w.kind), ['surface.wall', 'mep.electrical']) && same(K2.house.work_items.map((w) => w.kind), ['finish.material']) && same(K2.site.work_items.map((w) => w.kind), ['site.fence']) && K2.house.defaults_applied.includes('default:fridge'), JSON.stringify([K2.house.work_items.length, K2.site.work_items.length]))
ok('v2: scan time and bridge build ride on the room', k2room('201').model_state.scanned_at === '2026-11-11T06:00:00Z' && k2room('201').model_state.bridge_build === 'f98f724' && k2room('203').model_state.scanned_at === null)
ok('handoff message names the typed contract', db.portal_messages[db.portal_messages.length - 1].content.includes('Contract v2 (typed work items) is on the same emission: 9 work items') && db.portal_messages[db.portal_messages.length - 1].content.includes('&schema=2'))
html = (await page(SE + '?emitted=2&handoff=x&v2=ok-9')).replace(/<!-- -->/g, '')
ok('emit page after: typed contract linked in the history', html.includes('Typed contract (v2) written too: 9 work items') && html.includes('version=2&amp;schema=2') && html.includes('typed (9)'))
ok('a session, not only the machine, can read the typed contract', (await fetch(app + '/api/contract/' + SP + '?schema=2', { headers: { cookie } })).status === 200 && (await fetch(app + '/api/contract/' + SP + '?schema=2')).status === 401)

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
ok('delete: other projects untouched', db.intent_rooms.filter((x) => x.project_id === 'p-whitaker').length === whitakerRooms && db.intent_projects.length === 5) // 5 fixtures + the scratch project - Deubner
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
