import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { DB_BUSY, DB_STATUS_LABEL, dbStatusTone } from '../lib/rds'

const TONES = {
  green: { dot: 'bg-green-500', pill: 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300' },
  gray: { dot: 'bg-gray-400', pill: 'bg-muted text-muted-foreground' },
  red: { dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' },
  amber: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
}

export function DbStatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const tone = TONES[dbStatusTone(status)]
  return (
    <Badge variant="secondary" className={cn('gap-1.5 border-transparent', tone.pill, size === 'md' ? 'h-6 px-2.5 text-xs' : 'h-5 px-2 text-[11px]')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot, DB_BUSY.has(status) && 'animate-pulse')} />
      {DB_STATUS_LABEL[status] ?? status ?? 'Unknown'}
    </Badge>
  )
}
