import { clientFor, sleep } from './rpc.js'
import { config } from './config.js'
import { indexToken } from './indexer.js'
import { claimJob, finishJob, heartbeat, markTokenFailed, persist, reapStalled } from './store.js'
import { runMonitorPass } from './monitor.js'

const runOnce = process.argv.includes('--once')

let shuttingDown = false
let activeJob: string | null = null

function log(message: string, extra?: Record<string, unknown>) {
  const line = { ts: new Date().toISOString(), worker: config.workerId, message, ...extra }
  console.log(JSON.stringify(line))
}

/**
 * Block timestamps, cached.
 *
 * Every early buyer and trade needs a wall-clock time, and thousands of rows
 * routinely share a few hundred blocks. Fetching per row would dominate the
 * job's runtime; this collapses it to one call per distinct block.
 */
function makeTimestampResolver(chainId: number) {
  const cache = new Map<string, Date>()
  const client = clientFor(chainId)

  return {
    async warm(blocks: bigint[]): Promise<void> {
      const unique = [...new Set(blocks.map(String))].filter((b) => !cache.has(b))
      // Small concurrency: enough to hide latency, not enough to trip rate limits.
      const size = 8
      for (let i = 0; i < unique.length; i += size) {
        const batch = unique.slice(i, i + size)
        await Promise.all(
          batch.map(async (block) => {
            try {
              const info = await client.getBlock({ blockNumber: BigInt(block) })
              cache.set(block, new Date(Number(info.timestamp) * 1000))
            } catch {
              // A missing timestamp must not fail the job; fall back to now.
              cache.set(block, new Date())
            }
          }),
        )
      }
    },
    resolve(block: bigint): Date {
      return cache.get(String(block)) ?? new Date()
    },
  }
}

async function processJob(job: {
  id: string
  chain_id: number
  address: string
  attempts: number
}) {
  activeJob = job.id
  const started = Date.now()
  log('job.start', { job: job.id, chain: job.chain_id, address: job.address, attempt: job.attempts })

  // Keep the reaper from reclaiming a job that is genuinely still working.
  const beat = setInterval(() => {
    heartbeat(job.id).catch(() => {})
  }, 30_000)

  try {
    const result = await indexToken(clientFor(job.chain_id), job.address, config.maxLookback, (message) =>
      log('job.progress', { job: job.id, detail: message }),
    )

    const timestamps = makeTimestampResolver(job.chain_id)
    await timestamps.warm([
      ...result.earlyBuyers.map((b) => b.blockNumber),
      ...result.transfers.slice(-200).map((t) => t.blockNumber),
    ])

    await persist(job.chain_id, job.address, result, (block) => timestamps.resolve(block))
    await finishJob(job.id)

    log('job.done', {
      job: job.id,
      ms: Date.now() - started,
      holders: result.holders.length,
      transfers: result.transfers.length,
      score: result.score,
      complete: result.facts.complete,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('job.failed', { job: job.id, error: message, ms: Date.now() - started })
    // Record it on the token too, so the UI can explain rather than spin.
    await markTokenFailed(job.chain_id, job.address, message).catch(() => {})
    await finishJob(job.id, message).catch(() => {})
  } finally {
    clearInterval(beat)
    activeJob = null
  }
}

async function main() {
  log('worker.start', { once: runOnce, lookback: String(config.maxLookback) })

  // Reclaim anything a previous crash left stranded in 'running'.
  const reaped = await reapStalled().catch(() => 0)
  if (reaped) log('worker.reaped', { jobs: reaped })

  let idleTicks = 0
  let lastMonitorAt = 0

  // Watchlist monitoring shares this process. It is cheap (one batched request
  // per chain) and runs on its own cadence rather than per loop iteration, so a
  // busy index queue cannot starve it and an idle one cannot hammer the feed.
  const monitorEveryMs = config.monitorIntervalMs

  async function maybeMonitor() {
    if (Date.now() - lastMonitorAt < monitorEveryMs) return
    lastMonitorAt = Date.now()
    try {
      const raised = await runMonitorPass(log)
      if (raised > 0) log('monitor.pass', { alerts: raised })
    } catch (error) {
      log('monitor.failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  while (!shuttingDown) {
    await maybeMonitor()

    let job = null
    try {
      job = await claimJob()
    } catch (error) {
      log('queue.error', { error: error instanceof Error ? error.message : String(error) })
      await sleep(config.pollIntervalMs)
      continue
    }

    if (!job) {
      if (runOnce) {
        log('worker.idle_exit')
        break
      }
      idleTicks += 1
      // Reap periodically while idle rather than on a second timer.
      if (idleTicks % 12 === 0) {
        const n = await reapStalled().catch(() => 0)
        if (n) log('worker.reaped', { jobs: n })
      }
      await sleep(config.pollIntervalMs)
      continue
    }

    idleTicks = 0
    await processJob(job)
    if (runOnce) break
  }

  log('worker.stop')
}

// Finish the job in flight before exiting, so a deploy doesn't strand work
// mid-write and leave the token half-populated.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1) // second signal: give up and go
    shuttingDown = true
    log('worker.draining', { signal, activeJob })
  })
}

main().catch((error) => {
  log('worker.crashed', { error: error instanceof Error ? error.stack : String(error) })
  process.exit(1)
})
