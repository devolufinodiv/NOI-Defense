// Temporary harness: verifies the on-chain half of the worker against a real
// contract. No Supabase involved.
import { indexToken } from './src/indexer.js'

const CHAIN = Number(process.argv[2] ?? 8453)
const ADDRESS = process.argv[3] ?? '0x4200000000000000000000000000000000000006'

const t0 = Date.now()
const r = await indexToken(CHAIN, ADDRESS, (m) => console.log('  ·', m))

console.log('\n── result ──────────────────────────────')
console.log('symbol/name   :', r.facts.symbol, '/', r.facts.name)
console.log('decimals      :', r.facts.decimals)
console.log('totalSupply   :', r.facts.totalSupply.toString())
console.log('deployedBlock :', r.facts.deployedBlock?.toString())
console.log('complete      :', r.facts.complete)
console.log('transfers     :', r.transfers.length)
console.log('holders       :', r.holders.length)
console.log('earlyBuyers   :', r.earlyBuyers.length)
console.log('health score  :', r.score)
console.log('\ntop 3 holders:')
for (const h of r.holders.slice(0, 3)) console.log('   ', h.holder, h.balance.toString())
console.log('\nfactors:')
for (const f of r.factors) console.log(`    ${f.status.padEnd(4)} ${String(f.score).padStart(3)}  ${f.factorId}: ${f.detail}`)
console.log('\nelapsed:', ((Date.now() - t0) / 1000).toFixed(1) + 's')
