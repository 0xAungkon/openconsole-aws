import { create } from 'zustand'
import { appendHistory, clearHistory } from './historyEvents'

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

// Persistence is coordinated by historySync so guest and account data stay separate.
export const useCliStore = create<CliState>((set) => ({
  lines: [WELCOME_LINE],
  history: [],
  push: (...lines) => {
    set((s) => ({ lines: [...s.lines, ...lines].slice(-MAX_LINES) }))
    appendHistory('terminal', lines)
  },
  addHistory: (cmd) => {
    set((s) => ({ history: [...s.history, cmd].slice(-MAX_HISTORY) }))
    appendHistory('commands', [{ text: cmd }])
  },
  clear: () => {
    set({ lines: [] })
    clearHistory('terminal')
  },
}))
