// Runs the vision analysis of one stored inspiration picture and saves it on the picture.
// Used by POST /api/analyze-image (upload, Blueprint) and by "Read the picture again" on the room page.
import { FETCH_URL_TTL, INSPO_BUCKET, signedUrl, type StorageClient } from '@/lib/storage'
import { ANALYSIS_PROMPT, mergeTags, parseAnalysis, type InspoAnalysis } from '@/lib/inspo-analysis'

type Db = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

async function askVision(imageUrl: string, mediaType: string): Promise<InspoAnalysis | null> {
  const key = process.env.ZAI_API_KEY
  if (!key) return null
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) return null
  const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
  const res = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bear' + 'er ' + key },
    body: JSON.stringify({
      model: 'glm-4.6v',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: b64 } },
            { type: 'text', text: ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('zai vision error', res.status, (await res.text()).slice(0, 300))
    return null
  }
  const data = await res.json()
  // GLM-4.6v returns a thinking block first: collect ALL text blocks
  const text: string = (Array.isArray(data?.content) ? data.content : [])
    .filter((c: { type?: string }) => c?.type === 'text')
    .map((c: { text?: string }) => c?.text || '')
    .join('\n')
  return parseAnalysis(text)
}

export type AnalyseResult =
  | { ok: true; image_id: string; project_id: string; room_id: string | null; analysis: InspoAnalysis }
  | { ok: false; status: number; error: string }

export async function analyseStoredImage(client: Db, imageId: string): Promise<AnalyseResult> {
  const { data: img, error } = await client
    .from('intent_inspo_images')
    .select('id, project_id, storage_path, room_id, tags, notes')
    .eq('id', imageId)
    .single()
  if (error || !img) return { ok: false, status: 404, error: 'image not found' }

  // private bucket: a short-lived signed link, used by this server only
  const imageUrl = await signedUrl(client as unknown as StorageClient, INSPO_BUCKET, img.storage_path, FETCH_URL_TTL)
  if (!imageUrl) return { ok: false, status: 502, error: 'stored image could not be read' }
  const mediaType = /\.png$/i.test(img.storage_path) ? 'image/png' : /\.webp$/i.test(img.storage_path) ? 'image/webp' : 'image/jpeg'

  const analysis = await askVision(imageUrl, mediaType)
  if (!analysis) return { ok: false, status: 502, error: 'analysis failed (vision model or key missing)' }

  // notes = the description, tags = what was there + the model's tags and colours, layout_details = replaced as a whole
  const { error: upErr } = await client
    .from('intent_inspo_images')
    .update({ notes: analysis.description, tags: mergeTags(img.tags, analysis), layout_details: analysis.layout_details, analyzed_at: new Date().toISOString() })
    .eq('id', img.id)
  if (upErr) return { ok: false, status: 500, error: 'the analysis could not be saved: ' + upErr.message }
  return { ok: true, image_id: img.id, project_id: img.project_id, room_id: img.room_id ?? null, analysis }
}
