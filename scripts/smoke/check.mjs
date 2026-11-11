// Fetches every page as a signed-in user against the mock backend and checks the
// rendered text. node scripts/smoke/check.mjs <appUrl> <mockUrl> <outDir>
import fs from 'node:fs'

const [app, mock, out] = process.argv.slice(2)
const b64u = (s) => Buffer.from(s).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 86400 * 30
const user = { id: 'user-mitch', aud: 'authenticated', role: 'authenticated', email: 'mitch@barnhaus.test', app_metadata: {}, user_metadata: {} }
const jwt = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp, email: user.email })) + '.c2ln'
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'mock-refresh', user }
const cookie = 'sb-127-auth-token=base64-' + b64u(JSON.stringify(session))

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const W = '/projects/p-whitaker', D = '/projects/p-deubner'
const pages = [
  ['inbox', '/', 200, ['Lessons to accept (2)', 'Review lessons', 'Read every edit back after a write batch', 'Inbox', 'Waiting on you (2)', 'Review 3 rooms', 'Re-emit the contract (v2)', 'contract out of date', '2D outlines to review (2)', '1 rule failed', '1 decision contradicted', 'Checking decisions', 'Blocking questions (1)', 'Floating shelves or uppers', 'Waiting on Blueprint (2)', 'Build in progress', 'Waiting on the room board', 'Complete (1)'], ['Banks — ']],
  ['projects', '/projects', 200, ['Projects', 'Deubner', 'Whitaker', 'Mann', 'Schwan', 'Banks', 'Waiting on you', 'Waiting on Blueprint', 'Complete', '+ New project']],
  ['project-deubner', D, 200, ['Deubner family', 'Review 3 rooms', '1/4 rooms reviewed · 1 blocking question · 2 unassigned images', 'Inspo images (2 unassigned)', 'Lock & Emit', 'Rooms (4)', 'Bath 2', '1 blocking question', 'Delete this project', 'Type the project name'], ['out of date', 'Mark build']],
  ['project-whitaker', W, 200, ['Contract v1 is out of date', '1 item was added after it was locked', 'Re-emit the contract (v2)', 'contract v1 · out of date', '2D 1/2', '1 to review', '1/3 rooms approved']],
  ['project-mann', '/projects/p-mann', 200, ['Waiting on the room board', 'Generate standard room set', 'No rooms yet']],
  ['project-schwan', '/projects/p-schwan', 200, ['Build in progress', 'Mark build complete', '1/1 rooms approved'], ['Mark build started']],
  ['project-banks', '/projects/p-banks', 200, ['Complete', 'Nothing left to do']],
  ['room-2d', W + '/rooms/r-wb3', 200, ['/storage/v1/object/sign/intent-outlines/', 'token=mock-3600', '2D review', 'To review (1)', 'Zone map', 'awaiting review', '1 rule failed', 'rulebook v2', 'drawn 38"', 'needs ≥ 42"', 'Island ↔ Range', '1 passed', '1 had nothing to measure here', '1 decision contradicted', 'decision says 96x48 but drawn island is 84x42', '1 not shown in this drawing', '2 confirmed', '1 not something a drawing can show', 'Why is this OK despite the failed rule?', 'Approve anyway (1 failed rule)', 'Reject and send back', 'Approved (1)', 'Approved despite a failed rule', 'Client is 6 ft 4', '1 rejected draft waiting on a redraw', 'Soffit should stop at the beam', '1 earlier version was replaced by redraws', 'Next to review: B2 Great Room / Living', 'In the model now: 402 SF'], ['What gets built here', 'Mark room 2D approved']],
  ['room-decide', W + '/rooms/r-wb3?view=decide', 200, ['What gets built here', '2 decided', '96 x 48 island', 'Plaster hood, no wood', 'built from defaults', 'spice pullouts both sides of range', 'Override', 'Change', 'Add a line to this topic', 'Each line is changed or removed on its own', 'Open questions', 'Redline notes from the Draft 1 markup', 'For the typed contract', 'room not set · 2 lines without a kind', 'What this room is — suggested from its name, not saved yet', 'Gets 2D drawings before it is built — suggested, not saved yet', 'Nothing is saved until you press Save', 'no kind of work yet', 'Set the kind of work for the 1 line without one'], ['To review (1)', 'hood all-wood including neck', 'replaces all', 'Remove this line', 'Nothing missing in this room']],
  ['room-running', W + '/rooms/r-wb2', 200, ['To review (1)', 'Checking decisions…', '1 rule passed', 'Approve this drawing'], ['Approve anyway']],
  ['room-2d-approved', W + '/rooms/r-wb5', 200, ['✓ 2D approved', 'Reopen', 'Reopening discards', 'Approved (1)', 'Decision check skipped'], ['unreviewed', 'Mark room 2D approved']],
  ['room-intake', D + '/rooms/r-d103', 200, ['/storage/v1/object/sign/intent-inspo/', 'What gets built here', 'In the model now: 386 SF · windows: 3 · island: true · casework runs: 6', '84 x 42 island', 'Full-height slab behind the range only', 'Subway tile to the uppers', 'transcript · 11/06 14:22 · 2026-11-06', 'Floating shelves or uppers', 'blocking', 'Use the default', 'Default if unanswered: Uppers to 10 ft', 'Yes, centred on the range', 'Beam, not a wall', 'A101.1', 'Next unreviewed: 114 Bath 2', 'none yet'], ['To review']],
  ['room-2d-empty', D + '/rooms/r-d103?view=2d', 200, ['No 2D drawings yet']],
  // one line open for editing: exactly that line gets the editor; a removed line and an emptied topic stay listed
  ['room-edit-line', D + '/rooms/r-d103?view=decide&edit=d8', 200, ['New wording for this line', 'Save — replaces this line only', 'Remove this line', 'It stays listed, crossed out, and can be put back', 'Cancel', 'Trash pullout at the sink, right side', '3 lines', 'Wine fridge under the bar end', 'removed · not built', 'Put back', 'pot rack', 'all removed', 'Hanging pot rack over the island', 'Subway tile to the uppers', 'replaced · 2026-10-30 · transcript'], ['replaces all']],
  ['room-edit-gone', D + '/rooms/r-d103?view=decide&edit=d10', 200, ['Wine fridge under the bar end', 'Put back'], ['New wording for this line', 'Remove this line']],
  ['checks', '/rulebook/checks', 200, ['Rulebook', 'Checks', 'Defaults', 'Standards', '8 active rules · rulebook v2', 'Every island keeps at least 42 in clear of any counter, appliance, fridge, range or tall cabinet.', 'Kitchen, Butler Pantry · plans', 'No soffit is more than 18 in tall (deep, on a plan).', 'All rooms · elevations and sections', 'The bottom of every upper cabinet sits 54 in above the finished floor (± 1 in).', 'At least 1 tub is drawn.', 'Turn off', 'Turn on', 'edited as raw JSON', 'Every fridge, range and dishwasher keep at least 3 in clear of each other.', 'Add a rule', 'Pick the kind of rule to start', 'Rulebook history', '“Bath” does not cover “Bath 2”'], ['params (JSON — see examples below)']],
  ['checks-new', '/rulebook/checks?new=min_clearance', 200, ['Bath covers Bath 2', 'Bath does not cover Master Bath', 'Something must stay a minimum distance clear of other things', 'Which rooms', 'Which drawings', 'Add rule']],
  ['checks-saved', '/rulebook/checks?saved=x', 200, ['Saved — the rulebook is now v2', 'Drawings awaiting review are re-checked against the new rulebook when a rule changes'], ['keep their earlier result']],
  ['checks-saved-rechecked', '/rulebook/checks?saved=x&rechecked=2&changed=1&approved=1&told=1', 200, ['2 drawings awaiting review were re-checked against it: 1 result changed. They are in the Inbox.', '1 approved drawing would fail the new rulebook; it stays approved. Reopen the room if it needs another look.', 'Blueprint has been told.']],
  ['checks-saved-none', '/rulebook/checks?saved=x&rechecked=0&changed=0&approved=0', 200, ['No drawings are awaiting review, so nothing needed re-checking.'], ['Blueprint has been told', 'would fail the new rulebook']],
  ['checks-saved-failed', '/rulebook/checks?saved=x&recheck_failed=1', 200, ['could NOT be re-checked']],
  ['defaults', '/rulebook/defaults', 200, ['Whole house', '(22)', 'spice pullouts both sides of range', 'Baths (and the master suite)', 'You can change this list', 'where the two differ, this list wins', 'Change', '+ Add a default', 'changed by Michael', 'Turned off', 'pot filler', 'Turn back on', 'Changes', 'Counter Top = Quartz', 'Marble on every job now', 'turned off (was: none unless asked for)'], ['cannot be edited here yet', 'Only Mitch or Michael can change this list', 'could not be read', 'Save default']],
  ['defaults-edit', '/rulebook/defaults?edit=def-4', 200, ['What gets built for “hood” when nobody decides', 'Save default', 'Turn this default off', 'Cancel']],
  ['defaults-saved', '/rulebook/defaults?saved=hood', 200, ['Saved: hood. Rooms that have no decision on it now show the new default. Blueprint has been told.']],
  ['blueprint-defaults-feed', '/blueprint?show=default', 200, ['Default changed: counter material', 'Was: Counter Top = Quartz — now: Counter Top = Marble 05', 'by Michael', 'Default turned off: pot filler', 'by Mitch', 'Open defaults'], ['Runbook → version', 'Lesson accepted']],
  ['standards', '/rulebook/standards', 200, ['Process', 'Modeling', 'D1 → D2 Runbook', 'Design Build Standard', 'Version 3', 'History', 'pushed by Blueprint', 'edited in the app', 'Room numbering pass moved early (Mitch 11/10)', 'What changed', 'Restore', 'Edit this document', 'Save as version 4'], ['What changed in version']],
  ['standards-diff-2', '/rulebook/standards?doc=d1-to-d2-runbook&compare=2', 200, ['What changed in version 2', '+3 lines', '−0 lines', '+ A line that only existed in version 2.', 'unchanged lines']],
  ['standards-diff-3', '/rulebook/standards?doc=d1-to-d2-runbook&compare=3', 200, ['What changed in version 3', '+0 lines', '−1 lines', '− A line that only existed in version 2.']],
  ['standards-diff-1', '/rulebook/standards?doc=d1-to-d2-runbook&compare=1', 200, ['What changed in version 1 (first recorded version)']],
  ['standards-other', '/rulebook/standards?doc=design-build-standard', 200, ['Design Build Standard', 'Version 1', 'Save as version 2']],
  ['blueprint', '/blueprint', 200, ['What changed', 'Lessons', '2 to accept', 'Lesson accepted: No built-in backsplash on any countertop', 'D1 → D2 Runbook → version 3', 'Removed a stray line', 'done in the app', 'pushed by Blueprint', 'Checks rulebook → version 2', 'Whitaker — contract v1 locked', 'Not recorded here yet']],
  ['blueprint-checks', '/blueprint?show=checks', 200, ['Checks rulebook → version 2'], ['Runbook → version']],
  ['capabilities', '/blueprint/capabilities', 200, ['Capabilities', 'the app never talks to a bridge', 'Machines', 'Mitch', 'Michael', 'f98f724', '8eb2a8b', 'Revit 2025', 'Last confirmed', 'before that: 8eb2a8b', 'The machines are on different bridge builds (Michael 8eb2a8b, Mitch f98f724)', 'create_family_box (not on Michael)', 'rehost_element (not on Michael)', 'Commands', 'save_document', 'proven = run on a live model and checked', 'Deubner D2, saved and reopened', 'Save the active document.', 'all proven', 'none proven yet', 'differs between machines', '2 commands on the list do not act. No work order may call them.', 'stub: returns success, no effect : boolean_union', 'listed, dispatch disabled : create_text_type', 'Read from the bridge source at build f98f724, not by calling them.', '1 does not act', 'Gap log — open (1)', 'Deleting several elements in one call reports success without deleting', 'Done instead:', 'Delete one at a time', 'Logged by Blueprint', 'Patel', 'Close gap', '+ Add a gap yourself', 'Closed (1)', 'Closed by Mitch', 'Fixed in build f98f724', 'Reopen'], ['No report yet', 'not seen lately', 'get_render_settings', 'Not read again on the build now running']],
  ['blueprint-bridge-feed', '/blueprint?show=bridge', 200, ['Bridge on Mitch → build f98f724', 'Bridge on Michael → build 8eb2a8b', 'reported by Blueprint', 'Open capabilities'], ['Runbook → version', 'Lesson accepted']],
  ['blueprint-lessons-feed', '/blueprint?show=lesson', 200, ['Lesson accepted: No built-in backsplash on any countertop', 'accepted by Michael', 'Lesson retired: Schedules on the plan sheet', 'retired by Mitch', 'Lesson accepted: Schedules on the plan sheet', 'What changed', '2 to accept'], ['Runbook → version', 'Ask before every save', 'Read every edit back']],
  ['lessons', '/blueprint/lessons', 200, ['Only Mitch or Michael can accept, dismiss or retire a lesson', 'To accept (2)', 'Read every edit back after a write batch', 'What happened', 'What Blueprint would do from now on', 'Proposed by Blueprint', 'Whitaker', 'Rule as accepted', 'Accept', 'Dismiss', 'Accepted (1)', 'Countertops are slab-only. A backsplash is always its own element', 'Accepted by Michael', 'reworded on accept', 'Applies to every project', 'Retire', 'Dismissed and retired (2)', 'Dismissed by Mitch', 'I am not the save button', 'Retired by Mitch', '+ Add a lesson yourself'], ['read-only for decisions', 'Waiting on Mitch or Michael']],
  ['emit', W + '/emit', 200, ['Lock Gates', 'Emission History', 'Typed contract (v2)', '8 things missing — the typed contract will not be written yet', 'Room B3 Kitchen: no role chosen', 'Room B3 Kitchen: nobody has said whether it gets 2D drawings', 'no kind of work chosen', 'This does not block Lock & Emit', 'no typed contract', 'Model checks: 1 accepted, 39 waiting to be accepted.', 'Only accepted checks are attached to work items and decide whether a build phase passed.']],
  // contract v2: the model-check registry and the vocabulary
  ['model-checks', '/rulebook/model-checks', 200, ['Model checks', '1 accepted · 39 to accept · 1 retired', 'You can accept, dismiss or retire a check', 'To accept (39)', 'Where a check carries a number, such as a tolerance, you can change it here', 'name="param" value="tolerance_ft"', 'name="param" value="tolerance_in"', 'name="param" value="host_search_margin_in"', 'Host search margin', 'is in the wall the approved drawing puts it in', 'the check is reported as not run, never as passed', 'Save number', 'starting value; nobody has changed the number', 'Accepted (1)', 'No countertop has a built-in backsplash.', 'counter.no_builtin_splash', 'attached to: casework.counter', 'checked by a one-project script', 'no checker written yet', 'accepted by Michael', 'Retired or dismissed (1)', 'Covered by the final QA check', 'Put back as proposed', '+ Propose a check']],
  ['kinds', '/rulebook/kinds', 200, ['Kinds of work', 'one of these 35 kinds of work', '31 of 35 kinds are locked (bridge build f98f724)', 'Locked does not mean a command has been run', 'The other 4 are drafts, each with the reason', 'The bridge has no named ceiling command.', '8 kinds are built by a', 'Recipe: A driveway or pad is cut out of the terrain', 'ran on Patel, 2026-11-10: driveway piece split from the terrain', '1 kind has no way to be built yet', 'Recipe: One ceiling per room', 'ran on Whitaker, 2026-11-09: build phase P8A done', 'pinned to: an existing element in the model', 'pinned to: a drawn position on the approved 2D', 'pinned to: nothing single (house-wide or room-wide work)', 'You can change it here.', 'Changing a stair run is done by a recipe that ran on Patel', 'no way yet', 'proven', 'One command it names, editing a sketch outline, is believed broken on this build.', 'bridge: rehost_element', 'bridge: export_pdf_by_sheet_set', 'locked', 'draft', '3 kinds belong to a later draft stage', 'casework.counter', 'plumbing.sink', 'structure.resize', 'later stage', 'Not a kind of work: context', 'They are never built and never sent to a build phase', 'Room roles (34)', 'game room', 'golf room (= game room)'], ['Every kind is locked', 'Recipe found, not adopted', 'Not proven: ', 'has not been checked against a live Revit bridge', 'the bridge has no command that creates a ceiling', 'boolean_subtract', 'create_void', 'export_pdf,']],
  ['images', D + '/images', 200, ['Unassigned (2)', 'Walnut island with waterfall edge', '/storage/v1/object/sign/intent-inspo/', 'token=mock-3600', 'Upload inspo images'], ['image unavailable']],
  ['redirect-rules', '/rules', 307, []],
  ['redirect-standards', '/standards?doc=d1-to-d2-runbook', 307, []],
  ['redirect-rulebook', '/rulebook', 307, []],
  ['missing-project', '/projects/nope', 404, []],
  ['missing-room', W + '/rooms/r-d103', 404, []],
]

let fails = 0
for (const [name, path, wantStatus, must, mustNot = []] of pages) {
  const res = await fetch(app + path, { headers: { cookie }, redirect: 'manual' })
  const html = await res.text()
  fs.writeFileSync(out + '/' + name + '.html', html)
  const text = textOf(html)
  fs.writeFileSync(out + '/' + name + '.txt', text)
  const problems = []
  if (res.status !== wantStatus) problems.push('status ' + res.status + ' (want ' + wantStatus + ')' + (res.headers.get('location') ? ' -> ' + res.headers.get('location') : ''))
  if (wantStatus === 200 && /Application error|Internal Server Error|__next_error__/i.test(html)) problems.push('error page rendered')
  // visible text first; placeholders and other attributes are only in the markup
  const markup = decode(html)
  for (const s of must) if (!text.includes(s) && !markup.includes(s)) problems.push('missing: ' + s)
  for (const s of mustNot) if (text.includes(s)) problems.push('should not show: ' + s)
  // stored images are private: no page may carry a public storage URL
  if (markup.includes('/storage/v1/object/public/')) problems.push('page carries a PUBLIC storage URL')
  if (wantStatus === 307) {
    const loc = res.headers.get('location') || ''
    if (!loc.includes('/rulebook/')) problems.push('redirect target ' + loc)
  }
  if (problems.length) fails += problems.length
  console.log((problems.length ? 'FAIL ' : 'ok   ') + name.padEnd(20) + String(res.status).padEnd(5) + (text.length + ' chars').padEnd(13) + problems.join(' | '))
}
const unknown = await (await fetch(mock + '/__unknown')).json()
if (unknown.length) { fails += unknown.length; console.log('FAIL mock saw requests it could not serve:', unknown.join(' ; ')) }
console.log(fails ? 'SMOKE FAILED: ' + fails + ' problem(s)' : 'SMOKE PASS: ' + pages.length + ' pages')
process.exit(fails ? 1 : 0)
