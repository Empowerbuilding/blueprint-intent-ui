// Shared z.ai GLM-4.6v vision helper (anthropic-compatible endpoint).
// Gotchas baked in (learned 11/8-11/9, don't relearn):
//  - Bearer header must be built as scheme + space + key in ONE string
//  - GLM-4.6v returns a thinking block first — parse ALL text blocks
//  - z.ai requires Authorization: Bearer (x-api-key alone is flaky)

export async function zaiVisionText(
  prompt: string,
  image: { b64: string; mediaType: string },
  maxTokens = 1500
): Promise<string | null> {
  const key = process.env.ZAI_API_KEY
  if (!key) return null

  const attempt = async (): Promise<string | null> => {
    const res = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bear' + 'er ' + key,
      },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model: 'glm-4.6v',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.b64 } },
              { type: 'text', text: prompt },
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
    const text: string = (Array.isArray(data?.content) ? data.content : [])
      .filter((c: { type?: string }) => c?.type === 'text')
      .map((c: { text?: string }) => c?.text || '')
      .join('\n')
    if (!text) {
      console.error('zai vision empty completion', JSON.stringify({ stop_reason: data?.stop_reason, blocks: (data?.content || []).map((c: { type?: string }) => c?.type), usage: data?.usage }).slice(0, 300))
    }
    return text || null
  }

  // GLM-4.6v occasionally returns an empty completion on large images — one retry
  return (await attempt()) || (await attempt())
}

// Extract the first JSON object/array from LLM output that likes to add prose.
export function parseJsonLoose<T>(text: string | null): T | null {
  if (!text) return null
  const m = text.match(/[\[{][\s\S]*[\]}]/)
  if (!m) return null
  try {
    return JSON.parse(m[0]) as T
  } catch {
    return null
  }
}
