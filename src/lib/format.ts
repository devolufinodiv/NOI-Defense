/**
 * Formatting for on-chain values.
 *
 * HARD RULE: token amounts never touch a JS float. `number` cannot represent
 * 18-decimal balances (2^53 runs out around 9e15, and a single wei-precise
 * balance is up to 1e18+), so every conversion here is exact integer/string
 * math on `bigint`. Only already-rounded display strings are produced.
 */

/** Split a raw base-unit integer into exact integer and fractional digit strings. */
export function splitUnits(
  raw: bigint,
  decimals: number,
): { negative: boolean; int: string; frac: string } {
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const digits = abs.toString().padStart(decimals + 1, '0')
  const cut = digits.length - decimals
  return {
    negative,
    int: digits.slice(0, cut),
    frac: decimals > 0 ? digits.slice(cut) : '',
  }
}

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const COMPACT_UNITS = [
  { digits: 12, suffix: 'T' },
  { digits: 9, suffix: 'B' },
  { digits: 6, suffix: 'M' },
  { digits: 3, suffix: 'K' },
] as const

export interface TokenAmountOptions {
  /** Max fractional digits to display. Default 4. */
  maxFractionDigits?: number
  /** Abbreviate ≥ 1,000,000 as 1.23M / 4.5B. Default false. */
  compact?: boolean
  /** Render a leading `+` for positive values (P&L deltas). Default false. */
  signed?: boolean
}

/**
 * Format a raw base-unit amount for display.
 *
 * Fractions are TRUNCATED, never rounded up: showing a balance larger than the
 * one actually held would be a correctness bug in an investigation tool.
 * Non-zero amounts that truncate to zero render as `<0.0001` rather than `0`.
 */
export function formatTokenAmount(
  raw: bigint,
  decimals: number,
  options: TokenAmountOptions = {},
): string {
  const { maxFractionDigits = 4, compact = false, signed = false } = options
  const { negative, int, frac } = splitUnits(raw, decimals)

  const sign = negative ? '-' : signed && raw > 0n ? '+' : ''

  if (compact && int.length > 6) {
    const unit = COMPACT_UNITS.find((u) => int.length > u.digits)
    if (unit) {
      const head = int.slice(0, int.length - unit.digits)
      const tail = int.slice(int.length - unit.digits, int.length - unit.digits + 2)
      const trimmed = tail.replace(/0+$/, '')
      return `${sign}${head}${trimmed ? `.${trimmed}` : ''}${unit.suffix}`
    }
  }

  const shownFrac = frac.slice(0, maxFractionDigits).replace(/0+$/, '')

  if (int === '0' && shownFrac === '' && raw !== 0n) {
    const epsilon = `0.${'0'.repeat(Math.max(0, maxFractionDigits - 1))}1`
    return `${negative ? '-' : ''}<${epsilon}`
  }

  return `${sign}${groupThousands(int)}${shownFrac ? `.${shownFrac}` : ''}`
}

/** Parse a human decimal string into raw base units. Exact; no float step. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim().replace(/,/g, '')
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(trimmed)
  if (!match) throw new Error(`Not a decimal amount: ${value}`)
  const [, sign, intPart = '', fracPart = ''] = match
  const frac = fracPart.slice(0, decimals).padEnd(decimals, '0')
  const raw = BigInt(`${intPart || '0'}${frac}`)
  return sign === '-' ? -raw : raw
}

/** USD figures are display-only and pre-rounded upstream; safe as `number`. */
export function formatUsd(value: number, options: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (options.compact && abs >= 1_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: abs < 1 ? 4 : 2,
    maximumFractionDigits: abs < 1 ? 6 : 2,
  }).format(value)
}

export function formatPercent(value: number, { signed = false } = {}): string {
  if (!Number.isFinite(value)) return '—'
  const sign = signed && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Split a display price into its integer and fractional halves so the quote
 * readout can mute the decimals. Display-only — never used for token math.
 */
export function splitQuote(value: number, maxFractionDigits = 2): { whole: string; fraction: string } {
  if (!Number.isFinite(value)) return { whole: '—', fraction: '' }
  const abs = Math.abs(value)
  // Sub-dollar prices need real precision or they collapse to "0.00".
  const subDollar = abs < 1
  const digits = subDollar ? Math.max(maxFractionDigits, 6) : maxFractionDigits
  const [whole = '0', fraction = ''] = abs.toFixed(digits).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return {
    whole: `${value < 0 ? '-' : ''}${grouped}`,
    // Only sub-dollar values trim trailing zeros; a price of exactly 1 must
    // read "$1.00", not "$1" — a bare integer doesn't look like money.
    fraction: subDollar ? fraction.replace(/0+$/, '') : fraction,
  }
}

/** Which accent a value earns. Red and green are reserved for exactly this. */
export type Tone = 'positive' | 'negative' | 'neutral'

export function toneOf(value: number, { neutralAt = 0 } = {}): Tone {
  if (!Number.isFinite(value) || value === neutralAt) return 'neutral'
  return value > neutralAt ? 'positive' : 'negative'
}

/** `0x1234...ab90` — the canonical address rendering across the product. */
export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (!address) return ''
  if (address.length <= lead + tail + 1) return address
  return `${address.slice(0, lead)}…${address.slice(-tail)}`
}

/** Hashes get more visible entropy than addresses — they're used to eyeball-match. */
export function truncateHash(hash: string, lead = 10, tail = 8): string {
  return truncateAddress(hash, lead, tail)
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

/** `2m ago`-style relative time from a unix seconds timestamp. */
export function formatRelativeTime(unixSeconds: number, now = Date.now()): string {
  let duration = (unixSeconds * 1000 - now) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return '—'
}
