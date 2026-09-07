import axios from 'axios'
import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { useCliStore, WELCOME_LINE, type CliLine } from './cliStore'
import { useLogStore, type LogEntry } from './logStore'
import { changeHistorySession, onHistoryChange, type HistoryChange } from './historyEvents'

interface Snapshot {
  inspector: LogEntry[]
  terminal: CliLine[]
  commands: { text: string }[]
}
interface Account {
  token: string
  queue: HistoryChange[]
  revision: number
  saving: boolean
  loading: boolean
}
export const useHistorySync = create<{ status: string }>(() => ({ status: '' }))
const guestKey = 'aws-openconsole-guest-history'
// A dedicated client pins each request to its originating account, even after logout.
let client = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000', timeout: 15_000 })
let account: Account | null = null
let started = false

function snapshot(): Snapshot {
  return {
    inspector: [...useLogStore.getState().entries].reverse(),
    terminal: useCliStore.getState().lines,
    commands: useCliStore.getState().history.map((text) => ({ text })),
  }
}
function restore(data: Snapshot) {
  useLogStore.setState({ entries: [...data.inspector].reverse().slice(0, 200) })
  useCliStore.setState({ lines: data.terminal.slice(-500), history: data.commands.map((c) => c.text).slice(-200) })
}
function status(session: Account, message: string) {
  if (account === session) useHistorySync.setState({ status: message })
}
async function refresh(session: Account) {
  if (session.loading || session.saving || session.queue.length || account !== session) return
  session.loading = true
  const revision = session.revision
  try {
    const { data } = await client.get<Snapshot>('/api/history', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    if (account === session && revision === session.revision && !session.queue.length) {
      restore(data)
      status(session, '')
    }
  } catch {
    status(session, 'Could not load account history. Retrying…')
  } finally {
    session.loading = false
    if (revision !== session.revision && !session.queue.length) void refresh(session)
  }
}
async function drain(session: Account) {
  if (session.saving) return
  session.saving = true
  try {
    while (session.queue.length) {
      const change = session.queue[0]
      const config = { headers: { Authorization: `Bearer ${session.token}` } }
      if (change.entries) {
        await client.post(`/api/history/${change.kind}`, { entries: change.entries }, config)
      } else {
        await client.delete(`/api/history/${change.kind}`, config)
      }
      session.queue.shift()
    }
    status(session, '')
  } catch {
    status(session, 'History has unsaved changes. Retrying…')
  } finally {
    session.saving = false
  }
  if (!session.queue.length) void refresh(session)
}

function switchSession() {
  changeHistorySession()
  const auth = useAuthStore.getState()
  account = null
  useHistorySync.setState({ status: '' })
  restore({ inspector: [], terminal: [WELCOME_LINE], commands: [] })
  if (auth.mode === 'register' && auth.token) {
    account = { token: auth.token, queue: [], revision: 0, saving: false, loading: false }
    useHistorySync.setState({ status: 'Loading account history…' })
    void refresh(account)
  } else if (auth.mode === 'guest') {
    try {
      const saved = localStorage.getItem(guestKey)
      if (saved) restore(JSON.parse(saved))
      else {
        // The old terminal store had no account owner. Only adopt it in guest mode.
        const legacy = JSON.parse(localStorage.getItem('aws-openconsole-cli') || 'null')
        if (legacy?.state) restore({ inspector: [], terminal: legacy.state.lines, commands: legacy.state.history.map((text: string) => ({ text })) })
      }
    } catch {
      useHistorySync.setState({ status: 'Could not read browser history.' })
    }
  }
}

export function startHistorySync(historyClient = client) {
  if (started) return
  started = true
  client = historyClient
  onHistoryChange((change) => {
    if (account) {
      account.queue.push(change)
      account.revision++
      useHistorySync.setState({ status: 'Saving history…' })
      void drain(account)
    } else if (useAuthStore.getState().mode === 'guest') {
      try {
        localStorage.setItem(guestKey, JSON.stringify(snapshot()))
        useHistorySync.setState({ status: '' })
      } catch {
        useHistorySync.setState({ status: 'Browser history could not be saved. Storage may be full.' })
      }
    }
  })
  useAuthStore.subscribe((next, prev) => {
    if (next.mode !== prev.mode || next.token !== prev.token) switchSession()
  })
  switchSession()
  const retry = () => {
    if (account) {
      if (account.queue.length) void drain(account)
      else void refresh(account)
    }
  }
  window.addEventListener('focus', retry)
  window.addEventListener('online', retry)
  window.setInterval(retry, 10_000)
  window.addEventListener('beforeunload', (event) => {
    if (account?.queue.length) event.preventDefault()
  })
}

/** Let explicit logout finish saving before discarding the session. */
export async function flushHistory(): Promise<boolean> {
  const session = account
  if (!session) return true
  while (session.saving) await new Promise((resolve) => setTimeout(resolve, 50))
  if (session.queue.length) await drain(session)
  if (session.queue.length) {
    status(session, 'History could not be saved. Please reconnect before logging out.')
    return false
  }
  return true
}
