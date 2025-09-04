
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

    // Optional file size / page heuristics to help catch large files early and report
    const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
    const MAX_PAGES = 350

    let pageCount = null
    let byteSize = null

    // Try HEAD first to get content-length
    try {
      const head = await fetch(file_url, { method: 'HEAD' })
      if (head && head.ok) {
        const cl = head.headers.get('content-length')
        if (cl) byteSize = parseInt(cl, 10)
      }
    } catch (e) {
      // ignore — we'll fetch the body below if needed
    }

    if (byteSize && byteSize > MAX_BYTES) {
      // Update DB record if available
      if (fax_row_id) {
        try {
          await supabase
            .from('faxes')
            .update({ status: 'failed', status_reason: 'file_size_limit_exceeded', metadata: { error: 'file_size_limit_exceeded', max_bytes: MAX_BYTES } })
            .eq('id', fax_row_id)
        } catch (err) {
          console.error('Failed to update faxes row for size limit:', err)
        }
      }
      return res.status(400).json({ success: false, error: 'file_size_limit_exceeded', detail: `File exceeds ${MAX_BYTES} bytes` })
    }

    // If we still don't know byteSize or we want to compute page count, fetch the file
    let fetchedBuffer = null
    try {
      const fetchResp = await fetch(file_url)
      if (!fetchResp.ok) return res.status(400).json({ success: false, error: 'failed_to_fetch_file', detail: `HTTP ${fetchResp.status} when fetching file_url` })

      const ab = await fetchResp.arrayBuffer()
      fetchedBuffer = Buffer.from(ab)
      byteSize = fetchedBuffer.length

      // Heuristic page count for PDF
      try {
        const latin = fetchedBuffer.toString('latin1')
        const pageMatches = latin.match(/\/Type\s*\/Page\b/g)
        pageCount = pageMatches ? pageMatches.length : 0
        if (!pageCount) {
          const countMatches = [...latin.matchAll(/\/Count\s+(\d+)/g)]
          if (countMatches && countMatches.length) pageCount = Math.max(...countMatches.map(m => parseInt(m[1], 10)))
        }
      } catch (e) {
        // ignore page count parsing errors
      }

      if (pageCount && pageCount > MAX_PAGES) {
        if (fax_row_id) {
          try {
            await supabase
              .from('faxes')
              .update({ status: 'failed', status_reason: 'page_count_limit_exceeded', metadata: { error: 'page_count_limit_exceeded', pages: pageCount, max_pages: MAX_PAGES } })
              .eq('id', fax_row_id)
          } catch (err) {
            console.error('Failed to update faxes row for page limit:', err)
          }
        }
        return res.status(400).json({ success: false, error: 'page_count_limit_exceeded', detail: `File has ${pageCount} pages, exceeds ${MAX_PAGES}` })
      }
    } catch (e) {
      console.error('Failed to fetch file for size/page heuristics:', e)
      // continue — Telnyx may still accept the media_url; we won't block the request
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

    // media_url must be a single URL string (not an array). Reject arrays explicitly.
    if (Array.isArray(req.body.media_urls)) {
      return res.status(400).json({ success: false, error: 'media_url_must_be_single', detail: 'media_url must be a single URL string, not an array' })
    }

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    // Debug: log request payload (without API key)
    console.info('Telnyx request payload:', Object.assign({}, payload))

    let telnyxResp = null
    let telnyxJson = null
    let telnyxHttpStatus = null
    try {
      const resp = await fetch('https://api.telnyx.com/v2/faxes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_FAX_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: buildFormUrlEncoded(payload)
      })

      telnyxHttpStatus = resp.status
      const txt = await resp.text()
      try { telnyxJson = JSON.parse(txt) } catch (_) { telnyxJson = { raw: txt } }
      telnyxResp = telnyxJson

      // persist result into DB row if present
      const telnyxId = (telnyxJson && (telnyxJson.data?.id || telnyxJson.id)) || null
      if (fax_row_id) {
        try {
          const updatePayload = {
            telnyx_id: telnyxId || null,
            status: telnyxId ? 'queued' : 'telnyx_failed',
            metadata: Object.assign({}, telnyxJson, { httpStatus: telnyxHttpStatus, request_payload: payload, queued_at: telnyxId ? new Date().toISOString() : undefined, byte_size: byteSize, page_count: pageCount })
          }
          await supabase
            .from('faxes')
            .update(updatePayload)
            .eq('id', fax_row_id)
        } catch (e) {
          console.error('Failed to persist telnyx response to faxes table:', e)
        }
      }

      // Return structured response so frontend can inspect
      return res.status(200).json({
        success: resp.ok,
        httpStatus: telnyxHttpStatus,
        telnyx_response: telnyxResp,
        telnyx_id: telnyxId,
        page_count: pageCount,
        byte_size: byteSize
      })
    } catch (e) {
      console.error('Telnyx HTTP POST error:', e)
      // attempt to persist failure
      if (fax_row_id) {
        try {
          await supabase
            .from('faxes')
            .update({ status: 'telnyx_failed', status_reason: String(e), metadata: { error: String(e), request_payload: payload } })
            .eq('id', fax_row_id)
        } catch (ee) {
          console.error('Failed to persist telnyx failure to faxes table:', ee)
        }
      }
      return res.status(500).json({ success: false, error: 'telnyx_post_failed', detail: String(e) })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('send-fax error:', error)
    return res.status(500).json({ error: 'Failed to send fax', details: String(error) })
  }
}