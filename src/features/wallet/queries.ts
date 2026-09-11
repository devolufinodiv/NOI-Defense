import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { env, hasSupabase } from '@/config/env'
import { supabase } from '@/lib/supabase'

export type AccountType = 'wallet' | 'smart-wallet' | 'contract'

export interface WalletTrace {
  address: {
    chainId: number
    address: string
    isContract: boolean
    accountType: AccountType
    nativeSymbol: string
  }
  onchain: {
    reachedNode: boolean
    balance: number | null
    outgoingTransactions: number | null
  }
  /** null means no coverage on this chain — NOT that the wallet is inactive. */
  history: {
    firstSeen: number | null
    lastSeen: number | null
    txCount: number
    counterparties: Array<{ address: string; count: number; label: string }>
    tokens: Array<{ symbol: string; name: string; address: string; transfers: number }>
    truncated: boolean
  } | null
  historyStatus: 'ok' | 'chain-unsupported' | 'not-configured' | 'failed'
  historyAvailable: boolean
  summary: string
}

/** Why history is missing, in words a user can act on. */
export const HISTORY_GAP: Record<string, string> = {
  'chain-unsupported':
    'Detailed history isn’t available on this network yet. The balance and transaction count above are still read live from the chain.',
  'not-configured':
    'Detailed history isn’t switched on yet. The balance and transaction count above are still read live from the chain.',
  failed:
    'We couldn’t load the detailed history just now. The balance and transaction count above are still read live from the chain.',
}

export const ACCOUNT_COPY: Record<AccountType, { label: string; plain: string }> = {
  wallet: { label: 'Personal wallet', plain: 'An ordinary wallet controlled by whoever holds its key.' },
  'smart-wallet': {
    label: 'Smart wallet',
    plain: 'A personal wallet with smart-account features switched on. It still belongs to a person.',
  },
  contract: {
    label: 'Smart contract',
    plain: 'A program on the blockchain, not a person’s wallet.',
  },
}

async function runTrace(chainId: number, address: string): Promise<WalletTrace> {
  if (!hasSupabase) throw new Error('Tracing is not configured. Add the project URL and key.')

  const token = (await supabase?.auth.getSession())?.data.session?.access_token

  const res = await fetch(
    `${env.supabaseUrl}/functions/v1/wallet-trace?chainId=${chainId}&address=${address}`,
    {
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${token ?? env.supabaseAnonKey}`,
      },
    },
  )

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Trace failed (${res.status})`)
  return body as WalletTrace
}

export function useWalletTrace(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<WalletTrace> {
  return useQuery({
    queryKey: ['wallet-trace', chainId, address.toLowerCase()],
    queryFn: () => runTrace(chainId, address),
    enabled: enabled && address.length > 0,
    staleTime: 60_000,
    retry: 1,
  })
}
