import { Button } from '@/components/ui/button'

interface StatCounterProps {
  label: string
  value: number | string
  /** Optional secondary line, e.g. a running/stopped breakdown. */
  detail?: string
  onClick?: () => void
}

export function StatCounter({ label, value, detail, onClick }: StatCounterProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={!onClick}
      className="flex h-auto flex-1 flex-col items-center gap-0.5 px-3 py-2 text-center whitespace-normal disabled:opacity-100"
    >
      <span className="text-2xl font-semibold text-primary">{value}</span>
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      <span className="text-[11px] font-normal text-muted-foreground">{detail ?? ' '}</span>
    </Button>
  )
}
