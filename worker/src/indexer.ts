import { erc20Abi, getAddress, parseAbiItem, type Address, type PublicClient } from 'viem'
import { clientFor } from './rpc.js'
import {
  computeHealth,
  deriveEarlyBuyers,
  deriveHolders,
  type EarlyBuyer,
  type HealthFactor,
  type HolderRow,
  type TokenFacts,
  type TransferRow,
} from './derive.js'

export type { TokenFacts, HolderRow, TransferRow, EarlyBuyer, HealthFactor }

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

/**
 * ERC-20 metadata.
 *
 * `name` and `symbol` are optional in the standard, and real tokens exist that
 * return bytes32 or revert outright, so each is read independently and a
 * failure degrades to a default rather than failing the whole job.
 */
export async function readTokenFacts(
  client: PublicClient,
  address: Address,
): Promise<Omit<TokenFacts, 'deployedBlock' | 'complete'>> {
  const contract = { address, abi: erc20Abi } as const

  const [symbol, name, decimals, totalSupply] = await Promise.all([
    client.readContract({ ...contract, functionName: 'symbol' }).catch(() => ''),
    client.readContract({ ...contract, functionName: 'name' }).catch(() => ''),
    client.readContract({ ...contract, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ ...contract, functionName: 'totalSupply' }).catch(() => 0n),
  ])

  return {
    symbol: String(symbol ?? '').slice(0, 32),
    name: String(name ?? '').slice(0, 128),
    decimals: Number(decimals ?? 18),
    totalSupply: (totalSupply as bigint) ?? 0n,
  }
}

/**
 * Find the deployment block by binary search on `getCode`.
 *
 * No RPC answers "when was this deployed", but bytecode presence is monotonic —
 * absent before deployment, present after — so ~25 calls locate it exactly on
 * any chain. Far cheaper than hunting for the creation transaction.
 */
export async function findDeploymentBlock(
  client: PublicClient,
  address: Address,
  latest: bigint,
): Promise<bigint | null> {
  const hasCodeAt = async (block: bigint) => {
    const code = await client.getCode({ address, blockNumber: block })
    return code !== undefined && code !== '0x'
  }

  if (!(await hasCodeAt(latest))) return null // not a contract at all

  let low = 0n
  let high = latest

  while (low < high) {
    const mid = (low + high) / 2n
    if (await hasCodeAt(mid)) high = mid
    else low = mid + 1n
  }

  return low
}

/**
 * Fetch Transfer logs across a block range.
 *
 * Providers cap how many blocks one eth_getLogs may span, and the cap differs
 * per provider, per chain, and with the contract's traffic. Rather than
 * hardcoding a guess, the span halves on failure and grows back on success, so
 * it self-tunes to whatever the endpoint actually allows.
 */
export async function fetchTransfers(
  client: PublicClient,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
  onProgress?: (block: bigint) => void,
): Promise<TransferRow[]> {
  const rows: TransferRow[] = []
  let span = 50_000n
  let cursor = fromBlock

  while (cursor <= toBlock) {
    const end = cursor + span > toBlock ? toBlock : cursor + span

    try {
      const logs = await client.getLogs({
        address,
        event: TRANSFER_EVENT,
        fromBlock: cursor,
        toBlock: end,
      })

      for (const log of logs) {
        if (!log.args.from || !log.args.to || log.args.value === undefined) continue
        rows.push({
          from: log.args.from.toLowerCase(),
          to: log.args.to.toLowerCase(),
          value: log.args.value,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? '',
          logIndex: log.logIndex ?? 0,
        })
      }

      cursor = end + 1n
      onProgress?.(cursor)
      // Recover gradually. Jumping straight back to the maximum would just trip
      // the same limit again on the next busy stretch.
      if (span < 50_000n) span *= 2n
    } catch (error) {
      // Halve all the way down to a single block. An earlier floor of 500 was
      // wrong: "response too large" is a range error, and a high-traffic token
      // (Base WETH, for one) blows the limit well below that. Only a failure at
      // a span of one block is genuinely not about range.
      if (span <= 1n) {
        throw new Error(
          `eth_getLogs failed on a single block (${cursor}) for ${address}: ` +
            `${error instanceof Error ? error.message : String(error)}. ` +
            'This provider cannot serve this contract — configure a dedicated RPC.',
        )
      }
      span = span / 2n > 0n ? span / 2n : 1n
    }
  }

  return rows
}

/** Everything one job produces. */
export interface IndexResult {
  facts: TokenFacts
  holders: HolderRow[]
  earlyBuyers: EarlyBuyer[]
  transfers: TransferRow[]
  factors: HealthFactor[]
  score: number
  latestBlock: bigint
}

export async function indexToken(
  chainId: number,
  rawAddress: string,
  maxLookback: bigint,
  onProgress?: (message: string) => void,
): Promise<IndexResult> {
  const client = clientFor(chainId)
  const address = getAddress(rawAddress)

  const latestBlock = await client.getBlockNumber()
  onProgress?.(`latest block ${latestBlock}`)

  const meta = await readTokenFacts(client, address)
  onProgress?.(`metadata ${meta.symbol || '(no symbol)'} decimals=${meta.decimals}`)

  const deployedBlock = await findDeploymentBlock(client, address, latestBlock)
  if (deployedBlock === null) {
    throw new Error('No bytecode at this address on this chain — not a contract')
  }
  onProgress?.(`deployed at block ${deployedBlock}`)

  // Cap the walk so one ancient, busy token cannot monopolise the worker.
  const floor = latestBlock > maxLookback ? latestBlock - maxLookback : 0n
  const fromBlock = deployedBlock > floor ? deployedBlock : floor
  const complete = fromBlock === deployedBlock

  const transfers = await fetchTransfers(client, address, fromBlock, latestBlock, (block) =>
    onProgress?.(`scanned to ${block}`),
  )
  onProgress?.(`${transfers.length} transfers`)

  const facts: TokenFacts = { ...meta, deployedBlock, complete }
  // Only a full walk yields real balances; otherwise these stay window-local
  // and are neither scored nor persisted as holders.
  const holders = deriveHolders(transfers)
  const earlyBuyers = complete ? deriveEarlyBuyers(transfers, holders) : []
  const { factors, score } = computeHealth(facts, holders, transfers, latestBlock, maxLookback)

  return { facts, holders, earlyBuyers, transfers, factors, score, latestBlock }
}
