import { useState } from 'react'
import { useLogStore } from '../store/logStore'

export function LogsPanel() {
  const entries = useLogStore((s) => s.entries)
  const clear = useLogStore((s) => s.clear)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex h-full flex-col bg-white text-xs dark:bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 dark:border-gray-800">
        <span className="font-medium text-gray-600 dark:text-gray-300">
          {entries.length} request{entries.length === 1 ? '' : 's'}
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
            No requests yet. Run a query to see it here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((cur) => (cur === e.id ? null : e.id))
                  }
                  className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      e.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="w-16 shrink-0 text-gray-400">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                  <span className="font-mono text-gray-700 dark:text-gray-200">
                    {e.service}.{e.operation}
                  </span>
                  <span className="ml-auto text-gray-400">{e.durationMs}ms</span>
                </button>
                {expanded === e.id && (
                  <pre className="max-h-64 overflow-auto border-t border-gray-100 bg-gray-50 p-3 font-mono text-[11px] leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                    {JSON.stringify(
                      {
                        request: { params: e.params },
                        response: e.status === 'ok' ? e.result : e.error,
                      },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
