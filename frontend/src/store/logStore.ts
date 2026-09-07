import { create } from 'zustand'
import { appendHistory, clearHistory } from './historyEvents'

export interface LogEntry {
  id: string
  ts: number
  /** 'gui' = a proxied action from the UI; 'cli' = typed in the terminal. */
  source: 'gui' | 'cli'
  /** Copy-pasteable AWS CLI command equivalent to this call. */
  command: string
  status: 'ok' | 'error'
  durationMs: number
  // GUI (proxy) calls
  service?: string
  operation?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: string; message: string }
  // CLI runs
  stdout?: string
  stderr?: string
  exitCode?: number
}

interface LogState {
  entries: LogEntry[]
  add: (entry: Omit<LogEntry, 'id' | 'ts'>) => void
  clear: () => void
}

const MAX = 200

export const useLogStore = create<LogState>((set, get) => ({
  entries: [],
  add: (entry) => {
    const saved = { ...entry, id: crypto.randomUUID(), ts: Date.now() }
    set({ entries: [saved, ...get().entries].slice(0, MAX) })
    appendHistory('inspector', [saved])
  },
  clear: () => {
    set({ entries: [] })
    clearHistory('inspector')
  },
}))
