// Minimal stand-in for Supabase (auth + PostgREST reads and writes + storage remove) so the app's pages can be
// rendered for real against fixture data, with no network and no credentials.
// Dev-only smoke test: node scripts/smoke/mock-supabase.mjs <fixtures.json> <port>
import http from 'node:http'
import fs from 'node:fs'

const db = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const port = Number(process.argv[3] || 54399)
const unknown = new Set()
const calls = [] // every write, in order — the action tests assert on this
let mode = { fk: 'cascade', loseBucket: '', denySign: false }
const CHILD_TABLES = ['intent_outlines', 'intent_emissions', 'intent_inspo_images', 'intent_redline_notes', 'intent_open_questions', 'intent_decisions', 'intent_rooms']
const UNIQUE = { intent_rules: 'rule_key' }

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(null)
      }
    })
  })

function filterRows(rows, u, table) {
  for (const [key, raw] of u.searchParams) {
    if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset' || key === 'columns') continue
    const dot = raw.indexOf('.')
    const op = raw.slice(0, dot)
    const val = raw.slice(dot + 1)
    if (op === 'eq') rows = rows.filter((r) => String(r[key]) === val)
    else if (op === 'neq') rows = rows.filter((r) => String(r[key]) !== val)
    else if (op === 'gt') rows = rows.filter((r) => String(r[key]) > val)
    else if (op === 'is') rows = rows.filter((r) => (val === 'null' ? r[key] == null : String(r[key]) === val))
    else if (op === 'in') {
      const set = val.slice(1, -1).split(',').map((s) => s.replace(/^"|"$/g, ''))
      rows = rows.filter((r) => set.includes(String(r[key])))
    } else unknown.add('filter ' + table + '.' + key + '=' + raw)
  }
  return rows
}

const send = (res, status, body, headers = {}) => {
  const text = body === null ? '' : JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(text)
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://mock')
    if (u.pathname === '/__unknown') {
      if (u.searchParams.get('clear')) unknown.clear()
      return send(res, 200, [...unknown])
    }
    if (u.pathname === '/auth/v1/user') {
      // the signed-in person is whoever the session token names (the tests sign in as more than one person)
      try {
        const claims = JSON.parse(Buffer.from(String(req.headers.authorization || '').split('.')[1] || '', 'base64url').toString())
        if (claims.sub && claims.sub !== db.__user.id) return send(res, 200, { ...db.__user, id: claims.sub, email: claims.email })
      } catch {}
      return send(res, 200, db.__user)
    }
    if (u.pathname === '/__db') return send(res, 200, db)
    if (u.pathname === '/__calls') return send(res, 200, calls)
    if (u.pathname === '/__mode') {
      readBody(req).then((b) => {
        mode = { ...mode, ...(b || {}) }
        send(res, 200, mode)
      })
      return
    }

    // storage: the buckets are PRIVATE. A public URL is refused, and counts as a request the app must not make.
    if (u.pathname.startsWith('/storage/v1/object/public/')) {
      unknown.add('public image URL requested: ' + u.pathname)
      return send(res, 400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' })
    }
    // storage: sign a batch of paths (POST /storage/v1/object/sign/<bucket> {expiresIn, paths})
    if (u.pathname.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
      const bucket = u.pathname.slice('/storage/v1/object/sign/'.length)
      readBody(req).then((b) => {
        const paths = (b && b.paths) || []
        calls.push({ op: 'storage.sign', bucket, paths, expiresIn: b && b.expiresIn })
        if (mode.denySign) return send(res, 200, paths.map((path) => ({ path, signedURL: null, error: 'Either the object does not exist or you do not have access to it' })))
        send(res, 200, paths.map((path) => ({ path, error: null, signedURL: '/object/sign/' + bucket + '/' + path + '?token=mock-' + (b && b.expiresIn) })))
      })
      return
    }
    // storage: a signed link -> a stand-in drawing, so screenshots show how a real one sits on the page
    if (u.pathname.startsWith('/storage/v1/object/sign/') && req.method === 'GET') {
      if (!(u.searchParams.get('token') || '').startsWith('mock-')) return send(res, 400, { error: 'InvalidJWT' })
      const wide = !u.pathname.includes('elev')
      const [w, h] = wide ? [1600, 1100] : [1600, 700]
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/><rect x="120" y="100" width="${w - 240}" height="${h - 200}" fill="none" stroke="#111" stroke-width="10"/><rect x="${w / 2 - 240}" y="${h / 2 - 90}" width="480" height="180" fill="#e9e2d0" stroke="#111" stroke-width="4"/><text x="${w / 2}" y="${h / 2 + 12}" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#111">stand-in drawing</text></svg>`
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Content-Length': Buffer.byteLength(svg) })
      return res.end(svg)
    }
    // storage: remove files (DELETE /storage/v1/object/<bucket> {prefixes})
    if (u.pathname.startsWith('/storage/v1/object/') && req.method === 'DELETE') {
      const bucket = u.pathname.slice('/storage/v1/object/'.length)
      readBody(req).then((b) => {
        const prefixes = (b && b.prefixes) || []
        calls.push({ op: 'storage.remove', bucket, prefixes })
        send(res, 200, bucket === mode.loseBucket ? [] : prefixes.map((name) => ({ name, bucket_id: bucket })))
      })
      return
    }
    if (!u.pathname.startsWith('/rest/v1/')) {
      unknown.add(req.method + ' ' + u.pathname)
      return send(res, 404, { message: 'mock: no such route ' + u.pathname })
    }

    const table = u.pathname.slice('/rest/v1/'.length)
    if (!(table in db)) {
      unknown.add('table ' + table)
      return send(res, 404, { message: 'mock: unknown table ' + table })
    }
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object')
    const prefer = String(req.headers.prefer || '')

    if (req.method === 'POST') {
      readBody(req).then((body) => {
        const list = (Array.isArray(body) ? body : [body]).map((r) => ({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...(table === 'intent_rules' ? { active: true, version: 1, updated_at: new Date().toISOString() } : {}),
          ...(table === 'intent_decisions' ? { status: 'active', superseded_by: null } : {}), // column defaults in the real table
          ...r,
        }))
        const uniq = UNIQUE[table]
        if (uniq && list.some((r) => db[table].some((x) => x[uniq] === r[uniq]))) {
          calls.push({ op: 'insert-rejected', table, reason: 'unique ' + uniq })
          return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint', details: null, hint: null })
        }
        db[table].push(...list)
        calls.push({ op: 'insert', table, rows: list })
        if (!prefer.includes('return=representation')) return send(res, 201, null)
        send(res, 201, wantsObject ? list[0] : list)
      })
      return
    }
    if (req.method === 'PATCH') {
      readBody(req).then((body) => {
        const hit = filterRows(db[table], u, table)
        for (const r of hit) Object.assign(r, body)
        calls.push({ op: 'update', table, ids: hit.map((r) => r.id), set: body })
        if (!prefer.includes('return=representation')) return send(res, 204, null)
        send(res, 200, wantsObject ? hit[0] : hit)
      })
      return
    }
    if (req.method === 'DELETE') {
      const hit = filterRows(db[table], u, table)
      if (table === 'intent_projects' && hit.length) {
        const ids = hit.map((r) => r.id)
        const hasChildren = CHILD_TABLES.some((t) => db[t].some((r) => ids.includes(r.project_id)))
        if (hasChildren && mode.fk === 'block') {
          calls.push({ op: 'delete-rejected', table, reason: 'fk' })
          return send(res, 409, { code: '23503', message: 'update or delete on table "intent_projects" violates foreign key constraint', details: null, hint: null })
        }
        for (const t of CHILD_TABLES) db[t] = db[t].filter((r) => !ids.includes(r.project_id))
      }
      db[table] = db[table].filter((r) => !hit.includes(r))
      calls.push({ op: 'delete', table, count: hit.length })
      return send(res, 204, null, { 'Content-Range': '*/' + hit.length })
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      unknown.add(req.method + ' ' + u.pathname)
      return send(res, 405, { message: 'mock: unsupported method' })
    }

    let rows = filterRows([...db[table]], u, table)
    const order = u.searchParams.getAll('order').join(',')
    if (order) {
      const keys = order.split(',').map((o) => {
        const [col, dir] = o.split('.')
        return { col, desc: dir === 'desc' }
      })
      rows.sort((a, b) => {
        for (const k of keys) {
          const x = a[k.col], y = b[k.col]
          if (x === y) continue
          const c = x == null ? -1 : y == null ? 1 : x < y ? -1 : 1
          return k.desc ? -c : c
        }
        return 0
      })
    }
    const total = rows.length
    const limit = u.searchParams.get('limit')
    if (limit) rows = rows.slice(0, Number(limit))
    const headers = { 'Content-Range': (total ? '0-' + (total - 1) : '*') + '/' + total }
    if (req.method === 'HEAD') return send(res, 200, null, headers)
    if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
      if (rows.length === 1) return send(res, 200, rows[0], headers)
      return send(res, 406, { code: 'PGRST116', message: 'mock: ' + rows.length + ' rows for a single-row request', details: '', hint: null })
    }
    send(res, 200, rows, headers)
  })
  .listen(port, '127.0.0.1', () => console.log('mock supabase on ' + port))
