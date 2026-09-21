import { serviceClient } from '../_shared/db.ts'
import { decodeTransferLogs } from '../_shared/transferLogs.ts'

/**
 * POST /chain-ingest — the ingestion spine's front door.
 *
 * Alchemy pushes a block's worth of matching logs here; we verify it really
 * came from Alchemy, decode the ERC-20 transfers, and store them. Everything
 * downstream — holder changes, whale movements, early-buyer sells, wash-trade
 * loops — is a query over what lands in that table.
 *
 * Push rather than poll: polling nine chains costs money around the clock to
 * keep discovering nothing, and Alchemy's free tier caps eth_getLogs at a ten
 * block range, which makes tailing by polling impractical anyway.
 *
 * Deliveries can arrive twice, out of order, or late. None of that is handled
 * here on purpose: the table's primary key makes a repeat a no-op, nothing is
 * derived at write time so order does not matter, and a cursor per chain lets
 * the reconciliation pass find anything that never arrived at all.
 */

const SIGNATURE_HEADER = 'x-alchemy-signature'

/**
 * Constant-time comparison.
 *
 * A plain `===` on a signature leaks, through timing, how much of a guess was
 * right, which is enough to forge one given patience.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function signBody(body: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const imported = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', imported, encoder.encode(body))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  /*
   * No signing key means we cannot tell a real delivery from a forged one, and
   * this endpoint writes to the table every later signal is built on. Refuse
   * rather than accept anything — an open write endpoint is worse than an
   * ingestion pipeline that is visibly switched off.
   */
  const signingKey = Deno.env.get('ALCHEMY_WEBHOOK_SIGNING_KEY')?.trim()
  if (!signingKey) {
    return new Response(
      JSON.stringify({ error: 'Ingestion is not configured: no webhook signing key.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  // The signature covers the raw bytes, so the body must be read as text and
  // parsed afterwards — re-serialising the JSON would change it.
  const raw = await req.text()
  const provided = req.headers.get(SIGNATURE_HEADER) ?? ''
  const expected = await signBody(raw, signingKey)

  if (!provided || !safeEqual(provided.toLowerCase(), expected)) {
    return new Response(JSON.stringify({ error: 'Bad signature' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: 'Body is not JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { chainId, deliveryId, events, skipped } = decodeTransferLogs(payload)

  if (chainId === null) {
    // Storing against the wrong chain would be worse than storing nothing:
    // the same address is a different token on every network.
    return new Response(
      JSON.stringify({ error: 'Unrecognised network in delivery', skipped }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }

  if (events.length === 0) {
    return new Response(JSON.stringify({ chainId, received: 0, inserted: 0, skipped }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const db = serviceClient()
  const { data, error } = await db.rpc('ingest_token_transfers', {
    p_chain_id: chainId,
    p_delivery_id: deliveryId,
    p_events: events,
  })

  if (error) {
    // A non-2xx makes Alchemy retry, which is exactly what we want when the
    // write failed — the insert is idempotent, so a retry is free.
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const row = Array.isArray(data) ? data[0] : data
  return new Response(
    JSON.stringify({
      chainId,
      received: row?.received ?? events.length,
      inserted: row?.inserted ?? 0,
      skipped,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
