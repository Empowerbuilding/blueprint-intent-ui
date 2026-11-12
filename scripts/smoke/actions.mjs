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
ok('api vocabulary: a kind carries its numbers; the fence number is there with no value, no other kind has one', vocabBody.kinds.find((k) => k.kind === 'site.fence').params.flat_max_in === null && Object.keys(vocabBody.kinds.find((k) => k.kind === 'site.fence').params).length === 1 && vocabBody.kinds.find((k) => k.kind === 'site.fence').params_note.includes('still count as flat') && vocabBody.kinds.filter((k) => k.params).length === 1, JSON.stringify(vocabBody.kinds.find((k) => k.kind === 'site.fence')))
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
    { section_code: '201', name: 'Kitchen', source: 'model_scan', area_sf: 300, model_state: { casework: 4, scanned_at: '2026-11-11T06:00:00Z', bridge_build: 'f98f724', level: 'Level 1.0' }, role: 'kitchen', needs_2d: true, sheet_group: 'pushed-by-a-machine',
      decisions: [
        { topic: 'island', value: '84 x 42 island', kind: 'casework.place', params: { width_in: 84, depth_in: 42 } },
        { topic: 'counter', value: 'Marble slab, no waterfall', kind: 'casework.counter' },
        { topic: 'sink', value: 'Undermount, centred on the window', kind: 'plumbing.sink' },
        { topic: 'under the stair', value: 'Leave it open', kind: 'context' },
        { topic: 'hood', value: 'Plaster hood, no wood' },
      ],
      redline_notes: [{ note_type: 'beam', text: 'Beam, not a wall', source_ref: 'A101.1', kind: 'surface.beam' }] },
    { section_code: '202', name: 'Bath 2', source: 'model_scan', role: 'bath', shell_changed: true, level: ' Level  2.0 ',
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
ok('typed push: the level comes from the scan (the field, or the scan record); a machine cannot set a sheet group', sRoom(db, '201').level === 'Level 1.0' && sRoom(db, '202').level === 'Level 2.0' && sRoom(db, '203').level == null && db.intent_rooms.filter((x) => x.project_id === SP).every((x) => x.sheet_group == null), JSON.stringify(db.intent_rooms.filter((x) => x.project_id === SP).map((x) => [x.section_code, x.level, x.sheet_group])))

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
ok('room typing: the form shows the level from the scan and proposes the role as the sheet group, unsaved', /name="level"[^>]*value="Level 1.0"/.test(html) && /name="sheet_group"[^>]*value="kitchen"/.test(html) && html.includes('suggested from what the room is, not saved yet') && sRoom(db, '201').sheet_group == null)
r = await post(roomPath('201'), h, { role: 'kitchen', needs_2d: 'yes', level: 'Level 1.0', sheet_group: ' Kitchen  and pantry ' })
r2 = await post(roomPath('203'), form(await page(roomPath('203') + '?view=decide'), (f) => f.includes('name="needs_2d"'), 'room typing form (203)'), { role: 'game-room', needs_2d: 'no' })
h = form(await page(roomPath('202') + '?view=decide'), (f) => f.includes('name="needs_2d"'), 'room typing form (202)')
r3 = await post(roomPath('202'), h, { role: 'bath', needs_2d: 'yes', shell_changed: 'on', level: 'Level 2.0', sheet_group: '' })
db = await getDb()
ok('room typing: the sheet group is saved as typed; saved empty = no interior sheet; a form without the field leaves it unsaid', sRoom(db, '201').sheet_group === 'Kitchen and pantry' && sRoom(db, '202').sheet_group === '' && sRoom(db, '203').sheet_group == null && sRoom(db, '202').level === 'Level 2.0', JSON.stringify(['201', '202', '203'].map((c) => [sRoom(db, c).level, sRoom(db, c).sheet_group])))
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
ok('api model-rules: the backlog, one accepted', res.status === 200 && mr.rules.length === 45 && mr.counts.accepted === 1 && mr.counts.proposed === 43 && mr.counts.retired === 1 && (await (await fetch(app + '/api/model-rules', { headers: SECRET })).json()).rules.map((x) => x.rule_key).join() === 'counter.no_builtin_splash', JSON.stringify(mr.counts))
// the sweep (rule A81): the API says why a check is back to proposed and what a wording edit changed
ok('api model-rules: a check put back to proposed carries its note and no decision; a wording edit carries its own note', (() => { const o = mr.rules.find((x) => x.rule_key === 'opening.bbox_verified'), s = mr.rules.find((x) => x.rule_key === 'shell.outline_matches_model'), c = mr.rules.find((x) => x.rule_key === 'counter.no_builtin_splash'); return o.status === 'proposed' && !o.decided_at && !o.decided_by && o.decision_note.startsWith('Back to proposed') && o.change_note === null && s.change_note.startsWith('Wording edit') && s.decision_note === null && c.decision_note === null && c.change_note === null })(), JSON.stringify(mr.rules.filter((x) => ['opening.bbox_verified', 'shell.outline_matches_model'].includes(x.rule_key))).slice(0, 600))
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
ok('number with no value, non-approver: told it waits on Mitch or Michael', html.replace(/<!-- -->/g, '').includes('Clear depth: no value yet') && html.replace(/<!-- -->/g, '').includes('Mitch or Michael type it. Until then the check cannot pass'))
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
// a number that carries a note (Blueprint's reading, not reviewed): the changed number says who changed it and from what, and keeps its first source
html = (await page(MC)).replace(/<!-- -->/g, '')
const stackRule = ruleOf(await getDb(), 'casework.no_stacked_boxes')
r = await post(MC, form(html, (f) => f.includes('name="param"') && f.includes('value="touch_tol_in"') && f.includes('value="' + stackRule.id + '"'), 'number form (touch tolerance)'), { value: '0.25' })
row = ruleOf(await getDb(), 'casework.no_stacked_boxes')
ok('number on a check: a number with a note keeps the note, which now says who changed it and from what and still names the first source; the other number and the words are untouched', r.location.includes('saved=casework.no_stacked_boxes: touch tol 0.25 in') && row.params.touch_tol_in === 0.25 && row.params.touch_tol_in_source.startsWith('Changed on this page by mitch@barnhaus.test on ') && row.params.touch_tol_in_source.includes(`from "0.5 in" to "0.25 in". Source of the first value: Blueprint's reading, not reviewed: half an inch`) && row.params.footprint_overlap_min_pct === 50 && row.params.footprint_overlap_min_pct_source === stackRule.params.footprint_overlap_min_pct_source && same(row.params.counter_names, stackRule.params.counter_names) && row.status === 'proposed' && row.version === stackRule.version + 1, JSON.stringify([r, row.params]))
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('number on a check: the page shows the changed note under the number, and the note of the number nobody changed', decode(html).includes('Touch tol: Changed on this page by mitch@barnhaus.test on ') && decode(html).includes("Footprint overlap min: Blueprint's reading, not reviewed: half of the smaller footprint."), '')
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

// the palette on the room colour check (flag 76, A91): one row per Department, each row names its source; only Mitch or Michael change a
// colour, the check keeps its status, the row's note then says who changed it and still names the graphic standard
// the notes are counted in what a person sees: the page also carries its text a second time as data for the browser
const sourceNotes = (h) => (h.replace(/<script[\s\S]*?<\/script>/g, '').match(/Graphic standard: standards\/D2_GRAPHIC_STANDARD\.md, section A101\.1 Floor Plan/g) || []).length
const palRule = ruleOf(await getDb(), 'room.palette_rgb')
html = await pageAs(MC, asBlueprint)
ok('palette, non-approver: sees every row with its source, has no field', html.includes('Kitchen: 252/246/214') && html.includes('Outdoor: 240/240/240') && sourceNotes(html) === 5 && !html.includes('name="department"'), '')
html = (await page(MC)).replace(/<!-- -->/g, '')
const palForm = form(html, (f) => f.includes('name="department"') && f.includes('value="Kitchen"') && f.includes('value="' + palRule.id + '"'), 'palette form (Kitchen)')
ok('palette, approver: five rows, each with three fields holding the colour', (html.match(/name="department"/g) || []).length === 5 && /name="department" value="Kitchen"[\s\S]{0,900}?name="red"[^>]*value="252"[\s\S]{0,400}?name="green"[^>]*value="246"[\s\S]{0,400}?name="blue"[^>]*value="214"/.test(html), '')
before = await getDb()
r = await postAs(MC, palForm, { red: '250', green: '240', blue: '200' }, asBlueprint)
ok('palette, non-approver posts a colour: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a colour on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
let badColours = []
for (const bad of [{ red: '256', green: '240', blue: '200' }, { red: '-1', green: '240', blue: '200' }, { red: '250', green: '1.5', blue: '200' }, { red: '250', green: '240', blue: '' }, { red: 'abc', green: '240', blue: '200' }]) {
  r = await post(MC, palForm, bad)
  if (!r.location.includes('each a whole number from 0 to 255')) badColours.push(bad)
}
ok('palette: above 255, a negative, a fraction, blank and text are refused, nothing changed', badColours.length === 0 && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(badColours))
r = await post(MC, palForm, { red: '252', green: '246', blue: '214' })
ok('palette: the same colour changes nothing', r.location.includes('already says 252/246/214 for Kitchen') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, { ...palForm, department: 'Library' }, { red: '1', green: '2', blue: '3' })
ok('palette: a Department the check does not carry cannot be added', r.location.includes('carries no colour for') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, { ...palForm, rule_id: shellRule.id }, { red: '1', green: '2', blue: '3' })
ok('palette: a check without a palette refuses a posted colour', r.location.includes('carries no colour for') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, palForm, { red: '250', green: '240', blue: '200' })
db = await getDb()
row = ruleOf(db, 'room.palette_rgb')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('palette, approver changes a colour: saved, version up, status kept, the other rows untouched, who and when kept, Blueprint told', r.location.includes('saved=room.palette_rgb: Kitchen 250/240/200') && same(row.params.palette.Kitchen, [250, 240, 200]) && same(row.params.palette.Bedroom, [230, 217, 200]) && Object.keys(row.params.palette).length === 5 && row.params.initial === false && row.version === palRule.version + 1 && row.status === palRule.status && row.params_by === 'mitch@barnhaus.test' && !!row.params_at && lastMsg.includes('Model check colour changed: `room.palette_rgb`') && lastMsg.includes('Kitchen 252/246/214 → 250/240/200') && lastMsg.includes('This is a notice, not a go'), JSON.stringify([r, row.params, lastMsg]))
ok('palette: the changed row says who changed it and from what, and still names the graphic standard; the other rows keep their note', row.params.palette_source.Kitchen.startsWith('Changed on this page by mitch@barnhaus.test on ') && row.params.palette_source.Kitchen.includes('from 252/246/214 to 250/240/200. Source of the first value: Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan') && row.params.palette_source.Kitchen.includes('(Mitch, 2026-11-08)') && row.params.palette_source.Bedroom === palRule.params.palette_source.Bedroom, JSON.stringify(row.params.palette_source))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'room.palette_rgb')
ok('api model-rules: the palette is what the checker reads, with the note of each row', same(mr.params.palette, { Bedroom: [230, 217, 200], Kitchen: [250, 240, 200], Shower: [210, 220, 247], Carport: [240, 240, 240], Outdoor: [240, 240, 240] }) && Object.keys(mr.params.palette_source).length === 5 && mr.version === palRule.version + 1 && mr.checker_status === 'tool' && mr.params_by === 'mitch@barnhaus.test', JSON.stringify(mr))
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('palette: the page shows the new colour, its note and who set it', /name="department" value="Kitchen"[\s\S]{0,900}?name="red"[^>]*value="250"/.test(html) && html.includes('Changed on this page by mitch@barnhaus.test on ') && html.includes('colour set by Mitch') && sourceNotes(html) === 5, '')

// the texture folders on the material check (flag 79, A94): one row per folder, each row names its source; only Mitch or Michael change,
// add or remove a folder, the check keeps its status, the note then says who did it; the last folder cannot be removed
const seen = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '')
const folderNotes = (h) => (seen(h).match(/Runbook: standards\/D1_TO_D2_RUNBOOK\.md, section 8/g) || []).length
const folRule = ruleOf(await getDb(), 'material.appearance_paths_resolve')
const [FOL1, FOL2] = folRule.params.texture_folders
const AUTODESK = 'C:\\Program Files\\Common Files\\Autodesk Shared\\Materials\\Textures'
const MOVED = 'H:\\Shared drives\\Barnhaus\\Revit\\Revit\\Library\\Textures'
html = await pageAs(MC, asBlueprint)
ok('folders, non-approver: sees both folders with their source, has no field', seen(html).includes('Blueprint Families\\09_Patterns &amp; Images') && seen(html).includes('Revit\\Library\\Patterns &amp; Images') && folderNotes(html) === 2 && !html.includes('name="folder"') && !html.includes('Add folder'), '')
html = (await page(MC)).replace(/<!-- -->/g, '')
const folForm = form(html, (f) => f.includes('name="folder"') && f.includes('Blueprint Families') && f.includes('value="' + folRule.id + '"'), 'folder form (Blueprint Families)')
const folForm2 = form(html, (f) => f.includes('name="folder"') && f.includes('Revit\\Library\\Patterns') && f.includes('value="' + folRule.id + '"'), 'folder form (Library)')
const addForm = form(html, (f) => f.includes('value="add" class="btn-secondary-sm" name="step"') && f.includes('value="' + folRule.id + '"'), 'add-folder form')
ok('folders, approver: two rows, each with its path in a field and a Remove button, and one field to add a folder', (html.match(/name="folder"/g) || []).length === 2 && (html.match(/value="remove" class="btn-secondary-sm" name="step"/g) || []).length === 2 && (html.match(/value="add" class="btn-secondary-sm" name="step"/g) || []).length === 1 && folForm.folder === FOL1 && folForm2.folder === FOL2 && !('folder' in addForm), JSON.stringify([folForm, folForm2, addForm]))
before = await getDb()
r = await postAs(MC, folForm, { step: 'change', value: MOVED }, asBlueprint)
ok('folders, non-approver posts a folder: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a folder on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
let badFolders = []
for (const bad of ['Library\\Patterns', 'H:', '', 'H:\\a*b', '..\\x']) {
  for (const step of ['change', 'add']) {
    r = await post(MC, step === 'add' ? addForm : folForm, { step, value: bad })
    if (!r.location.includes('A folder is a full path that starts with a drive letter')) badFolders.push([step, bad])
  }
}
ok('folders: a relative path, a bare drive, blank and a forbidden character are refused, nothing changed', badFolders.length === 0 && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(badFolders))
r = await post(MC, folForm, { step: 'change', value: FOL1 })
r2 = await post(MC, folForm, { step: 'change', value: FOL2.toUpperCase().replace(/\\/g, '/') })
r3 = await post(MC, addForm, { step: 'add', value: FOL1.toLowerCase() + '\\' })
ok('folders: the same folder, and a folder the check already lists (in any case, with any slashes), change nothing', r.location.includes('already lists ' + FOL1) && r2.location.includes('already lists ' + FOL2) && r3.location.includes('already lists ' + FOL1) && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2, r3]))
r = await post(MC, { ...folForm, folder: 'H:\\Nope' }, { step: 'change', value: MOVED })
r2 = await post(MC, { ...folForm, folder: 'H:\\Nope' }, { step: 'remove' })
ok('folders: a folder the check does not list cannot be changed or removed', r.location.includes('does not list the folder') && r2.location.includes('does not list the folder') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2]))
r = await post(MC, { ...addForm, rule_id: shellRule.id }, { step: 'add', value: MOVED })
r2 = await post(MC, folForm, { step: 'empty', value: MOVED })
ok('folders: a check without a folder list refuses a posted folder; an unknown step changes nothing', r.location.includes('carries no list of folders') && r2.location.includes('Nothing was changed') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2]))
r = await post(MC, addForm, { step: 'add', value: AUTODESK + '\\' })
db = await getDb()
row = ruleOf(db, 'material.appearance_paths_resolve')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('folders, approver adds a folder: saved at the end of the list, version up, status kept, the two rows and their notes untouched, Blueprint told', r.location.includes('saved=material.appearance_paths_resolve: folder added, ' + AUTODESK) && same(row.params.texture_folders, [FOL1, FOL2, AUTODESK]) && row.params.texture_folders_source[FOL1] === folRule.params.texture_folders_source[FOL1] && row.params.texture_folders_source[FOL2] === folRule.params.texture_folders_source[FOL2] && row.params.initial === false && row.version === folRule.version + 1 && row.status === folRule.status && row.params_by === 'mitch@barnhaus.test' && !!row.params_at && lastMsg.includes('Model check folder added: `material.appearance_paths_resolve`') && lastMsg.includes(AUTODESK) && lastMsg.includes('it now lists 3 folders') && lastMsg.includes('This is a notice, not a go'), JSON.stringify([r, row.params, lastMsg]))
ok('folders: the added folder says a person added it and that no standard names it', row.params.texture_folders_source[AUTODESK].startsWith('Added on this page by mitch@barnhaus.test on ') && row.params.texture_folders_source[AUTODESK].includes('No standard document names this folder'), JSON.stringify(row.params.texture_folders_source))
r = await post(MC, folForm2, { step: 'change', value: MOVED })
db = await getDb()
row = ruleOf(db, 'material.appearance_paths_resolve')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('folders, approver changes a folder: saved in its place, version up, the old path and its note gone, the new note says who and from what and still names the runbook', r.location.includes('saved=material.appearance_paths_resolve: folder changed to ' + MOVED) && same(row.params.texture_folders, [FOL1, MOVED, AUTODESK]) && !(FOL2 in row.params.texture_folders_source) && row.params.texture_folders_source[MOVED].startsWith('Changed on this page by mitch@barnhaus.test on ') && row.params.texture_folders_source[MOVED].includes(', from ' + FOL2 + ' to ' + MOVED + '. Source of the first value: Runbook: standards/D1_TO_D2_RUNBOOK.md, section 8') && row.version === folRule.version + 2 && row.status === folRule.status && lastMsg.includes('Model check folder changed: `material.appearance_paths_resolve`') && lastMsg.includes(FOL2 + ' → ' + MOVED), JSON.stringify([r, row.params, lastMsg]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'material.appearance_paths_resolve')
ok('api model-rules: the folder list is what the checker reads, with the note of each folder', same(mr.params.texture_folders, [FOL1, MOVED, AUTODESK]) && same(Object.keys(mr.params.texture_folders_source).sort(), [FOL1, MOVED, AUTODESK].sort()) && mr.version === folRule.version + 2 && mr.checker_status === 'tool' && mr.params_by === 'mitch@barnhaus.test', JSON.stringify(mr))
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('folders: the page shows the three rows, the notes and who changed the list', (html.match(/name="folder"/g) || []).length === 3 && seen(html).includes('Changed on this page by mitch@barnhaus.test on ') && seen(html).includes('Added on this page by mitch@barnhaus.test on ') && seen(html).includes('folder list changed by Mitch') && folderNotes(html) === 2, '')
r = await post(MC, { ...folForm, folder: AUTODESK }, { step: 'remove' })
r2 = await post(MC, { ...folForm, folder: MOVED }, { step: 'remove' })
db = await getDb()
row = ruleOf(db, 'material.appearance_paths_resolve')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('folders, approver removes two folders: gone from the list with their notes, Blueprint told', r.location.includes('folder removed, ' + AUTODESK) && r2.location.includes('folder removed, ' + MOVED) && same(row.params.texture_folders, [FOL1]) && same(Object.keys(row.params.texture_folders_source), [FOL1]) && row.version === folRule.version + 4 && lastMsg.includes('Model check folder removed: `material.appearance_paths_resolve`') && lastMsg.includes('it now lists 1 folder)'), JSON.stringify([r, r2, row.params, lastMsg]))
before = await getDb()
r = await post(MC, folForm, { step: 'remove' })
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('folders: the last folder cannot be removed, and the page offers no Remove for it', r.location.includes('would have no folder left and could not be run') && same((await getDb()).intent_model_rules, before.intent_model_rules) && (html.match(/name="folder"/g) || []).length === 1 && !html.includes('value="remove" class="btn-secondary-sm" name="step"'), JSON.stringify(r))

// a number the check carries WITHOUT a value (rule A83: the checker needs it, the sentence does not state it, nobody guessed it):
// an approver types its first value; until then the check is not accepted
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules
ok('api model-rules: a number waiting for a value is there, with no value', (() => { const s = mr.find((x) => x.rule_key === 'sink.cutout_matches_bowl'), o = mr.find((x) => x.rule_key === 'casework.no_opening_intersection'), p = mr.find((x) => x.rule_key === 'casework.position_within_1in_of_2d'); return 'tolerance_in' in s.params && s.params.tolerance_in === null && s.status === 'proposed' && s.decision_note.startsWith('Back to proposed') && 'clear_depth_in' in o.params && o.params.clear_depth_in === null && p.params.tolerance_in === 1 && p.change_note.startsWith('Number added') && p.checker_status === 'tool' })(), JSON.stringify(mr.filter((x) => ['sink.cutout_matches_bowl', 'casework.no_opening_intersection', 'casework.position_within_1in_of_2d'].includes(x.rule_key)).map((x) => [x.rule_key, x.status, x.params])))
html = (await page(MC)).replace(/<!-- -->/g, '')
const sinkRule = ruleOf(await getDb(), 'sink.cutout_matches_bowl')
const sinkDecide = form(html, (f) => f.includes('name="decision"') && f.includes('value="' + sinkRule.id + '"'), 'decide form (sink.cutout_matches_bowl)')
const sinkNum = form(html, (f) => f.includes('name="param"') && f.includes('value="tolerance_in"') && f.includes('value="' + sinkRule.id + '"'), 'number form (sink tolerance, no value yet)')
before = await getDb()
r = await post(MC, sinkDecide, { decision: 'accept', note: '' })
ok('number with no value: the check is not accepted without it, nothing changed', r.location.includes('"sink.cutout_matches_bowl" has no tolerance yet. Type the number and save it, then accept the check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
badNumbers = []
for (const bad of ['0', '-1', 'abc', '']) {
  r = await post(MC, sinkNum, { value: bad })
  if (!r.location.includes('The number must be greater than zero')) badNumbers.push(bad)
}
ok('number with no value: zero, a negative, text and blank are refused, nothing changed', badNumbers.length === 0 && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(badNumbers))
r = await postAs(MC, sinkNum, { value: '0.25' }, asBlueprint)
ok('number with no value, non-approver posts one: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a number on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, sinkNum, { value: '0.25' })
db = await getDb()
row = ruleOf(db, 'sink.cutout_matches_bowl')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('number with no value, approver types it: saved as its first value, still proposed, version up, who and when kept, Blueprint told', r.location.includes('saved=sink.cutout_matches_bowl: tolerance 0.25 in') && row.params.tolerance_in === 0.25 && row.status === 'proposed' && row.version === sinkRule.version + 1 && row.params_by === 'mitch@barnhaus.test' && !!row.params_at && !row.decided_at && lastMsg.includes('Model check number set: \`sink.cutout_matches_bowl\`') && lastMsg.includes('tolerance 0.25 in, its first value') && lastMsg.includes('not a go'), JSON.stringify([r, row, lastMsg]))
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('number with no value: once typed, the page stops saying the check waits (the other one still does)', !html.includes('Waiting for a number (tolerance)') && html.includes('Waiting for a number (clear depth)') && html.includes('1 check waits for a number nobody has written down yet'), '')
r = await post(MC, sinkDecide, { decision: 'accept', note: 'Inside of the bowl at the rim' })
row = ruleOf(await getDb(), 'sink.cutout_matches_bowl')
ok('number with no value: with its number the check is accepted', r.location.includes('saved=sink.cutout_matches_bowl accepted') && row.status === 'accepted' && row.params.tolerance_in === 0.25 && row.decision_note === 'Inside of the bowl at the rim' && row.decided_by_email === 'mitch@barnhaus.test', JSON.stringify([r, row]))
// put it away again so the contract checks further down see the same accepted checks as before
r = await post(MC, sinkDecide, { decision: 'retire', note: 'smoke: put away' })
ok('number with no value: (the check is retired again for the rest of the run)', ruleOf(await getDb(), 'sink.cutout_matches_bowl').status === 'retired', JSON.stringify(r))
r = await post(MC, { ...sinkNum, param: 'rim_gap_max_in', rule_id: ruleOf(await getDb(), 'casework.no_opening_intersection').id }, { value: '2' })
ok('number with no value: a number the check does not carry at all still cannot be added', r.location.includes('carries no number called'), JSON.stringify(r))

// the words on a check (flag 80, A95): the words the site note check looks for, with a note naming the graphic standard; only Mitch or
// Michael change them, the check keeps its status, the note then says who changed them and from what
const noteRule = ruleOf(await getDb(), 'site.conceptual_note_present')
html = await pageAs(MC, asBlueprint)
ok('words, non-approver: sees the words and their source, has no field', seen(html).includes('“CONCEPTUAL SITE PLAN ONLY”') && seen(html).includes('Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section') && !html.includes('Save words'), '')
html = (await page(MC)).replace(/<!-- -->/g, '')
const noteForm = form(html, (f) => f.includes('name="param"') && f.includes('value="note_text"') && f.includes('value="' + noteRule.id + '"'), 'words form (site note)')
ok('words, approver: one field holding the words', /name="value"[^>]*value="CONCEPTUAL SITE PLAN ONLY"|value="CONCEPTUAL SITE PLAN ONLY"[^>]*name="value"/.test(html) && html.includes('starting words; nobody has changed them'), JSON.stringify(noteForm))
before = await getDb()
r = await postAs(MC, noteForm, { value: 'CONCEPT ONLY' }, asBlueprint)
ok('words, non-approver posts words: refused, nothing changed', r.location.includes('Only Mitch or Michael can change the words on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
r = await post(MC, noteForm, { value: '   ' })
r2 = await post(MC, noteForm, { value: 'x'.repeat(201) })
ok('words: blank and over-long words are refused, nothing changed', r.location.includes('Type the words, 200 characters at most') && r2.location.includes('Type the words, 200 characters at most') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2]))
r = await post(MC, noteForm, { value: ' CONCEPTUAL  SITE PLAN ONLY ' })
r2 = await post(MC, { ...noteForm, param: 'tolerance_text' }, { value: 'x' })
ok('words: the same words change nothing; words the check does not carry cannot be added', r.location.includes('already says "CONCEPTUAL SITE PLAN ONLY"') && r2.location.includes('carries no words called "tolerance_text"') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2]))
r = await post(MC, noteForm, { value: 'CONCEPTUAL SITE PLAN' })
db = await getDb()
row = ruleOf(db, 'site.conceptual_note_present')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('words, approver changes them: saved, version up, status kept, the note says who and from what and still names the standard, Blueprint told', r.location.includes('saved=site.conceptual_note_present: note text "CONCEPTUAL SITE PLAN"') && row.params.note_text === 'CONCEPTUAL SITE PLAN' && row.params.initial === false && row.version === noteRule.version + 1 && row.status === noteRule.status && row.params_by === 'mitch@barnhaus.test' && row.params.note_text_source.startsWith('Changed on this page by mitch@barnhaus.test on ') && row.params.note_text_source.includes('from "CONCEPTUAL SITE PLAN ONLY" to "CONCEPTUAL SITE PLAN". Source of the first value: Graphic standard: standards/D2_GRAPHIC_STANDARD.md') && lastMsg.includes('Model check words changed: \`site.conceptual_note_present\`') && lastMsg.includes('not a go'), JSON.stringify([r, row, lastMsg]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'site.conceptual_note_present')
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('api model-rules + page: the words are what the checker reads, and the page says who changed them', mr.params.note_text === 'CONCEPTUAL SITE PLAN' && mr.version === row.version && html.includes('words changed by Mitch'), JSON.stringify(mr))

// the material roles on a check (Mitch 02:08Z, A96): Blueprint's reading of the standard, every row marked as not reviewed; the check is
// proposed. Only Mitch or Michael change a row; a changed row says who and what and keeps its first source with the marking; a row
// accepted as shown keeps the marking and says who adopted it
const roleRule = ruleOf(await getDb(), 'material.one_per_role')
const marks = (h) => (seen(h).match(/Blueprint&#x27;s reading, not reviewed|Blueprint's reading, not reviewed/g) || []).length
html = await pageAs(MC, asBlueprint)
ok('roles, non-approver: sees the three roles with their marking and why the check is proposed, has no field', seen(html).includes('Casework wood: Cabinets in Cabinet Material, Door/Drawer Material') && seen(html).includes('accents allowed: Cabinets - White Oak, Cabinets - Navy') && seen(html).includes('Hardware: Metal - Black Matte in Handle Material') && seen(html).includes('no accent allowed') && marks(html) >= 3 && seen(html).includes('Back to proposed on 2026-11-12 (Mitch at 02:08Z)') && !html.includes('Save role'), String(marks(html)))
html = (await page(MC)).replace(/<!-- -->/g, '')
const roleForm = form(html, (f) => f.includes('name="role"') && f.includes('value="Casework wood"') && f.includes('value="' + roleRule.id + '"'), 'role form (Casework wood)')
const hardForm = form(html, (f) => f.includes('name="role"') && f.includes('value="Hardware"') && f.includes('value="' + roleRule.id + '"'), 'role form (Hardware)')
const roleDecide = form(html, (f) => f.includes('name="decision"') && f.includes('value="' + roleRule.id + '"'), 'decide form (material.one_per_role)')
ok('roles, approver: one form per role with its material, parameters and accents', (html.match(/name="role"/g) || []).length === 3 && roleForm.role === 'Casework wood' && hardForm.role === 'Hardware' && html.includes('starting roles; nobody has changed a role'), JSON.stringify([roleForm, hardForm]))
const CW = { material: 'Cabinets', parameters: 'Cabinet Material, Door/Drawer Material', accents: 'Cabinets - White Oak, Cabinets - Navy' }
before = await getDb()
r = await postAs(MC, roleForm, { ...CW, material: 'Oak' }, asBlueprint)
ok('roles, non-approver posts a role: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a role on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(r))
let badRoles = []
for (const [bad, want] of [[{ material: '' }, 'A role has one material'], [{ material: 'Oak, Walnut' }, 'A role has one material'], [{ parameters: ' , ' }, 'A role needs at least one family parameter'], [{ accents: 'Cabinets' }, 'cannot also be one of its accents']]) {
  r = await post(MC, roleForm, { ...CW, ...bad })
  if (!r.location.includes(want)) badRoles.push([bad, r.location])
}
ok('roles: no material, two materials, no parameter and the material among its own accents are refused, nothing changed', badRoles.length === 0 && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify(badRoles))
r = await post(MC, roleForm, { ...CW, parameters: ' Cabinet Material ,Door/Drawer Material,' })
r2 = await post(MC, { ...roleForm, role: 'Frames' }, CW)
const r3r = await post(MC, { ...roleForm, rule_id: noteRule.id }, CW)
ok('roles: the same values change nothing; a role the check does not carry cannot be added; a check without roles refuses one', r.location.includes('already says that for Casework wood') && r2.location.includes('carries no role called "Frames"') && r3r.location.includes('carries no roles') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2, r3r]))
r = await post(MC, roleForm, { ...CW, material: 'Cabinets - White Oak', accents: 'Cabinets - Navy' })
db = await getDb()
row = ruleOf(db, 'material.one_per_role')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('roles, approver changes a role: saved, version up, still proposed, the other rows untouched, the note says who and what and keeps the marking of the first value, Blueprint told', r.location.includes('saved=material.one_per_role: Casework wood, material from "Cabinets" to "Cabinets - White Oak"; accents from Cabinets - White Oak, Cabinets - Navy to Cabinets - Navy') && same(row.params.roles['Casework wood'], { parameters: ['Cabinet Material', 'Door/Drawer Material'], material: 'Cabinets - White Oak', accents: ['Cabinets - Navy'] }) && same(row.params.roles.Hardware, roleRule.params.roles.Hardware) && same(row.params.roles.Countertops, roleRule.params.roles.Countertops) && row.params.roles_source.Hardware === roleRule.params.roles_source.Hardware && row.params.roles_source['Casework wood'].startsWith('Changed on this page by mitch@barnhaus.test on ') && row.params.roles_source['Casework wood'].includes("Source of the first value: Blueprint's reading, not reviewed. From standards/DESIGN_BUILD_STANDARD.md") && row.params.initial === false && row.version === roleRule.version + 1 && row.status === 'proposed' && !row.decided_at && row.params_by === 'mitch@barnhaus.test' && lastMsg.includes('Model check role changed: \`material.one_per_role\`') && lastMsg.includes('not a go'), JSON.stringify([r, row, lastMsg]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'material.one_per_role')
ok('api model-rules: the roles are what the checker reads, with the note of each role', same(mr.params.roles, row.params.roles) && same(Object.keys(mr.params.roles_source).sort(), ['Casework wood', 'Countertops', 'Hardware']) && mr.version === row.version && mr.status === 'proposed', JSON.stringify(mr))
r = await post(MC, roleDecide, { decision: 'accept', note: 'Roles as shown' })
row = ruleOf(await getDb(), 'material.one_per_role')
ok('roles, approver accepts the check: the two rows nobody changed keep their marking and say who adopted them; the changed row is left as it was', r.location.includes('saved=material.one_per_role accepted') && row.status === 'accepted' && row.decided_by_email === 'mitch@barnhaus.test' && row.params.roles_source.Hardware.startsWith("Blueprint's reading, not reviewed.") && row.params.roles_source.Hardware.includes('Accepted as shown by mitch@barnhaus.test on ') && row.params.roles_source.Countertops.includes('Accepted as shown by mitch@barnhaus.test on ') && row.params.roles_source['Casework wood'].startsWith('Changed on this page by ') && !row.params.roles_source['Casework wood'].includes('Accepted as shown') && same(row.params.roles, mr.params.roles), JSON.stringify([r, row]))
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('roles: the page shows the adoption and who changed a role', seen(html).includes('Accepted as shown by mitch@barnhaus.test on ') && html.includes('role changed by Mitch'), '')
// put it away again so the contract checks further down see the same accepted checks as before
r = await post(MC, roleDecide, { decision: 'retire', note: 'smoke: put away' })
ok('roles: (the check is retired again for the rest of the run)', ruleOf(await getDb(), 'material.one_per_role').status === 'retired', JSON.stringify(r))

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

// a number on a kind of work (site.fence: how far heights may differ and still be flat). It starts with no value; only Mitch or Michael type it.
html = (await pageAs(KP, asBlueprint)).replace(/<!-- -->/g, '')
ok('kind number, non-approver: sees that it has no value and who types it, no form', html.includes('Flat max: no value yet') && html.includes('waiting for Mitch or Michael to type it') && !html.includes('name="param"'))
html = (await page(KP)).replace(/<!-- -->/g, '')
const kindNumForm = form(html, (f) => f.includes('name="param"') && f.includes('value="site.fence"'), 'number form (site.fence)')
ok('kind number: one form, on the one kind that carries a number', html.split('name="param"').length === 2 && kindNumForm.param === 'flat_max_in', JSON.stringify(kindNumForm))
before = await getDb()
r = await postAs(KP, kindNumForm, { value: '2' }, asBlueprint)
ok('kind number, non-approver posts a value: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a kind of work') && same((await getDb()).intent_kinds, before.intent_kinds), JSON.stringify(r))
r = await post(KP, kindNumForm, { value: '0' })
const kindEmpty = await post(KP, kindNumForm, { value: '' })
const kindWord = await post(KP, kindNumForm, { value: 'flat' })
ok('kind number: zero, nothing and a word are refused', [r, kindEmpty, kindWord].every((x) => x.location.includes('must be greater than zero')) && same((await getDb()).intent_kinds, before.intent_kinds), JSON.stringify([r, kindEmpty, kindWord]))
r = await post(KP, kindNumForm, { param: 'slope_max_in', value: '2' })
const kindOther = await post(KP, { ...kindNumForm, kind: 'plumbing.niche' }, { value: '2' })
ok('kind number: a number the kind does not carry cannot be added from the page', r.location.includes('carries no number called') && kindOther.location.includes('carries no number called') && same((await getDb()).intent_kinds, before.intent_kinds), JSON.stringify([r, kindOther]))
r = await post(KP, kindNumForm, { value: '2' })
db = await getDb()
row = db.intent_kinds.find((x) => x.kind === 'site.fence')
ok('kind number, approver types the first value: saved, who kept, Blueprint told it is the first value', r.location.includes('saved=') && decodeURIComponent(r.location).includes(row.label + ': flat max 2 in') && row.params.flat_max_in === 2 && row.params_by === 'mitch@barnhaus.test' && !!row.params_at && db.portal_messages[db.portal_messages.length - 1].content.includes('`site.fence`') && db.portal_messages[db.portal_messages.length - 1].content.includes('flat max 2 in, its first value') && db.portal_messages[db.portal_messages.length - 1].content.includes('not a go') && same(db.intent_kinds.filter((x) => x.kind !== 'site.fence'), before.intent_kinds.filter((x) => x.kind !== 'site.fence')), JSON.stringify(r))
const kindMsgs = db.portal_messages.length
r = await post(KP, kindNumForm, { value: '2' })
ok('kind number: the same value again changes nothing and tells nobody', r.location.includes('already says 2 in') && (await getDb()).portal_messages.length === kindMsgs, JSON.stringify(r))
r = await post(KP, kindNumForm, { value: '1.5' })
db = await getDb()
ok('kind number, approver changes it: old and new value in the message', db.intent_kinds.find((x) => x.kind === 'site.fence').params.flat_max_in === 1.5 && db.portal_messages[db.portal_messages.length - 1].content.includes('flat max 2 in → 1.5 in') && db.portal_messages[db.portal_messages.length - 1].content.includes('stale'), JSON.stringify(r))
html = (await page(KP)).replace(/<!-- -->/g, '')
ok('kind number: the page shows the value and who set it', html.includes('Flat max: 1.5 in') && html.includes('set by mitch@barnhaus.test') && !html.includes('Flat max: no value yet'))
res = await fetch(app + '/api/vocabulary', { headers: SECRET })
ok('api vocabulary: the number is what Blueprint reads', (await res.json()).kinds.find((k) => k.kind === 'site.fence').params.flat_max_in === 1.5)

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
ok('v2: rooms carry the level and the sheet group; a room nobody placed has both empty', same(K2.rooms.map((x) => [x.section_code, x.level, x.sheet_group]), [['201', 'Level 1.0', 'Kitchen and pantry'], ['202', 'Level 2.0', null], ['203', null, null]]), JSON.stringify(K2.rooms.map((x) => [x.section_code, x.level, x.sheet_group])))
ok('v2: kitchen work items are typed, with numbers and where they came from', same(k2room('201').work_items.map((w) => w.kind).sort(), ['casework.counter', 'casework.place', 'casework.place', 'plumbing.sink', 'surface.beam']) && same(k2room('201').work_items.find((w) => w.summary.startsWith('island')).params, { width_in: 84, depth_in: 42 }) && same(k2room('201').work_items.find((w) => w.kind === 'plumbing.sink').params, { bowl_in: 30 }) && k2room('201').work_items.find((w) => w.summary.startsWith('island')).provenance.decision_id === sDec(db, 'island').id, JSON.stringify(k2room('201').work_items.map((w) => [w.kind, w.summary])))
ok('v2: only accepted checks are attached', same(k2room('201').work_items.find((w) => w.summary.startsWith('island')).acceptance, ['casework.no_overlap']) && same(k2room('201').work_items.find((w) => w.kind === 'casework.counter').acceptance, ['casework.no_overlap', 'counter.no_builtin_splash']) && same(k2room('201').work_items.find((w) => w.kind === 'surface.beam').acceptance, []), JSON.stringify(k2room('201').work_items.map((w) => w.acceptance)))
ok('v2: the no-work line is carried as context with its provenance, never as a work item', same(k2room('201').context.map((x) => x.text), ['under the stair: Leave it open']) && k2room('201').context[0].provenance.decision_id === sDec(db, 'under the stair').id && k2room('201').context[0].provenance.source === 'meeting' && !k2room('201').work_items.some((w) => w.summary.includes('under the stair')) && K2.vocabulary.kinds === 35)
ok('v2: a later-stage kind is carried, house and site are split', same(k2room('202').work_items.map((w) => w.kind), ['surface.wall', 'mep.electrical']) && same(K2.house.work_items.map((w) => w.kind), ['finish.material']) && same(K2.site.work_items.map((w) => w.kind), ['site.fence']) && K2.house.defaults_applied.includes('default:fridge'), JSON.stringify([K2.house.work_items.length, K2.site.work_items.length]))
ok('v2: scan time and bridge build ride on the room', k2room('201').model_state.scanned_at === '2026-11-11T06:00:00Z' && k2room('201').model_state.bridge_build === 'f98f724' && k2room('203').model_state.scanned_at === null)
ok('handoff message names the typed contract', db.portal_messages[db.portal_messages.length - 1].content.includes('Contract v2 (typed work items) is on the same emission: 9 work items') && db.portal_messages[db.portal_messages.length - 1].content.includes('&schema=2'))
html = (await page(SE + '?emitted=2&handoff=x&v2=ok-9')).replace(/<!-- -->/g, '')
ok('emit page after: typed contract linked in the history', html.includes('Typed contract (v2) written too: 9 work items') && html.includes('version=2&amp;schema=2') && html.includes('typed (9)'))
ok('a session, not only the machine, can read the typed contract', (await fetch(app + '/api/contract/' + SP + '?schema=2', { headers: { cookie } })).status === 200 && (await fetch(app + '/api/contract/' + SP + '?schema=2')).status === 401)

// ---------- C8. Lock & Emit: a second press writes nothing (flag 52) ----------
// the project was emitted as v2 a moment ago and nothing has changed since
const emCount = (d) => d.intent_emissions.filter((e) => e.project_id === SP).length
const projOf = (d) => d.intent_projects.find((p) => p.id === SP)
html = (await page(SE)).replace(/<!-- -->/g, '')
ok('emit page, nothing changed: the main button is gone, the page says which version is current', html.includes('Contract v2 is current.') && html.includes('there is nothing new to emit') && !html.includes('Lock &amp; Emit contract v3') && html.includes('Emit it again anyway') && html.includes('Emit the same contract again as v3'))
// a press of the old button (a second click, a page left open): h still holds the form of the emission above
before = await getDb()
r = await post(SE, h, {})
db = await getDb()
ok('second press, nothing changed: no new version, no second message, the project stays at v2', r.status === 303 && r.location.includes('/emit?same=2') && !r.location.includes('emitted=') && emCount(db) === emCount(before) && projOf(db).emitted_version === 2 && db.portal_messages.length === before.portal_messages.length && same(db.intent_emissions, before.intent_emissions), JSON.stringify(r))
r2 = await post(SE, h, {})
r2 = await post(SE, h, {})
db = await getDb()
ok('third and fourth press: still nothing', r2.location.includes('/emit?same=2') && emCount(db) === emCount(before) && db.portal_messages.length === before.portal_messages.length)
html = (await page(SE + '?same=2')).replace(/<!-- -->/g, '')
ok('emit page after a repeat: says nothing new was emitted and nobody was messaged', html.includes('Nothing new was emitted: contract v2 already holds exactly this.') && html.includes('Blueprint was not messaged a second time'))
html = (await page(SE + '?emitted=2&handoff=portal notified (blueprint-mitch)&v2=ok-9')).replace(/<!-- -->/g, '')
ok('emit page after an emission: says Blueprint was told once; a failed message is said as such', html.includes('Blueprint has been told, once. There is no need to press again.') && (await page(SE + '?emitted=2&handoff=portal HTTP 500&v2=ok-9')).includes('The message to Blueprint may not have gone out'))
res = await fetch(app + '/api/emit', { method: 'POST', headers: { 'x-emit-secret': 'x', 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: SP, again: true }) })
ok('the machine route is as closed as before (no emit secret here)', res.status === 503 || res.status === 401, String(res.status))

// a person asks for it in so many words: the same contract goes out once more
const hAgain = form(html, (f) => f.includes('Emit the same contract again'), 'emit again form')
r = await post(SE, hAgain, {})
db = await getDb()
const em2 = db.intent_emissions.find((e) => e.project_id === SP && e.version === 2)
let em3 = db.intent_emissions.find((e) => e.project_id === SP && e.version === 3)
ok('emit again anyway: v3 is written with the content of v2, and Blueprint is messaged', hAgain.again === '1' && r.location.includes('emitted=3') && em3 && same(em3.intent_json.rooms, em2.intent_json.rooms) && em3.intent_json.project.emitted_version === 3 && em3.intent_v2_json.version === 3 && same(em3.intent_v2_json.rooms, em2.intent_v2_json.rooms) && projOf(db).emitted_version === 3 && db.portal_messages.length === before.portal_messages.length + 1 && db.portal_messages[db.portal_messages.length - 1].content.includes('Intent contract v3 for Scratch v2'), JSON.stringify(r))
html = (await page(SE)).replace(/<!-- -->/g, '')
ok('emit page: v3 is now the current one', html.includes('Contract v3 is current.') && html.includes('Emit the same contract again as v4') && !html.includes('Lock &amp; Emit contract v4'))

// two presses in the same instant: the other press has written v4 already (planted here), the database refuses a second v4
await fetch(mock + '/rest/v1/intent_emissions', { method: 'POST', body: JSON.stringify({ project_id: SP, version: 4, intent_json: { ...em3.intent_json, project: { ...em3.intent_json.project, emitted_version: 4 } }, brief_md: '# planted', intent_v2_json: null, v2_errors: null, v2_work_items: null }) })
before = await getDb()
r = await post(SE, hAgain, {})
db = await getDb()
ok('two presses at once, same content: the second writes no second v4 and sends no second message', r.location.includes('/emit?same=4') && db.intent_emissions.filter((e) => e.project_id === SP && e.version === 4).length === 1 && emCount(db) === emCount(before) && db.portal_messages.length === before.portal_messages.length, JSON.stringify(r))
await fetch(mock + '/rest/v1/intent_emissions?project_id=eq.' + SP + '&version=eq.4', { method: 'PATCH', body: JSON.stringify({ intent_json: { ...em3.intent_json, parked_images: 99 } }) })
before = await getDb()
r = await post(SE, hAgain, {})
db = await getDb()
ok('two presses at once, different content: refused in words, nothing written', r.location.includes('/emit?error=') && r.location.includes('Contract v4 was written a moment ago by another press') && r.location.includes('Nothing was written by this press') && emCount(db) === emCount(before) && db.portal_messages.length === before.portal_messages.length, JSON.stringify(r))
await fetch(mock + '/rest/v1/intent_emissions?project_id=eq.' + SP + '&version=eq.4', { method: 'DELETE' })

// something changes: the main button is back, and a press emits
const islandId = sDec(db, 'island').id
const islandWas = sDec(db, 'island').value
await fetch(mock + '/rest/v1/intent_decisions?id=eq.' + islandId, { method: 'PATCH', body: JSON.stringify({ value: islandWas + ' (moved 6 in)' }) })
html = (await page(SE)).replace(/<!-- -->/g, '')
ok('a decision changed: the Lock & Emit button is back for v4', html.includes('Lock &amp; Emit contract v4') && !html.includes('is current.') && !html.includes('Emit the same contract again'))
h = form(html, (f) => f.includes('Lock &amp; Emit contract'), 'emit form (after a change)')
r = await post(SE, h, {})
db = await getDb()
ok('emit after a change: v4 is written with the change', h.again === undefined && r.location.includes('emitted=4') && db.intent_emissions.find((e) => e.project_id === SP && e.version === 4).intent_json.rooms.find((x) => x.section_code === '201').decisions.some((d) => d.value === islandWas + ' (moved 6 in)') && projOf(db).emitted_version === 4, JSON.stringify(r))
r = await post(SE, h, {})
db = await getDb()
ok('and the press after that writes nothing again', r.location.includes('/emit?same=4') && emCount(db) === 4)

// ---------- C9. inspiration pictures feed the 2D drawings (spec A97) ----------
{
  const DEU = 'p-deubner'
  // the machine route: the pictures of a project's rooms with a signed link each
  let res = await fetch(app + '/api/inspo?project_id=' + DEU, { headers: SECRET })
  let j = await res.json()
  const c3 = (j.pictures || []).find((x) => x.id === 'i3')
  ok('inspo route: lists the pictures attached to a room with their details and a signed link; unassigned pictures are not listed', res.status === 200 && j.pictures.every((x) => x.room && x.image_url.includes('/object/sign/intent-inspo/') && x.image_url.includes('token=mock-600')) && !!c3 && c3.room === '103' && c3.storage_path.endsWith('/c.jpg')
    && same(c3.layout_details, ['island with seating on one side', 'range on the back wall']) && j.pictures.length === (await getDb()).intent_inspo_images.filter((x) => x.project_id === DEU && x.room_id).length && j.link_seconds === 600, JSON.stringify(j).slice(0, 600))
  res = await fetch(app + '/api/inspo?project_id=' + DEU + '&room=114', { headers: SECRET }); j = await res.json()
  ok('inspo route: one room only; a room without pictures gives an empty list', res.status === 200 && j.pictures.length === 0 && j.room === '114', JSON.stringify(j).slice(0, 300))
  ok('inspo route: refused without the secret or a session, and a project is required', (await fetch(app + '/api/inspo?project_id=' + DEU)).status === 401 && (await fetch(app + '/api/inspo', { headers: SECRET })).status === 400 && (await fetch(app + '/api/inspo?project_id=nope', { headers: SECRET })).status === 404)
  // "Read the picture again": with no vision key the analysis fails, the page says so and nothing is changed
  const RP = '/projects/' + DEU + '/rooms/r-d103'
  let html9 = await page(RP)
  const h9 = form(html9, (f) => f.includes('Read the picture again') && f.includes('value="i3"'), 'read-again form')
  const before9 = await getDb()
  const r9 = await post(RP, h9)
  const db9 = await getDb()
  const pic = (d) => d.intent_inspo_images.find((x) => x.id === 'i3')
  ok('read the picture again: a failed reading sends the person back with the reason and leaves the picture as it was', r9.status === 303 && r9.location.includes(RP + '?pic=failed#inspo') && same(pic(db9), pic(before9)), JSON.stringify(r9))
  html9 = (await page(RP + '?pic=failed')).replace(/<!-- -->/g, '')
  ok('read the picture again: the page says the picture could not be read and still lists what was read before', html9.includes('The picture could not be read') && html9.includes('What was listed before is unchanged') && html9.includes('island with seating on one side'))
  res = await fetch(app + '/api/analyze-image', { method: 'POST', headers: SECRET, body: JSON.stringify({ image_id: 'i3' }) })
  ok('analyze-image: without a vision key the route answers 502 and writes nothing; an unknown picture is 404', res.status === 502 && same(pic(await getDb()), pic(before9)) && (await fetch(app + '/api/analyze-image', { method: 'POST', headers: SECRET, body: JSON.stringify({ image_id: 'nope' }) })).status === 404)
}

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

// the lists of texts on the sheet checks (flag 81, A98): the sheet list and the tag families, one row per entry, each row names its
// source and a row that is Blueprint's reading is marked; only Mitch or Michael change, add or remove an entry, the check keeps its
// status; the last entry cannot be removed; accepting the check keeps the marking of an untouched row and says who adopted it
const setRule = ruleOf(await getDb(), 'sheet.set_matches_stage')
const tagRule = ruleOf(await getDb(), 'sheet.tags_text_only')
const sheetNotes = (h) => (seen(h).match(/section Sheet index/g) || []).length
const tagNotes = (h) => (seen(h).match(/section Tags and schedules/g) || []).length
const LBTN = (v) => 'value="' + v + '" class="btn-secondary-sm" name="list_step"'
html = await pageAs(MC, asBlueprint)
ok('lists, non-approver: sees the three sheets and the two tag families with their source, has no field', seen(html).includes('A107.*') && seen(html).includes('A100.3?') && seen(html).includes('Window Tag - Text Only') && sheetNotes(html) === 3 && tagNotes(html) === 2 && !html.includes('name="entry"') && !html.includes('Add sheet') && !html.includes('Add family'), '')
html = (await page(MC)).replace(/<!-- -->/g, '')
const entForm = (list, entry, id) => form(html, (f) => f.includes('name="list" value="' + list + '"') && f.includes('name="entry" value="' + entry + '"') && f.includes('value="' + id + '"'), 'entry form (' + entry + ')')
const sheetA100 = entForm('sheet_list', 'A100', setRule.id)
const sheetA107 = entForm('sheet_list', 'A107.*', setRule.id)
const tagDoor = entForm('tag_families', 'Door Tag - Text Only', tagRule.id)
const tagWindow = entForm('tag_families', 'Window Tag - Text Only', tagRule.id)
const addSheet = form(html, (f) => f.includes(LBTN('add')) && f.includes('name="list" value="sheet_list"') && f.includes('value="' + setRule.id + '"'), 'add-sheet form')
const addFamily = form(html, (f) => f.includes(LBTN('add')) && f.includes('name="list" value="tag_families"') && f.includes('value="' + tagRule.id + '"'), 'add-family form')
const setDecide = form(html, (f) => f.includes('name="decision"') && f.includes('value="' + setRule.id + '"'), 'decide form (sheet.set_matches_stage)')
ok('lists, approver: eighteen rows on six checks (three sheets, two tag families, two countertop names, two exterior finish words, two outside Departments, two riser words, two tread words, two eave words, one grade word), each with its entry in a field and, unless it is the only entry of its list, a Remove button, and one field per list to add an entry; a marked row is told from a stated one', (html.match(/name="entry"/g) || []).length === 18 && (html.split(LBTN('remove')).length - 1) === 17 && (html.split(LBTN('add')).length - 1) === 9 && (html.split(LBTN('change')).length - 1) === 18 && (html.match(/name="list" value="eave_words"/g) || []).length === 3 && (html.match(/name="list" value="grade_words"/g) || []).length === 2 && seen(html).includes('Eave words: the words an eave height is written with') && seen(html).includes('Grade words: the words a height from grade is written with') && (html.match(/name="list" value="riser_words"/g) || []).length === 3 && (html.match(/name="list" value="tread_words"/g) || []).length === 3 && seen(html).includes('Riser words: the words a riser count is written with') && (html.match(/name="list" value="counter_names"/g) || []).length === 3 && (html.match(/name="list" value="exterior_finish_words"/g) || []).length === 3 && (html.match(/name="list" value="outside_departments"/g) || []).length === 3 && seen(html).includes('Outside Departments: the Departments of the rooms an exterior finish may face') && sheetA100.entry === 'A100' && sheetA107.list === 'sheet_list' && tagDoor.list === 'tag_families' && !('entry' in addSheet) && !('entry' in addFamily) && seen(html).includes('starting list; nobody has changed an entry') && seen(html).includes('not reviewed. From the graphic standard, section Sheet index. The * is'), JSON.stringify([sheetA100, sheetA107, tagDoor, addSheet, addFamily]))
before = await getDb()
r = await postAs(MC, sheetA100, { list_step: 'change', value: 'A200' }, asBlueprint)
r2 = await postAs(MC, addFamily, { list_step: 'add', value: 'Door Tag' }, asBlueprint)
ok('lists, non-approver posts an entry: refused, nothing changed', r.location.includes('Only Mitch or Michael can change a list on a check') && r2.location.includes('Only Mitch or Michael can change a list on a check') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2]))
let badEntries = []
for (const bad of ['', '*', '?', 'A1*7', 'A100?*', 'A'.repeat(41)]) {
  for (const step of ['change', 'add']) {
    r = await post(MC, step === 'add' ? addSheet : sheetA100, { list_step: step, value: bad })
    if (!r.location.includes('A sheet entry is a sheet number')) badEntries.push([step, bad])
  }
}
r = await post(MC, addFamily, { list_step: 'add', value: 'a'.repeat(121) })
ok('lists: blank, a bare * or ?, a * inside, ? before * and an over-long entry are refused, nothing changed', badEntries.length === 0 && r.location.includes('A tag family is its name as Revit shows it') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([badEntries, r]))
r = await post(MC, sheetA100, { list_step: 'change', value: ' A100 ' })
r2 = await post(MC, addSheet, { list_step: 'add', value: ' a107.* ' })
r3 = await post(MC, tagDoor, { list_step: 'change', value: 'WINDOW TAG -  TEXT ONLY' })
ok('lists: the same entry, and an entry the check already lists (in any case, with any spacing), change nothing', r.location.includes('already lists A100') && r2.location.includes('already lists A107.*') && r3.location.includes('already lists Window Tag - Text Only') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2, r3]))
r = await post(MC, { ...sheetA100, entry: 'A999' }, { list_step: 'change', value: 'A200' })
r2 = await post(MC, { ...sheetA100, entry: 'A999' }, { list_step: 'remove' })
ok('lists: an entry the check does not list cannot be changed or removed', r.location.includes('does not list "A999"') && r2.location.includes('does not list "A999"') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2]))
r = await post(MC, { ...addSheet, rule_id: shellRule.id }, { list_step: 'add', value: 'A200' })
r2 = await post(MC, { ...addSheet, list: 'tag_families' }, { list_step: 'add', value: 'Door Tag' })
r3 = await post(MC, { ...addSheet, list: 'texture_folders' }, { list_step: 'add', value: 'H:\\x' })
const r4 = await post(MC, sheetA100, { list_step: 'empty', value: 'A200' })
ok('lists: a check without that list refuses a posted entry; a list the app does not know and an unknown step change nothing', r.location.includes('carries no list of that kind') && r2.location.includes('carries no list of that kind') && r3.location.includes('Nothing was changed') && r4.location.includes('Nothing was changed') && same((await getDb()).intent_model_rules, before.intent_model_rules), JSON.stringify([r, r2, r3, r4]))
r = await post(MC, addSheet, { list_step: 'add', value: '  A108.* ' })
db = await getDb()
row = ruleOf(db, 'sheet.set_matches_stage')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('lists, approver adds a sheet: saved at the end of the list, version up, status kept, the three rows and their notes untouched, Blueprint told', r.location.includes('saved=sheet.set_matches_stage: sheet added, A108.*') && same(row.params.sheet_list, ['A100', 'A100.3?', 'A107.*', 'A108.*']) && ['A100', 'A100.3?', 'A107.*'].every((k) => row.params.sheet_list_source[k] === setRule.params.sheet_list_source[k]) && row.params.initial === false && row.version === setRule.version + 1 && row.status === setRule.status && row.params_by === 'mitch@barnhaus.test' && !!row.params_at && lastMsg.includes('Model check sheet added: `sheet.set_matches_stage`') && lastMsg.includes('A108.*') && lastMsg.includes('its list now has 4 entries') && lastMsg.includes('This is a notice, not a go'), JSON.stringify([r, row.params, lastMsg]))
ok('lists: the added sheet says a person added it and that no standard names it', row.params.sheet_list_source['A108.*'].startsWith('Added on this page by mitch@barnhaus.test on ') && row.params.sheet_list_source['A108.*'].includes('No standard document names this sheet'), JSON.stringify(row.params.sheet_list_source))
r = await post(MC, sheetA107, { list_step: 'change', value: 'A107.1*' })
db = await getDb()
row = ruleOf(db, 'sheet.set_matches_stage')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('lists, approver changes a marked sheet: saved in its place, version up, the old entry and its note gone, the new note says who and from what and keeps the marking of the first value', r.location.includes('saved=sheet.set_matches_stage: sheet changed to A107.1*') && same(row.params.sheet_list, ['A100', 'A100.3?', 'A107.1*', 'A108.*']) && !('A107.*' in row.params.sheet_list_source) && row.params.sheet_list_source['A107.1*'].startsWith('Changed on this page by mitch@barnhaus.test on ') && row.params.sheet_list_source['A107.1*'].includes(', from "A107.*" to "A107.1*". Source of the first value: Blueprint\'s reading, not reviewed.') && row.version === setRule.version + 2 && row.status === 'proposed' && lastMsg.includes('Model check sheet changed: `sheet.set_matches_stage`') && lastMsg.includes('A107.* → A107.1*'), JSON.stringify([r, row.params, lastMsg]))
res = await fetch(app + '/api/model-rules?status=all', { headers: SECRET })
mr = (await res.json()).rules.find((x) => x.rule_key === 'sheet.set_matches_stage')
ok('api model-rules: the sheet list is what the checker reads, with the note of each entry', same(mr.params.sheet_list, ['A100', 'A100.3?', 'A107.1*', 'A108.*']) && same(Object.keys(mr.params.sheet_list_source).sort(), ['A100', 'A100.3?', 'A107.1*', 'A108.*']) && mr.version === setRule.version + 2 && mr.checker_status === 'tool' && mr.status === 'proposed' && mr.params_by === 'mitch@barnhaus.test', JSON.stringify(mr))
r = await post(MC, setDecide, { decision: 'accept', note: 'Sheets as shown' })
row = ruleOf(await getDb(), 'sheet.set_matches_stage')
ok('lists, approver accepts the check: the marked row nobody changed keeps its marking and says who adopted it; the stated, the changed and the added row are left as they were', r.location.includes('saved=sheet.set_matches_stage accepted') && row.status === 'accepted' && row.decided_by_email === 'mitch@barnhaus.test' && row.params.sheet_list_source['A100.3?'].startsWith("Blueprint's reading, not reviewed.") && row.params.sheet_list_source['A100.3?'].includes('Accepted as shown by mitch@barnhaus.test on ') && row.params.sheet_list_source.A100 === setRule.params.sheet_list_source.A100 && row.params.sheet_list_source['A107.1*'].startsWith('Changed on this page by ') && !row.params.sheet_list_source['A107.1*'].includes('Accepted as shown') && row.params.sheet_list_source['A108.*'].startsWith('Added on this page by ') && !row.params.sheet_list_source['A108.*'].includes('Accepted as shown') && same(row.params.sheet_list, mr.params.sheet_list), JSON.stringify([r, row]))
r = await post(MC, { ...sheetA100, entry: 'A108.*' }, { list_step: 'remove' })
db = await getDb()
row = ruleOf(db, 'sheet.set_matches_stage')
lastMsg = db.portal_messages[db.portal_messages.length - 1].content
ok('lists, approver removes a sheet from the accepted check: gone with its note, the check stays accepted, Blueprint told', r.location.includes('sheet removed, A108.*') && same(row.params.sheet_list, ['A100', 'A100.3?', 'A107.1*']) && same(Object.keys(row.params.sheet_list_source).sort(), ['A100', 'A100.3?', 'A107.1*']) && row.status === 'accepted' && lastMsg.includes('Model check sheet removed: `sheet.set_matches_stage`') && lastMsg.includes('the check is accepted; its list now has 3 entries'), JSON.stringify([r, row.params, lastMsg]))
r = await post(MC, tagWindow, { list_step: 'remove' })
before = await getDb()
r2 = await post(MC, tagDoor, { list_step: 'remove' })
db = await getDb()
row = ruleOf(db, 'sheet.tags_text_only')
html = (await page(MC)).replace(/<!-- -->/g, '')
ok('lists: a tag family is removed; the last one cannot be, and the page offers no Remove for it', r.location.includes('tag family removed, Window Tag - Text Only') && r2.location.includes('would have no tag family left and could not be run') && same(db.intent_model_rules, before.intent_model_rules) && same(row.params.tag_families, ['Door Tag - Text Only']) && same(Object.keys(row.params.tag_families_source), ['Door Tag - Text Only']) && row.status === tagRule.status && (html.match(/name="entry"/g) || []).length === 17 && (html.split(LBTN('remove')).length - 1) === 15, JSON.stringify([r, r2, row.params]))
ok('lists: the page shows the adoption, the changed row and who changed a list', seen(html).includes('Accepted as shown by mitch@barnhaus.test on ') && seen(html).includes(', from "A107.*" to "A107.1*"'.replace(/"/g, '&quot;')) && html.includes('list changed by Mitch') && sheetNotes(html) === 3 && tagNotes(html) === 1, '')

// ---- a push never drops a row without a word (SPEC A123; 2026-11-12: 114 of 200 lines of one push vanished) ----
const vocabG = await (await fetch(app + '/api/vocabulary', { headers: SECRET })).json()
ok('api vocabulary: lists the sources a pushed decision may carry', same(vocabG.decision_sources, ['transcript', 'redline', 'inspo', 'default', 'manual']), JSON.stringify(vocabG.decision_sources))
const pushG = async (rooms) => {
  const r0 = await fetch(app + '/api/prefill', { method: 'POST', headers: SECRET, body: JSON.stringify({ project: { name: 'Guard Push' }, rooms }) })
  return { status: r0.status, body: await r0.json() }
}
let g = await pushG([
  { section_code: '301', name: 'Kitchen',
    decisions: [
      { topic: 'island', value: '84 x 42', source: 'redline' },
      { topic: 'hood', value: 'Plaster', source: 'model_note', source_ref: 'note 12' },
      { topic: 'floor', value: 'Oak', source: 'review' },
      { topic: 'no value' },
      { topic: 'sink', value: 'Undermount' },
    ],
    open_questions: [{ question: 'Pot filler?' }, { question: '' }],
    redline_notes: [{ note_type: 'beam', text: 'Beam here' }, { note_type: 'note', text: '' }] },
  { section_code: '', name: 'No number', decisions: [{ topic: 'a', value: 'b' }], redline_notes: [{ note_type: 'note', text: 'lost with its room' }] },
])
db = await getDb()
const GP = g.body.project_id
const ofG = (t) => db[t].filter((x) => x.project_id === GP)
let ni = g.body.not_inserted || {}
ok('push: lines with a source the app does not know are not stored, the rest is, and the reply counts every row that is missing', g.status === 200 && g.body.ok === true && g.body.complete === false && g.body.rooms === 1 && g.body.decisions.inserted === 2 && g.body.open_questions === 1 && g.body.redline_notes === 1 && same([ni.rooms, ni.decisions, ni.open_questions, ni.redline_notes], [1, 4, 1, 2]) && same(ofG('intent_decisions').map((d) => d.source).sort(), ['redline', 'transcript']) && ofG('intent_rooms').length === 1 && ofG('intent_open_questions').length === 1 && ofG('intent_redline_notes').length === 1, JSON.stringify(g.body))
ok('push: the reply gives the reason per row (the unknown source by name, with what the database said) and names every redline note that is missing', (ni.first || []).length === 6 && same(ni.first[0], { room: '301', what: 'decision', row: 'hood: Plaster', reason: 'the source "model_note" is not one the app knows (transcript, redline, inspo, default, manual). The database said: new row for relation "intent_decisions" violates check constraint "intent_decisions_source_check"' }) && ni.first[1].reason.includes('"review" is not one the app knows') && same(ni.first[2], { room: '301', what: 'decision', row: 'no value', reason: 'a decision needs a topic and a value' }) && ni.first[3].what === 'open question' && ni.first[4].what === 'redline note' && same(ni.first[5], { room: '', what: 'room', row: 'No number', reason: 'a room needs a number (section_code) and a name' }) && same(ni.redline_notes_failed, [{ room: '301', index: 1 }, { room: '', index: 0 }]), JSON.stringify(ni))
// the same lines again: nothing is doubled, and what is already there is counted as such
g = await pushG([{ section_code: '301', name: 'Kitchen', decisions: [{ topic: 'island', value: '84 x 42', source: 'redline' }, { topic: 'sink', value: 'Undermount' }], open_questions: [{ question: 'Pot filler?' }] }])
db = await getDb()
ni = g.body.not_inserted || {}
ok('push: a second push of the same lines is complete; what was already there is counted, nothing is doubled', g.body.complete === true && g.body.decisions.inserted === 0 && g.body.decisions.skipped_duplicate === 2 && g.body.open_questions === 0 && g.body.open_questions_skipped_duplicate === 1 && same([ni.rooms, ni.decisions, ni.open_questions, ni.redline_notes], [0, 0, 0, 0]) && same(ni.first, []) && same(ni.redline_notes_failed, []) && ofG('intent_decisions').length === 2 && ofG('intent_open_questions').length === 1, JSON.stringify(g.body))
// a row the database refuses for a reason the app cannot foresee: an open question, a redline note, a whole room
await setMode({ refuseInsert: 'intent_open_questions' })
g = await pushG([{ section_code: '301', name: 'Kitchen', open_questions: [{ question: 'Second sink?' }] }])
await setMode({ refuseInsert: 'intent_redline_notes' })
const g2 = await pushG([{ section_code: '301', name: 'Kitchen', redline_notes: [{ note_type: 'note', text: 'Keep the window' }] }])
await setMode({ refuseInsert: 'intent_rooms' })
const g3 = await pushG([{ section_code: '302', name: 'Pantry', decisions: [{ topic: 'shelves', value: 'Five' }], open_questions: [{ question: 'Door?' }], redline_notes: [{ note_type: 'note', text: 'x' }] }])
await setMode({ refuseInsert: '' })
db = await getDb()
ok('push: a refused open question, a refused redline note and a refused room are each reported with what the database said; a refused room takes its lines with it', g.body.complete === false && g.body.not_inserted.open_questions === 1 && g.body.not_inserted.first[0].what === 'open question' && g.body.not_inserted.first[0].row === 'Second sink?' && g.body.not_inserted.first[0].reason.includes('check constraint') && g2.body.complete === false && g2.body.not_inserted.redline_notes === 1 && same(g2.body.not_inserted.redline_notes_failed, [{ room: '301', index: 0 }]) && g3.body.ok === true && g3.body.rooms === 0 && same([g3.body.not_inserted.rooms, g3.body.not_inserted.decisions, g3.body.not_inserted.open_questions, g3.body.not_inserted.redline_notes], [1, 1, 1, 1]) && g3.body.not_inserted.first.length === 1 && g3.body.not_inserted.first[0].reason.startsWith('the room was not stored: ') && ofG('intent_rooms').length === 1 && ofG('intent_open_questions').length === 1 && ofG('intent_redline_notes').length === 1, JSON.stringify([g.body, g2.body, g3.body]))

// 2D push: the reply says what the app holds after the push (Tony 2026-11-12: the guard the board push got). The picture is
// named by its storage path, so nothing is uploaded; the vision check runs in the background and is not judged here.
const oGeom = { units: 'in', extent: { w: 120, h: 96 }, elements: [{ id: 'a', kind: 'counter', x: 0, y: 0, w: 60, h: 24 }, { id: 'b', kind: 'walkway', x: 0, y: 30, w: 60, h: 40 }] }
const oPush = async () => { const x = await fetch(app + '/api/push-outline', { method: 'POST', headers: SECRET, body: JSON.stringify({ project_id: SP, room: '201', outline: { type: 'plan', label: 'Guard test', storage_path: 'smoke/guard.png', geometry: oGeom, pushed_by: 'blueprint' } }) }); return { status: x.status, j: await x.json().catch(() => null) } }
const o1 = await oPush()
db = await getDb()
ok('2D push: the reply says complete, how many elements the app holds and that the math result is saved', o1.status === 200 && o1.j.complete === true && same(o1.j.not_stored, []) && o1.j.stored.elements === 2 && o1.j.stored.sent_elements === 2 && o1.j.stored.math_saved === true && o1.j.stored.status === 'pushed' && o1.j.project_id === SP && db.intent_outlines.find((x) => x.id === o1.j.outline_id).geometry.elements.length === 2, JSON.stringify(o1.j).slice(0, 500))
const o2 = await oPush()
db = await getDb()
ok('2D push again with the same label: the earlier drawing is superseded and the reply is still complete', o2.status === 200 && o2.j.complete === true && o2.j.superseded === 1 && db.intent_outlines.find((x) => x.id === o1.j.outline_id).status === 'superseded' && db.intent_outlines.find((x) => x.id === o2.j.outline_id).status === 'pushed', JSON.stringify(o2.j).slice(0, 400))
await new Promise((r) => setTimeout(r, 1500)) // let the background vision attempt finish before the mock is asked what it did not understand

const unknown = await (await fetch(mock + '/__unknown')).json()
ok('mock understood every request', unknown.length === 0, unknown.join(' ; '))
console.log(fails ? 'ACTIONS FAILED: ' + fails : 'ACTIONS PASS')
process.exit(fails ? 1 : 0)
