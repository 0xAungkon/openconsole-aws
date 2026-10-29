import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast, type ExternalToast } from 'sonner'
import { cn } from 'cn'
import { copyText } from './clipboard'

/**
 * Error toasts linger longer than the 4s default so the copy button is
 * actually reachable before the toast slides away.
 */
export const ERROR_TOAST_DURATION = 8000

/** Options callers may pass through to sonner, minus the ones we own. */
export type ErrorToastOptions = Omit<ExternalToast, 'action' | 'cancel' | 'jsx'>

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function onClick(event: React.MouseEvent) {
    // Keep the click from reaching the toast's own swipe/press handlers.
    event.stopPropagation()
    if (await copyText(text)) {
      setState('copied')
      window.setTimeout(() => setState('idle'), 2000)
    } else {
      setState('failed')
      window.setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy error message"
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-md border border-border/70 bg-background/70 px-2 text-xs font-medium text-foreground transition-colors',
        'hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
        state === 'copied' && 'border-success/40 text-success',
        state === 'failed' && 'border-destructive/40 text-destructive',
      )}
    >
      {state === 'copied' ? <Check className="size-3" /> : <Copy className="size-3" />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  )
}

/**
 * `toast.error` with a copy button attached, so a failed AWS call can be pasted
 * into a ticket or a chat instead of transcribed by hand.
 *
 * The copied text is the title plus the description when there is one — the
 * full picture of what went wrong.
 */
export function toastError(message: string, options: ErrorToastOptions = {}) {
  const { description, duration = ERROR_TOAST_DURATION, ...rest } = options
  const copied = typeof description === 'string' && description ? `${message}\n\n${description}` : message

  return toast.error(message, {
    duration,
    description,
    action: <CopyButton text={copied} />,
    ...rest,
  })
}
