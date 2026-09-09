/**
 * Pure-function tests for the derivation logic.
 *
 * These cover the complete-history path, which a live scan can't reach quickly
 * on a busy mainnet token. Run with: npx tsx src/__tests__/derive.test.mts
 */
import assert from 'node:assert/strict'
import { deriveHolders, deriveEarlyBuyers, computeHealth, type TransferRow, type TokenFacts } from '../derive.js'

const ZERO = '0x0000000000000000000000000000000000000000'
const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const C = '0x3333333333333333333333333333333333333333'

let n = 0
const t = (from: string, to: string, value: bigint): TransferRow => ({
  from, to, value,
  blockNumber: BigInt(100 + n),
  txHash: '0x' + (++n).toString(16).padStart(64, '0'),
  logIndex: 0,
})

// Mint 1000 to A, A sends 400 to B, B sends all 400 to C, C burns 100.
const transfers: TransferRow[] = [
  t(ZERO, A, 1000n),
  t(A, B, 400n),
  t(B, C, 400n),
  t(C, ZERO, 100n),
]

const holders = deriveHolders(transfers)
const balances = Object.fromEntries(holders.map((h) => [h.holder, h.balance]))

assert.equal(balances[A], 600n, 'A should hold 1000 - 400')
assert.equal(balances[C], 300n, 'C should hold 400 - 100 burned')
assert.equal(balances[B], undefined, 'B forwarded everything and must not appear')
assert.ok(!holders.some((h) => h.holder === ZERO), 'zero address is never a holder')
assert.ok(holders[0].balance >= holders[holders.length - 1].balance, 'sorted descending')
console.log('✓ deriveHolders: balances, zero-address exclusion, ordering')

const buyers = deriveEarlyBuyers(transfers, holders)
assert.equal(buyers.length, 3, 'A, B and C each entered once')
assert.equal(buyers[0].wallet, A, 'first recipient ranks first')
assert.equal(buyers[0].status, 'partial', 'A kept 600 of 1000')
assert.equal(buyers[0].remainingPct, 60)
assert.equal(buyers[1].wallet, B)
assert.equal(buyers[1].status, 'sold', 'B forwarded 100%')
assert.equal(buyers[2].wallet, C)
assert.equal(buyers[2].status, 'partial', 'C burned a quarter')
assert.equal(buyers[2].remainingPct, 75)
console.log('✓ deriveEarlyBuyers: entry order, hold status, remaining %')

// Duplicate receipts must not create a second entry for the same wallet.
const repeat = [...transfers, t(ZERO, A, 50n)]
assert.equal(
  deriveEarlyBuyers(repeat, deriveHolders(repeat)).filter((b) => b.wallet === A).length,
  1,
  'a wallet enters the early-buyer list at most once',
)
console.log('✓ deriveEarlyBuyers: no duplicate entries')

const facts = (complete: boolean): TokenFacts => ({
  symbol: 'TEST', name: 'Test', decimals: 18,
  totalSupply: 1000n, deployedBlock: 100n, complete,
})

const full = computeHealth(facts(true), holders, transfers, 200_000n, 400_000n)
const ids = full.factors.map((f) => f.factorId)
assert.ok(ids.includes('holder-concentration'), 'full history reports concentration')
assert.ok(ids.includes('holder-count'), 'full history reports holder count')

const partial = computeHealth(facts(false), holders, transfers, 200_000n, 400_000n)
const partialIds = partial.factors.map((f) => f.factorId)
assert.ok(!partialIds.includes('holder-concentration'), 'partial history omits concentration')
assert.ok(!partialIds.includes('holder-count'), 'partial history omits holder count')
assert.ok(
  partial.factors.find((f) => f.factorId === 'data-coverage')?.detail.includes('unavailable'),
  'partial history says why those factors are missing',
)
console.log('✓ computeHealth: concentration gated on complete history')

assert.ok(full.score >= 0 && full.score <= 100, 'score stays in range')
console.log('✓ computeHealth: score bounded\n')
console.log('all derivation tests passed')
