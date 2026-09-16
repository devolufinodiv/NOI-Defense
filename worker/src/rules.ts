/**
 * Alert thresholds.
 *
 * Pure and dependency-free so the rules can be tested on their own — the
 * monitor imports the database client, which needs a full environment just to
 * load, and that should not be a prerequisite for checking arithmetic.
 *
 * NOTE: these thresholds are mirrored by `public.sweep_alerts()` in
 * supabase/migrations. That copy is the one that runs today, because it needs
 * neither a service-role key nor a host, while this worker needs both. The
 * duplication is deliberate and the two must be changed together — the tests
 * beside this file are what pin the numbers.
 */

export interface Observation {
  priceUsd: number | null
  liquidityUsd: number
  volume24hUsd: number
}

export interface Rule {
  rule: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

/**
 * Thresholds.
 *
 * Set where a move is genuinely actionable rather than merely visible. A 5%
 * price wobble is noise in this asset class; alerting on it would train people
 * to ignore the alerts, which is worse than not sending them.
 */
const LIQUIDITY_DROP = 0.3
const PRICE_DROP = 0.25
const PRICE_SPIKE = 0.5
const VOLUME_SPIKE = 3
const MIN_VOLUME_FOR_SPIKE = 10_000

const pct = (value: number) => `${Math.abs(Math.round(value * 100))}%`
const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`

/**
 * Decides whether this observation is worth waking someone for.
 *
 * Only the single most serious finding is returned. Firing three alerts for one
 * event — price fell, liquidity fell, volume spiked — describes one rug three
 * times and buries the useful sentence.
 */
export function evaluate(previous: Observation | null, current: Observation): Rule | null {
  // Nothing to compare against yet: record the baseline, say nothing.
  if (!previous) return null

  if (previous.liquidityUsd > 0) {
    const change = (current.liquidityUsd - previous.liquidityUsd) / previous.liquidityUsd
    if (change <= -LIQUIDITY_DROP) {
      return {
        rule: 'liquidity_drop',
        severity: 'critical',
        title: 'Money is leaving this token',
        detail:
          `The pool you would sell into shrank ${pct(change)}, from ${money(previous.liquidityUsd)} ` +
          `to ${money(current.liquidityUsd)}. This is what a rug pull looks like as it happens.`,
      }
    }
  }

  if (previous.priceUsd && current.priceUsd) {
    const change = (current.priceUsd - previous.priceUsd) / previous.priceUsd
    if (change <= -PRICE_DROP) {
      return {
        rule: 'price_drop',
        severity: 'warning',
        title: 'Price dropped sharply',
        detail: `Down ${pct(change)} since we last checked.`,
      }
    }
    if (change >= PRICE_SPIKE) {
      return {
        rule: 'price_spike',
        severity: 'info',
        title: 'Price jumped',
        detail: `Up ${pct(change)} since we last checked. Sudden spikes often reverse just as fast.`,
      }
    }
  }

  if (previous.volume24hUsd > 0 && current.volume24hUsd > MIN_VOLUME_FOR_SPIKE) {
    const ratio = current.volume24hUsd / previous.volume24hUsd
    if (ratio >= VOLUME_SPIKE) {
      return {
        rule: 'volume_spike',
        severity: 'info',
        title: 'Trading suddenly picked up',
        detail: `Volume is ${Math.round(ratio)}x what it was, at ${money(current.volume24hUsd)}.`,
      }
    }
  }

  return null
}

