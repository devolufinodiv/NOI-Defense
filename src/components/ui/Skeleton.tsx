import { cn } from '@/lib/cn'

/** Loading placeholder: a soft sweep across a raised block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-sm bg-raised', className)}>
      <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-scan bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  )
}

export function SkeletonText({ width = 'w-32', className }: { width?: string; className?: string }) {
  return <Skeleton className={cn('h-3.5', width, className)} />
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-hairline">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <SkeletonText width="w-36" />
          <SkeletonText width="w-20" className="ml-auto" />
          <SkeletonText width="w-16" />
        </div>
      ))}
    </div>
  )
}
