import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Shows secrets (access key, password) exactly once, with copy/download. */
export function SecretDialog({ open, title, description, fields, filename, onClose }: { open: boolean; title: string; description: string; fields: { label: string; value: string }[]; filename: string; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }
  function download() {
    const text = fields.map((f) => `${f.label}: ${f.value}`).join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Credentials file downloaded')
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</span>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{f.value}</code>
                <Button variant="ghost" size="icon-xs" onClick={() => copy(f.label, f.value)} aria-label={`Copy ${f.label}`} className="text-muted-foreground hover:text-primary">{copied === f.label ? <Check className="text-green-500" /> : <Copy />}</Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-warning">This is the only time these values are shown. Store them somewhere safe before closing.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={download}><Download />Download .txt</Button>
          <Button onClick={onClose}>I've saved them</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
