import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CliLine {
  kind: 'cmd' | 'out' | 'err' | 'info'
  text: string
}

export const WELCOME_LINE: CliLine = {
  kind: 'info',
  text: 'AWS CLI terminal. Type "help" to get started.',
}

const MAX_LINES = 500
const MAX_HISTORY = 200

interface CliState {
  lines: CliLine[]
  history: string[]
  push: (...lines: CliLine[]) => void
  addHistory: (cmd: string) => void
  clear: () => void
}

/**
 * Terminal state persisted to localStorage so the CLI survives switching panels,
 * closing the dock, and full page reloads. `clear` resets the visible output but
 * keeps command history intact.
 */
export const useCliStore = create<CliState>()(
  persist(
    (set) => ({
      lines: [WELCOME_LINE],
      history: [],
      push: (...lines) =>
        set((s) => ({ lines: [...s.lines, ...lines].slice(-MAX_LINES) })),
      addHistory: (cmd) =>
        set((s) => ({ history: [...s.history, cmd].slice(-MAX_HISTORY) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'aws-openconsole-cli' },
  ),
)
