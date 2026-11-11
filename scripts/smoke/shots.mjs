// Screenshots of the rendered pages (headless Chrome over the DevTools protocol; no extra packages).
// Run through the harness, which has the servers up:  SHOTS=1 sh scripts/smoke/run.sh
// Writes <outdir>/shots/*.png at 1440 px wide, plus a 390 px (phone) pass that reports sideways overflow.
import fs from 'node:fs'
import { spawn } from 'node:child_process'

const [app, out, widthArg] = process.argv.slice(2)
const width = Number(widthArg || 1440)
fs.mkdirSync(out, { recursive: true })
const b64u = (s) => Buffer.from(s).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 86400 * 30
const user = { id: 'user-mitch', aud: 'authenticated', role: 'authenticated', email: 'mitch@barnhaus.test', app_metadata: {}, user_metadata: {} }
const jwt = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp, email: user.email })) + '.c2ln'
const cookieValue = 'base64-' + b64u(JSON.stringify({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'mock-refresh', user }))

const W = '/projects/p-whitaker', D = '/projects/p-deubner'
const pages = [
  ['01-inbox', '/'],
  ['02-projects', '/projects'],
  ['03-project-deubner', D],
  ['04-project-whitaker', W],
  ['05-project-mann-empty', '/projects/p-mann'],
  ['06-room-2d', W + '/rooms/r-wb3'],
  ['07-room-decide', W + '/rooms/r-wb3?view=decide'],
  ['08-room-intake', D + '/rooms/r-d103'],
  ['08b-room-edit-line', D + '/rooms/r-d103?view=decide&edit=d8'],
  ['09-room-2d-approved', W + '/rooms/r-wb5'],
  ['10-checks', '/rulebook/checks'],
  ['11-checks-new', '/rulebook/checks?new=min_clearance'],
  ['12-defaults', '/rulebook/defaults'],
  ['12b-defaults-edit', '/rulebook/defaults?edit=def-4'],
  ['13-standards', '/rulebook/standards'],
  ['14-standards-diff', '/rulebook/standards?doc=d1-to-d2-runbook&compare=2'],
  ['15-blueprint', '/blueprint'],
  ['16-lessons', '/blueprint/lessons'],
  ['17-capabilities', '/blueprint/capabilities'],
]

const PORT = 9333
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/chrome-shots', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let version
for (let i = 0; i < 60 && !version; i++) {
  try {
    version = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json()
  } catch {
    await sleep(250)
  }
}
if (!version) {
  console.log('chrome did not start')
  chrome.kill()
  process.exit(1)
}
const ws = new WebSocket(version.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let seq = 0
const pending = new Map()
const waiters = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  } else if (msg.method) {
    for (const w of [...waiters]) {
      if (w.method !== msg.method || w.sessionId !== msg.sessionId) continue
      waiters.splice(waiters.indexOf(w), 1)
      w.resolve(msg.params)
    }
  }
}
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, sessionId }))
  })
const once = (method, sessionId, ms = 20000) =>
  Promise.race([new Promise((resolve) => waiters.push({ method, sessionId, resolve })), sleep(ms).then(() => null)])

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
await send('Page.enable', {}, sessionId)
await send('Network.enable', {}, sessionId)
await send('Network.setCookie', { name: 'sb-127-auth-token', value: cookieValue, url: app }, sessionId)
await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 }, sessionId)

let overflowing = 0
for (const [name, path] of pages) {
  const loaded = once('Page.loadEventFired', sessionId)
  await send('Page.navigate', { url: app + path }, sessionId)
  await loaded
  await sleep(500)
  const { cssContentSize } = await send('Page.getLayoutMetrics', {}, sessionId)
  const height = Math.min(Math.ceil(cssContentSize.height), 7000)
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } }, sessionId)
  const file = out + '/' + name + (width < 600 ? '-mobile' : '') + '.png'
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  const over = Math.ceil(cssContentSize.width) > width
  if (over) overflowing++
  console.log(name.padEnd(26), width + 'x' + height, over ? 'OVERFLOWS sideways: content ' + Math.ceil(cssContentSize.width) + 'px' : '')
}
ws.close()
chrome.kill()
// a page wider than the screen is a failure at any width, not a note
if (overflowing) console.log('SHOTS FAIL: ' + overflowing + ' page(s) scroll sideways at ' + width + 'px')
process.exit(overflowing ? 1 : 0)
