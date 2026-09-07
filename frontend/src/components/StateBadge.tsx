import { stateLabel, stateTone } from '../lib/ec2'

const TONES: Record<string, { dot: string; pill: string }> = {
  green: {
    dot: 'bg-green-500',
    pill: 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  },
  gray: {
    dot: 'bg-gray-400',
    pill: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
  red: {
    dot: 'bg-red-500',
    pill: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  },
  amber: {
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
}

/** Friendly status pill with a colored dot, e.g. "● Running". */
export function StateBadge({ state, size = 'sm' }: { state: string; size?: 'sm' | 'md' }) {
  const tone = TONES[stateTone(state)]
  const pulse = ['pending', 'stopping', 'shutting-down', 'rebooting'].includes(state)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${tone.pill} ${
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${pulse ? 'animate-pulse' : ''}`}
      />
      {stateLabel(state)}
    </span>
  )
}
