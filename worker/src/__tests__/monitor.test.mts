/**
 * Threshold logic for the watchlist monitor.
 * Run: npx tsx src/__tests__/monitor.test.mts
 */
import assert from 'node:assert/strict'
import { evaluate } from '../rules.js'

const at = (priceUsd: number | null, liquidityUsd: number, volume24hUsd = 1000) => ({
  priceUsd, liquidityUsd, volume24hUsd,
})

// No baseline: record silently rather than alerting on first sight.
assert.equal(evaluate(null, at(1, 100_000)), null, 'first observation must not alert')
console.log('✓ first observation records a baseline without alerting')

// Liquidity is the rug signal and outranks everything else.
const rug = evaluate(at(1, 100_000), at(0.5, 50_000))
assert.equal(rug?.rule, 'liquidity_drop')
assert.equal(rug?.severity, 'critical')
assert.match(rug!.detail, /50%/, 'states the size of the drop')
assert.match(rug!.detail, /\$100,000/, 'states where it fell from')
console.log('✓ liquidity drop wins over a simultaneous price drop, and is critical')

// A 29% liquidity fall is under the bar — deliberately quiet.
assert.equal(evaluate(at(1, 100_000), at(1, 71_000)), null, '29% must stay under the threshold')
console.log('✓ sub-threshold liquidity movement stays silent')

const drop = evaluate(at(1, 100_000), at(0.7, 100_000))
assert.equal(drop?.rule, 'price_drop')
assert.equal(drop?.severity, 'warning')
console.log('✓ price drop alone is a warning')

const spike = evaluate(at(1, 100_000), at(1.8, 100_000))
assert.equal(spike?.rule, 'price_spike')
assert.equal(spike?.severity, 'info')
console.log('✓ price spike is informational, not alarming')

// Ordinary noise must never fire, or people learn to ignore alerts.
assert.equal(evaluate(at(1, 100_000), at(1.05, 98_000)), null, '5% wobble is noise')
console.log('✓ everyday noise produces nothing')

// Volume spikes need absolute size too, or dust tokens alert constantly.
assert.equal(evaluate(at(1, 100_000, 100), at(1, 100_000, 500)), null, 'tiny volume cannot spike')
const vol = evaluate(at(1, 100_000, 5_000), at(1, 100_000, 50_000))
assert.equal(vol?.rule, 'volume_spike')
console.log('✓ volume spike requires meaningful absolute volume')

// A token with no price still gets liquidity monitoring.
const quoteSide = evaluate(at(null, 100_000), at(null, 40_000))
assert.equal(quoteSide?.rule, 'liquidity_drop', 'price-less tokens still monitored')
console.log('✓ tokens without a usable price are still watched for liquidity')

console.log('\nall monitor threshold tests passed')
