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
