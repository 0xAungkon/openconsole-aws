import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
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
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="flex h-full flex-col bg-white text-xs dark:bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 dark:border-gray-800">
        <span className="font-medium text-gray-600 dark:text-gray-300">
          {entries.length} command{entries.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded px-2 py-0.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="p-4 text-center text-gray-400">
            No commands yet. Run an action or use the CLI to see the AWS CLI
            command and its response here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map((e) => {
              const isOpen = expanded === e.id
              return (
                <li key={e.id}>
                  <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        e.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      title={e.status === 'ok' ? 'Success' : 'Error'}
                    />
                    <span className="w-16 shrink-0 text-gray-400">
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1 text-[10px] font-medium uppercase ${
                        e.source === 'cli'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {e.source}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpanded((c) => (c === e.id ? null : e.id))}
                      className="min-w-0 flex-1 truncate text-left font-mono text-gray-700 dark:text-gray-200"
                      title={e.command}
                    >
                      {e.command}
                    </button>
                    <span className="shrink-0 text-gray-400">{e.durationMs}ms</span>
                    <button
                      type="button"
                      onClick={() => copy(e.id, e.command)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                      title="Copy command"
                    >
                      {copied === e.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Command
                        <button
                          type="button"
                          onClick={() => copy(`${e.id}-cmd`, e.command)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 normal-case text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                        >
                          {copied === `${e.id}-cmd` ? (
                            <>
                              <Check className="h-3 w-3 text-green-500" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto px-3 pb-2 pt-1 font-mono text-[11px] text-brand-700 dark:text-brand-300">
                        {e.command}
                      </pre>
                      <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Response
                      </div>
                      <pre className="max-h-64 overflow-auto px-3 pb-3 pt-1 font-mono text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
                        {responseText(e)}
                      </pre>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
