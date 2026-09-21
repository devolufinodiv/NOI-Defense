import { getAddress, isAddress } from 'viem'

/**
 * Accepts any well-formed 40-hex address regardless of letter casing.
 *
 * viem's `isAddress` validates the EIP-55 checksum by default, which rejects
 * perfectly real addresses that happen to be lowercased or mis-cased. People
 * paste addresses out of logs, spreadsheets and block explorers all day; a
 * checksum failure is not the same thing as an invalid address, and treating it
 * as one makes the search box feel broken.
 *
 * Checksum casing is a transport-level integrity hint, not part of the address.
 */
export function isValidAddress(value: string): value is `0x${string}` {
  return isAddress(value, { strict: false })
}

/**
 * Canonical EIP-55 checksummed form, for display and for cache keys.
 * Lowercases first so a mis-cased input is corrected rather than preserved.
 */
export function normalizeAddress(value: string): `0x${string}` {
  return getAddress(value.toLowerCase())
}

/**
 * Pulls an address out of whatever was pasted.
 *
 * People rarely paste a bare address. They paste an explorer link, a line from
 * a spreadsheet, a message with the address in the middle of it. Requiring a
 * clean 0x… makes the box feel broken for input that plainly contains exactly
 * what we need.
 *
 * Returns null when the text holds no address, or more than one — with two
 * candidates there is no way to know which was meant, and picking one silently
 * would send someone to a page about the wrong contract.
 */
export function extractAddress(text: string): `0x${string}` | null {
  const matches = text.match(/0x[0-9a-fA-F]{40}/g)
  if (!matches) return null

  const unique = [...new Set(matches.map((m) => m.toLowerCase()))]
  if (unique.length !== 1) return null

  return isValidAddress(unique[0]) ? (unique[0] as `0x${string}`) : null
}
