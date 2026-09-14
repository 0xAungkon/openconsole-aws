import { HistorySyncStatus } from './HistorySyncStatus'
import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { LogEntry } from '../store/logStore'
import { useLogStore } from '../store/logStore'

function responseText(e: LogEntry): string {
  if (e.source === 'cli') {
    const parts: string[] = []
    if (e.stdout) parts.push(e.stdout.replace(/\n+$/, ''))
    if (e.stderr) parts.push(e.stderr.replace(/\n+$/, ''))
    const body = parts.join('\n')
    return body || `(no output — exit code ${e.exitCode ?? 0})`
  }
  const payload = e.status === 'ok' ? e.result : e.error
  return JSON.stringify(payload ?? null, null, 2)
}

function triggerDownload(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function toCsv(entries: LogEntry[]): string {
  const header = ['Time', 'Source', 'Status', 'Duration (ms)', 'Command', 'Response']
  const rows = entries.map((e) =>
    [
      new Date(e.ts).toISOString(),
      e.source,
      e.status,
      String(e.durationMs ?? ''),
      e.command,
      responseText(e),
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.map(csvCell).join(','), ...rows].join('\n')
}

function toMarkdown(entries: LogEntry[]): string {
  const lines = ['# Inspector log', '']
  for (const e of entries) {
    lines.push(
      `## ${new Date(e.ts).toLocaleString()} — ${e.source.toUpperCase()} — ${
        e.status
      }${e.durationMs != null ? ` (${e.durationMs} ms)` : ''}`,
      '',
      '**Command**',
      '',
      '```bash',
      e.command,
      '```',
      '',
      '**Response**',
      '',
      '```',
      responseText(e),
      '```',
      '',
    )
  }
  return lines.join('\n')
}

export function InspectorPanel() {
  const entries = useLogStore((s) => s.entries)
  const clear = useLogStore((s) => s.clear)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }

  return (
    <div className="flex h-full flex-col bg-card text-xs">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="font-medium text-muted-foreground">
          {entries.length} command{entries.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            disabled={entries.length === 0}
            onClick={() => {
              triggerDownload(`inspector-${Date.now()}.csv`, toCsv(entries), 'text/csv')
              toast.success('Inspector log downloaded as CSV')
            }}
            title="Download as CSV"
          >
            <Download />
            CSV
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={entries.length === 0}
            onClick={() => {
              triggerDownload(`inspector-${Date.now()}.md`, toMarkdown(entries), 'text/markdown')
              toast.success('Inspector log downloaded as Markdown')
            }}
            title="Download as Markdown"
          >
            <Download />
            Markdown
          </Button>
          <Button variant="ghost" size="xs" onClick={clear}>
            Clear
          </Button>
        </div>
      </div>

      <HistorySyncStatus />
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="p-4 text-center text-muted-foreground">
            No commands yet. Run an action or use the CLI to see the AWS CLI
            command and its response here.
          </p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => {
              const isOpen = expanded === e.id
              return (
                <li key={e.id}>
                  <Collapsible open={isOpen} onOpenChange={(next) => setExpanded(next ? e.id : null)}>
                    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          e.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        title={e.status === 'ok' ? 'Success' : 'Error'}
                      />
                      <span className="w-16 shrink-0 text-muted-foreground">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`h-4 rounded px-1 text-[10px] uppercase ${
                          e.source === 'cli'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            : ''
                        }`}
                      >
                        {e.source}
                      </Badge>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left font-mono"
                          title={e.command}
                        >
                          {e.command}
                        </button>
                      </CollapsibleTrigger>
                      <span className="shrink-0 text-muted-foreground">{e.durationMs}ms</span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => copy(e.id, e.command)}
                        title="Copy command"
                        aria-label="Copy command"
                        className="text-muted-foreground"
                      >
                        {copied === e.id ? <Check className="text-green-500" /> : <Copy />}
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/40">
                        <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Command
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => copy(`${e.id}-cmd`, e.command)}
                            className="normal-case"
                          >
                            {copied === `${e.id}-cmd` ? (
                              <>
                                <Check className="text-green-500" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="overflow-x-auto px-3 pb-2 pt-1 font-mono text-[11px] text-primary">
                          {e.command}
                        </pre>
                        <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Response
                        </div>
                        <pre className="max-h-64 overflow-auto px-3 pb-3 pt-1 font-mono text-[11px] leading-relaxed">
                          {responseText(e)}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
