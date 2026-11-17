import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/processes — the processes a project can follow (key, title, description, status live|draft, sort).
// Blueprint reads this to know which stage pack a project's work order is compiled from.
// Auth: x-prefill-secret header (PREFILL_SECRET env) — machine-to-machine.

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  if (!process.env.PREFILL_SECRET || secret !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  const supabase = createServiceClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await supabase.from('intent_processes').select('key, title, description, status, sort').order('sort')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ processes: data || [] })
}
