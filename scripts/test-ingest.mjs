#!/usr/bin/env node
/**
 * Proves the ingestion endpoint works, without waiting for a real delivery.
 *
 * Alchemy's dashboard only offers "Test Webhook" while a webhook is being
 * created, so there is no button to press once one exists. This signs a
 * delivery exactly the way Alchemy does — HMAC-SHA256 over the raw body, hex,
 * in x-alchemy-signature — and posts it, which tests the same path a real
 * delivery takes rather than a simulation of it.
 *
 *   ALCHEMY_WEBHOOK_SIGNING_KEY=whsec_… node scripts/test-ingest.mjs
 *   ALCHEMY_WEBHOOK_SIGNING_KEY=whsec_… node scripts/test-ingest.mjs --write
 *
 * Without --write nothing is stored: the payload carries a log the decoder is
 * expected to reject, so a 200 proves the signature and the decoder and leaves
 * the table untouched. With --write one clearly-synthetic row is inserted so
 * the database path is proven too; the run prints the SQL to remove it.
 */

import { createHmac } from 'node:crypto'

const ENDPOINT =
  process.env.INGEST_URL ??
  'https://rzhnmtfhlpviiagrnsdo.supabase.co/functions/v1/chain-ingest'

const key = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY?.trim()
if (!key) {
  console.error('Set ALCHEMY_WEBHOOK_SIGNING_KEY to the webhook\'s signing key first.')
  process.exit(1)
}

const write = process.argv.includes('--write')

const TRANSFER =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/** A 20-byte address padded to a 32-byte topic, the way a log carries it. */
const topic = (address) => `0x${'0'.repeat(24)}${address.replace(/^0x/, '').toLowerCase()}`

/** Obviously not a real transaction, so the test row is easy to spot and drop. */
const MARKER_TX = `0x${'ee'.repeat(32)}`

const send = async (label, body, signed) => {
  const raw = JSON.stringify(body)
  const headers = { 'content-type': 'application/json' }
  if (signed) {
    headers['x-alchemy-signature'] = createHmac('sha256', key).update(raw).digest('hex')
  }
  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: raw })
  const text = await res.text()
  console.log(`\n${label}\n  ${res.status} ${text}`)
  return res.status
}

const delivery = (id, logs) => ({
  id,
  event: {
    network: 'ETH_MAINNET',
    data: {
      block: {
        number: 21000000,
        timestamp: Math.floor(Date.now() / 1000),
        logs,
      },
    },
  },
})

const unsigned = await send(
  'Unsigned delivery — expected 401 Bad signature (503 means the secret is not set yet)',
  delivery('noi-test-unsigned', []),
  false,
)

if (unsigned === 503) {
  console.error('\nALCHEMY_WEBHOOK_SIGNING_KEY is not set on the Edge Function. Set it in Supabase first.')
  process.exit(1)
}

await send(
  'Signed delivery, nothing storable — expected 200 with received 0 and skipped.nonTransfer 1',
  delivery('noi-test-signed', [
    {
      index: 0,
      topics: [`0x${'11'.repeat(32)}`],
      data: '0x',
      transaction: { hash: `0x${'22'.repeat(32)}` },
      account: { address: '0x397f1551aa7b22e382fed9f4c8e60f8f4968cf0f' },
    },
  ]),
  true,
)

if (write) {
  const log = {
    index: 0,
    topics: [
      TRANSFER,
      topic('0x0000000000000000000000000000000000000001'),
      topic('0x0000000000000000000000000000000000000002'),
    ],
    data: `0x${(10n ** 18n).toString(16).padStart(64, '0')}`,
    transaction: { hash: MARKER_TX },
    account: { address: '0x397f1551aa7b22e382fed9f4c8e60f8f4968cf0f' },
  }

  await send(
    'Signed delivery with one transfer — expected 200 with inserted 1',
    delivery('noi-test-write', [log]),
    true,
  )

  await send(
    'The same delivery again — expected 200 with inserted 0, which is what makes a retry safe',
    delivery('noi-test-write-again', [log]),
    true,
  )

  console.log(`
Remove the test row when you are done:

  delete from public.token_transfers where tx_hash = '${MARKER_TX}';
  delete from public.ingest_deliveries where id like 'noi-test-%';
`)
}
