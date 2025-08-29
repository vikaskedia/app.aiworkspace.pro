import { createClient } from '@supabase/supabase-js'
import telnyx from 'telnyx'

// Supabase service-role client for server-side writes
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { workspace_id, from, to, file_url, connection_id, subject, fax_row_id } = req.body || {}

    if (!to || !file_url) {
      return res.status(400).json({ error: 'Missing required fields: to, file_url' })
    }

    const TELNYX_API_KEY = process.env.TELNYX_API_KEY
    if (!TELNYX_API_KEY) {
      return res.status(500).json({ error: 'Telnyx API key not configured' })
    }

        // Initialize Telnyx SDK client
        const telnyxClient = telnyx(TELNYX_API_KEY)

        // Build payload for Telnyx Fax create API. Adjust as needed for your Telnyx account.
        const telnyxPayload = {
          connection_id: connection_id || undefined,
          to: to,
          from: from || undefined,
          media_urls: [file_url],
          // Optional metadata
          custom_string: subject || undefined
        }

        // Remove undefined keys
        Object.keys(telnyxPayload).forEach(k => telnyxPayload[k] === undefined && delete telnyxPayload[k])

        // Use Telnyx SDK to create fax
        let json = null
        try {
          const resp = await telnyxClient.faxes.create(telnyxPayload)
          // SDK typically returns an object with a `data` property
          json = resp && (resp.data || resp)
        } catch (e) {
          // capture the error response body if available
          // eslint-disable-next-line no-console
          console.error('Telnyx SDK error:', e)
          // Try to extract useful response info
          json = e?.data || e?.response || { error: String(e) }
        }

    // If Telnyx returned an id, persist it to the faxes table for tracking
    const telnyxId = (json && (json.data?.id || json.id)) || null
    if (fax_row_id && telnyxId) {
      await supabase
        .from('faxes')
        .update({ telnyx_id: telnyxId, status: 'queued', metadata: Object.assign({}, json, { queued_at: new Date().toISOString() }) })
        .eq('id', fax_row_id)
    }

    return res.status(200).json({ success: true, telnyx_response: json, telnyx_id: telnyxId })
  } catch (error) {
    console.error('send-fax error:', error)
    return res.status(500).json({ error: 'Failed to send fax', details: String(error) })
  }
}
