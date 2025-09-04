
import { createClient } from '@supabase/supabase-js'

// Supabase service-role client for server-side writes
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper to build application/x-www-form-urlencoded body like curl --data-urlencode
function buildFormUrlEncoded(payload) {
  const params = []
  for (const k of Object.keys(payload)) {
    const v = payload[k]
    if (v === undefined || v === null) continue
    // For array values (media_url(s)), Telnyx accepts repeated keys
    if (Array.isArray(v)) {
      for (const item of v) params.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`)
    } else {
      params.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
  }
  return params.join('&')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      workspace_id,
      from,
      to,
      file_url,
      connection_id,
      subject,
      fax_row_id,
      quality,
      t38_enabled,
      monochrome,
      store_media,
      webhook_url,
      client_state
    } = req.body || {}

    // Validate required fields
    if (!to || !file_url) {
      return res.status(400).json({ error: 'Missing required fields: to, file_url' })
    }

    const TELNYX_FAX_API_KEY = process.env.TELNYX_FAX_API_KEY
    if (!TELNYX_FAX_API_KEY) {
      return res.status(500).json({ error: 'Telnyx fax API key not configured' })
    }

    // Ensure global fetch exists in older Node runtimes
    if (typeof fetch === 'undefined') {
      try {
        const nodeFetch = await import('node-fetch')
        // node-fetch default export
        global.fetch = nodeFetch.default || nodeFetch
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('node-fetch not available; relying on global fetch if present')
      }
    }

    // Build the form-encoded payload (media_url or media_urls supported)
    const payload = {
      media_url: file_url,
      connection_id: connection_id || undefined,
      to,
      from: from || undefined,
      quality: quality || undefined,
      t38_enabled: typeof t38_enabled === 'boolean' ? t38_enabled : undefined,
      monochrome: typeof monochrome === 'boolean' ? monochrome : undefined,
      store_media: typeof store_media === 'boolean' ? store_media : undefined,
      webhook_url: webhook_url || undefined,
      client_state: client_state || undefined,
      custom_string: subject || undefined
    }

    // Accept array form: body.media_urls -> repeated media_url keys
    if (Array.isArray(req.body.media_urls) && req.body.media_urls.length) {
      payload.media_url = req.body.media_urls
    }

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    const body = buildFormUrlEncoded(payload)

    const resp = await fetch('https://api.telnyx.com/v2/faxes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_FAX_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const text = await resp.text()
    let json
    try {
      json = JSON.parse(text)
    } catch (e) {
      json = { raw: text }
    }

    if (!resp.ok) {
      return res.status(resp.status).json({ success: false, httpStatus: resp.status, telnyx_response: json })
    }

    const telnyxId = (json && (json.data?.id || json.id)) || null

    if (fax_row_id && telnyxId) {
      try {
        await supabase
          .from('faxes')
          .update({ telnyx_id: telnyxId, status: 'queued', metadata: Object.assign({}, json, { queued_at: new Date().toISOString() }) })
          .eq('id', fax_row_id)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to persist telnyx id to faxes table:', e)
      }
    }

    return res.status(202).json({ success: true, telnyx_response: json, telnyx_id: telnyxId })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('send-fax error:', error)
    return res.status(500).json({ error: 'Failed to send fax', details: String(error) })
  }
}