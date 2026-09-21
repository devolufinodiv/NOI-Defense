/**
 * Turning a webhook delivery into transfer rows.
 *
 * Pure on purpose: no Deno, no network, no database. Decoding is the part most
 * likely to be subtly wrong, and keeping it free of the runtime means it can be
 * run against real payloads directly.
 */

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/** Alchemy's network names, as they appear in the webhook body. */
const NETWORKS: Record<string, number> = {
  ETH_MAINNET: 1,
  BASE_MAINNET: 8453,
  ARB_MAINNET: 42161,
  ARBITRUM_MAINNET: 42161,
  OPT_MAINNET: 10,
  OPTIMISM_MAINNET: 10,
  BNB_MAINNET: 56,
  MATIC_MAINNET: 137,
  POLYGON_MAINNET: 137,
  AVAX_MAINNET: 43114,
  ZKSYNC_MAINNET: 324,
  SCROLL_MAINNET: 534352,
}

export interface TransferEvent {
  txHash: string
  logIndex: number
  blockNumber: number
  blockTime: number | null
  token: string
  from: string
  to: string
  /** Decimal string. A uint256 has no business passing through a float. */
  value: string
}

export interface Decoded {
  chainId: number | null
  deliveryId: string | null
  events: TransferEvent[]
  /** Logs we saw but deliberately did not store, and why. */
  skipped: { nonTransfer: number; nft: number; malformed: number }
}

/** The last 20 bytes of a 32-byte topic, as a lowercase address. */
function topicToAddress(topic: string): string | null {
  const hex = topic.replace(/^0x/, '')
  if (hex.length !== 64) return null
  return `0x${hex.slice(24).toLowerCase()}`
}

function toDecimal(hex: string): string | null {
  try {
    const trimmed = hex.trim()
    if (!/^0x[0-9a-fA-F]*$/.test(trimmed)) return null
    // An empty data field is not a zero transfer, it is a log we cannot read.
    if (trimmed === '0x') return null
    return BigInt(trimmed).toString()
  } catch {
    return null
  }
}

/**
 * Decodes an Alchemy custom-webhook delivery.
 *
 * Only ERC-20 transfers survive. An ERC-721 Transfer shares the same topic but
 * indexes its third argument, so it arrives with four topics and an empty data
 * field — reading that as an amount would record a token id as if it were a
 * balance, which is the kind of wrong number that looks entirely plausible on
 * a chart.
 */
export function decodeTransferLogs(payload: unknown): Decoded {
  const skipped = { nonTransfer: 0, nft: 0, malformed: 0 }
  const body = payload as Record<string, any>

  const network = body?.event?.network ?? body?.event?.data?.network
  const chainId = typeof network === 'string' ? NETWORKS[network] ?? null : null
  const deliveryId = typeof body?.id === 'string' ? body.id : null

  const block = body?.event?.data?.block
  const logs = Array.isArray(block?.logs) ? block.logs : []

  const blockNumber = Number(block?.number)
  const blockTime = Number.isFinite(Number(block?.timestamp)) ? Number(block.timestamp) : null

  const events: TransferEvent[] = []

  for (const log of logs) {
    const topics: string[] = Array.isArray(log?.topics) ? log.topics : []

    if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) {
      skipped.nonTransfer += 1
      continue
    }

    // Three topics = ERC-20 (from, to indexed; value in data).
    // Four topics = ERC-721 (token id indexed instead of an amount).
    if (topics.length !== 3) {
      skipped.nft += 1
      continue
    }

    const from = topicToAddress(topics[1])
    const to = topicToAddress(topics[2])
    const value = toDecimal(String(log?.data ?? ''))
    const token = typeof log?.account?.address === 'string'
      ? log.account.address.toLowerCase()
      : null
    const txHash = typeof log?.transaction?.hash === 'string' ? log.transaction.hash : null
    const logIndex = Number(log?.index)

    if (
      !from || !to || value === null || !token || !txHash ||
      !Number.isFinite(logIndex) || !Number.isFinite(blockNumber)
    ) {
      skipped.malformed += 1
      continue
    }

    events.push({
      txHash: txHash.toLowerCase(),
      logIndex,
      blockNumber,
      blockTime,
      token,
      from,
      to,
      value,
    })
  }

  return { chainId, deliveryId, events, skipped }
}
