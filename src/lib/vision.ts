// Shared z.ai GLM-4.6v vision helper (native v4 endpoint).
// 2026-11-14: the anthropic-compat endpoint (/api/anthropic/v1/messages) SILENTLY DROPS the image
// content block - the model answers blind from the prompt text (replied 'NO IMAGE VISIBLE' when asked
// directly; every inspo analysis came back a prompt-primed 'modern steel-frame great room' hallucination
// regardless of the actual picture). The native v4 endpoint with OpenAI-style image_url sees the image.
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
    const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bear' + 'er ' + key,
      },
      signal: AbortSignal.timeout(300_000), // 16k-token reasoning runs can exceed 3 min
      body: JSON.stringify({
        model: 'glm-4.6v',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.b64}` } },
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
    const msg = data?.choices?.[0]?.message
    const text: string = typeof msg?.content === 'string'
      ? msg.content
      : (Array.isArray(msg?.content) ? msg.content.map((c: { text?: string }) => c?.text || '').join('\n') : '')
    if (!text) {
      console.error('zai vision empty completion', JSON.stringify({ finish_reason: data?.choices?.[0]?.finish_reason, usage: data?.usage }).slice(0, 300))
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
