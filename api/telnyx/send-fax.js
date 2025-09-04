
import { createClient } from '@supabase/supabase-js'
import telnyx from 'telnyx'
// Ensure fetch exists in older Node runtimes
let nodeFetch
if (typeof fetch === 'undefined') {
  try {
    nodeFetch = await import('node-fetch')
    // node-fetch exports default
    global.fetch = nodeFetch.default || nodeFetch
  } catch (e) {
    // ignore — runtime may provide fetch; fallback errors will be handled later
    // eslint-disable-next-line no-console
    console.warn('node-fetch not available; relying on global fetch if present')
  }
}

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

    const TELNYX_FAX_API_KEY = process.env.TELNYX_FAX_API_KEY
    if (!TELNYX_FAX_API_KEY) {
      return res.status(500).json({ error: 'Telnyx fax API key not configured' })
    }

        // Initialize Telnyx SDK client
  const telnyxClient = telnyx(TELNYX_FAX_API_KEY)

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

        // Use Telnyx SDK to create fax. If the SDK fails, capture rich details
        // and attempt a direct HTTP POST to the Telnyx /v2/faxes endpoint as a fallback
        let json = null
        try {
          const resp = await telnyxClient.faxes.create(telnyxPayload)
          // SDK typically returns an object with a `data` property
          json = resp && (resp.data || resp)
        } catch (e) {
          // Log richer debug info (do NOT log API keys)
          // eslint-disable-next-line no-console
          console.error('Telnyx SDK error:', {
            message: e?.message,
            statusCode: e?.statusCode || e?.raw?.statusCode || null,
            raw: e?.raw || e?.response || null
          })

          // Try a fallback explicit POST to the Telnyx v2/faxes endpoint so we can
          // observe the exact HTTP response body. This uses the server-side fetch
          // (Node 18+ / Vercel runtime provides global fetch).
          try {
            const fallbackResp = await fetch('https://api.telnyx.com/v2/faxes', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${TELNYX_FAX_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(telnyxPayload)
            })

            const text = await fallbackResp.text()
            // attempt to parse JSON, but fall back to raw text
            try {
              json = JSON.parse(text)
            } catch (parseErr) {
              json = { raw: text }
            }

            // If fallback returned non-2xx, include status for clarity
            if (!fallbackResp.ok) {
              json = Object.assign({}, json, { httpStatus: fallbackResp.status })
            }
          } catch (fetchErr) {
            // Final fallback: surface both SDK error and fetch error messages
            // eslint-disable-next-line no-console
            console.error('Telnyx fallback POST error:', String(fetchErr))
            json = { error: 'Telnyx SDK failed and fallback POST failed', sdkError: String(e), fetchError: String(fetchErr) }
          }
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

/*
// Active implementation placed after the commented reference code above.
import { createClient } from '@supabase/supabase-js'
import telnyx from 'telnyx'

// Ensure fetch exists in older Node runtimes
if (typeof fetch === 'undefined') {
  try {
    const nodeFetch = await import('node-fetch')
    global.fetch = nodeFetch.default || nodeFetch
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('node-fetch not available; relying on global fetch if present')
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { workspace_id, from, to, file_url, connection_id, subject, fax_row_id, quality, t38_enabled, monochrome, store_media, webhook_url, client_state } = req.body || {}

    if (!to || !file_url) return res.status(400).json({ error: 'Missing required fields: to, file_url' })

  const TELNYX_FAX_API_KEY = process.env.TELNYX_FAX_API_KEY
  if (!TELNYX_FAX_API_KEY) return res.status(500).json({ error: 'Telnyx fax API key not configured' })

    const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
    const MAX_PAGES = 350

    // Try HEAD to get content-length
    let contentLength = null
    try {
      const headResp = await fetch(file_url, { method: 'HEAD' })
      if (headResp && headResp.ok) {
        const cl = headResp.headers.get('content-length')
        if (cl) contentLength = parseInt(cl, 10)
      }
    } catch (e) {
      // ignore and fall back to GET
    }

    if (contentLength && contentLength > MAX_BYTES) {
      return res.status(400).json({ error: 'file_size_limit_exceeded', detail: 'File exceeds 50MB limit' })
    }

    // Fetch body with streaming reader when available
    let pdfBuffer
    try {
      const resp = await fetch(file_url)
      if (!resp.ok) return res.status(400).json({ error: 'failed_to_fetch_file', detail: `HTTP ${resp.status} from file URL` })

      if (resp.body && typeof resp.body.getReader === 'function') {
        const reader = resp.body.getReader()
        const chunks = []
        let received = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const buf = Buffer.from(value)
          chunks.push(buf)
          received += buf.length
          if (received > MAX_BYTES) {
            return res.status(400).json({ error: 'file_size_limit_exceeded', detail: 'File exceeds 50MB limit' })
          }
        }
        pdfBuffer = Buffer.concat(chunks)
      } else {
        const ab = await resp.arrayBuffer()
        pdfBuffer = Buffer.from(ab)
        if (pdfBuffer.length > MAX_BYTES) return res.status(400).json({ error: 'file_size_limit_exceeded', detail: 'File exceeds 50MB limit' })
      }
    } catch (e) {
      return res.status(400).json({ error: 'failed_to_fetch_file', detail: String(e) })
    }

    // Heuristic page count
    const latin = pdfBuffer.toString('latin1')
    let pageMatches = latin.match(/\/Type\s*\/Page\b/g)
    let pageCount = pageMatches ? pageMatches.length : 0
    if (pageCount === 0) {
      const countMatches = [...latin.matchAll(/\/Count\s+(\d+)/g)]
      if (countMatches && countMatches.length) pageCount = Math.max(...countMatches.map(m => parseInt(m[1], 10)))
    }

    if (pageCount > MAX_PAGES) return res.status(400).json({ error: 'page_count_limit_exceeded', detail: `File has ${pageCount} pages, exceeds ${MAX_PAGES}` })

  const telnyxClient = telnyx(TELNYX_FAX_API_KEY)
    const telnyxPayload = {
      connection_id: connection_id || undefined,
      to,
      from: from || undefined,
      media_urls: [file_url],
      quality: quality || 'high',
      t38_enabled: typeof t38_enabled === 'boolean' ? t38_enabled : true,
      monochrome: typeof monochrome === 'boolean' ? monochrome : undefined,
      store_media: typeof store_media === 'boolean' ? store_media : undefined,
      webhook_url: webhook_url || undefined,
      client_state: client_state || undefined
    }
    Object.keys(telnyxPayload).forEach(k => telnyxPayload[k] === undefined && delete telnyxPayload[k])

    let json = null
    try {
      const resp = await telnyxClient.faxes.create(telnyxPayload)
      json = resp && (resp.data || resp)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Telnyx SDK error:', { message: e?.message, statusCode: e?.statusCode || null })
      try {
        const fallbackResp = await fetch('https://api.telnyx.com/v2/faxes', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TELNYX_FAX_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(telnyxPayload)
        })
        const text = await fallbackResp.text()
        try { json = JSON.parse(text) } catch (_) { json = { raw: text } }
        if (!fallbackResp.ok) json = Object.assign({}, json, { httpStatus: fallbackResp.status })
      } catch (fetchErr) {
        // eslint-disable-next-line no-console
        console.error('Telnyx fallback error:', String(fetchErr))
        json = { error: 'telnyx_failed', detail: String(fetchErr), sdkError: String(e) }
      }
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

    return res.status(202).json({ success: true, telnyx_response: json, telnyx_id: telnyxId, page_count: pageCount, byte_size: pdfBuffer.length })

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('send-fax error:', error)
    return res.status(500).json({ error: 'Failed to send fax', details: String(error) })
  }
}*/