// Stored images (inspo photos, 2D outline drawings) live in PRIVATE buckets. Nothing in the app
// builds a public URL: every image is handed out as a signed link that stops working after a
// short time, made on the server for someone who is already signed in (or for a machine caller
// that passed the shared secret).
//
// Server only. The service-role key never reaches the browser.
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const INSPO_BUCKET = 'intent-inspo'
export const OUTLINES_BUCKET = 'intent-outlines'

/** links put on a page or returned by an API: long enough to review a drawing, short enough not to be a share link */
export const PAGE_URL_TTL = 60 * 60
/** links the server uses itself straight away (vision checks) */
export const FETCH_URL_TTL = 10 * 60

type SignedRow = { path: string | null; signedUrl: string | null; error: string | null }
// the two Supabase clients (user session, service role) have different generics; only .storage is used
export type StorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (paths: string[], expiresIn: number) => Promise<{ data: SignedRow[] | null; error: unknown }>
    }
  }
}

let warned = false

function serviceClient(): StorageClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as StorageClient
}

async function sign(client: StorageClient, bucket: string, paths: string[], ttl: number, into: Map<string, string>) {
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    try {
      const { data } = await client.storage.from(bucket).createSignedUrls(chunk, ttl)
      for (const row of data || []) if (row.path && row.signedUrl && !row.error) into.set(row.path, row.signedUrl)
    } catch {
      // left unsigned; the caller shows "image unavailable"
    }
  }
}

/**
 * Signed links for stored files, keyed by storage path. A path that could not be signed is
 * simply absent from the map — callers must handle a missing link, never fall back to a public URL.
 *
 * Signs as the caller first (the storage policies decide). Only if that is refused does it fall
 * back to the service role, for a caller the route has already authenticated.
 */
export async function signedUrls(
  client: StorageClient,
  bucket: string,
  paths: (string | null | undefined)[],
  ttl: number = PAGE_URL_TTL,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))]
  const out = new Map<string, string>()
  if (!wanted.length) return out
  await sign(client, bucket, wanted, ttl, out)
  const missing = wanted.filter((p) => !out.has(p))
  if (missing.length) {
    const service = serviceClient()
    if (service) {
      await sign(service, bucket, missing, ttl, out)
      if (!warned && missing.some((p) => out.has(p))) {
        warned = true
        console.warn('[storage] ' + bucket + ': signing as the signed-in user was refused; used the service role instead')
      }
    }
  }
  return out
}

export async function signedUrl(
  client: StorageClient,
  bucket: string,
  path: string | null | undefined,
  ttl: number = PAGE_URL_TTL,
): Promise<string | null> {
  if (!path) return null
  return (await signedUrls(client, bucket, [path], ttl)).get(path) || null
}
