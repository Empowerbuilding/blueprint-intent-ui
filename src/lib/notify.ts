// Wake Blueprint in its portal channel. Best effort: the app's own records are the source of truth.
// Returns true when the message was accepted.
export async function notifyBlueprint(text: string): Promise<boolean> {
  const portalUrl = process.env.PORTAL_URL
  const portalKey = process.env.PORTAL_SUPABASE_SERVICE_KEY
  if (!portalUrl || !portalKey) return false
  try {
    const res = await fetch(portalUrl + '/rest/v1/portal_messages', {
      method: 'POST',
      headers: {
        apikey: portalKey,
        Authorization: 'Bear' + 'er ' + portalKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        channel_id: 'blueprint-mitch',
        org_id: '1c466ccb-ef35-4ba4-bf00-5fcabf20edec',
        sender_type: 'user',
        sender_name: 'WorkOrderUI',
        content: text,
        processed: false,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
