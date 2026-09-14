import { Check, Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'

export function Detail({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-all text-right', mono ? 'font-mono text-xs' : 'font-medium')}>{value}</dd>
    </div>
  )
}

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="break-all">{text || '—'}</span>
      {text && <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy" className="size-5 shrink-0 text-muted-foreground hover:text-primary">{copied ? <Check className="text-green-500" /> : <Copy />}</Button>}
    </span>
  )
}

export function IamHeader({ icon, title, subtitle, badge, actions }: { icon: ReactNode; title: string; subtitle: ReactNode; badge?: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold">{title}</h1>{badge}</div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 border-t pt-4 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">{actions}</div>
    </div>
  )
}
