import { create } from 'zustand'

export interface LogEntry {
  id: string
  ts: number
  service: string
  operation: string
  params: Record<string, unknown>
  status: 'ok' | 'error'
  durationMs: number
  result?: unknown
  error?: { code: string; message: string }
}

interface LogState {
  entries: LogEntry[]
  add: (entry: Omit<LogEntry, 'id' | 'ts'>) => void
  clear: () => void
}

const MAX = 200

export const useLogStore = create<LogState>((set, get) => ({
  entries: [],
  add: (entry) =>
    set({
      entries: [
        { ...entry, id: crypto.randomUUID(), ts: Date.now() },
        ...get().entries,
      ].slice(0, MAX),
    }),
  clear: () => set({ entries: [] }),
}))
