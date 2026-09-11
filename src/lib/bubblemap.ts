/**
 * Holder-cluster map links.
 *
 * The external map only covers some networks. Returning null for the rest is
 * deliberate: a link that lands on "unsupported chain" is worse than no link,
 * because the user has already spent the click and the trust.
 */
const SLUGS: Record<number, string> = {
  1: 'eth',
  56: 'bsc',
  137: 'poly',
  42161: 'arbi',
  43114: 'avax',
  8453: 'base',
}

export function bubblemapUrl(chainId: number, address: string): string | null {
  const slug = SLUGS[chainId]
  if (!slug) return null
  return `https://app.bubblemaps.io/${slug}/token/${address.toLowerCase()}`
}

export function bubblemapSupported(chainId: number): boolean {
  return chainId in SLUGS
}
