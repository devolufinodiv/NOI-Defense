import { getAddress } from 'viem'

/**
 * Where a token's real logo comes from.
 *
 * Derived from the address rather than fetched, so a card can show the right
 * icon on first paint with no extra round trip and nothing to store. The asset
 * repository keys on the EIP-55 checksummed address, which is why this goes
 * through viem instead of upper-casing by hand — a lower-case address 404s.
 *
 * Coverage is good but not total. `TokenMark` treats a miss as a miss and falls
 * back to its own glyph, so a token without a published logo still reads as
 * itself rather than as a broken image.
 */
const LOGO_CHAIN: Record<number, string> = {
  1: 'ethereum',
  56: 'smartchain',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  43114: 'avalanchec',
  8453: 'base',
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

export function tokenLogoUrl(
  chainId: number | undefined,
  address: string | undefined | null,
): string | null {
  if (chainId === undefined || !address || !ADDRESS.test(address)) return null

  const chain = LOGO_CHAIN[chainId]
  if (!chain) return null

  try {
    const checksummed = getAddress(address)
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${checksummed}/logo.png`
  } catch {
    return null
  }
}
