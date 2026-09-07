import assert from 'node:assert/strict'
import axios from 'axios'
import { useAuthStore } from '../src/store/authStore'
import { useCliStore } from '../src/store/cliStore'
import { useLogStore } from '../src/store/logStore'
import { scopedHistoryAction } from '../src/store/historyEvents'
import { flushHistory, startHistorySync, useHistorySync } from '../src/store/historySync'

const storage = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
})
const listeners: Record<string, () => void> = {}
Object.assign(globalThis, { window: {
  addEventListener: (name: string, callback: () => void) => { listeners[name] = callback },
  setInterval: () => 0,
} })
// Rehydrate the auth storage after installing the browser stand-in.
useAuthStore.persist.setOptions({ storage: {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
} })

interface Saved { inspector: object[]; terminal: object[]; commands: object[] }
const db: Record<string, Saved> = {}
let requests = 0
let offline = false
let holdRead: (() => void) | undefined
let blockNextRead = false
axios.defaults.adapter = async (config) => {
  requests++
  if (offline) throw new Error('offline')
  const token = String(config.headers.Authorization)
  const saved = db[token] ??= { inspector: [], terminal: [], commands: [] }
  const kind = config.url?.split('/')[3] as keyof Saved
  if (config.method === 'post') {
    const body = JSON.parse(config.data)
    saved[kind].push(...body.entries.map((entry: { payload: object }) => entry.payload))
  } else if (config.method === 'delete') saved[kind] = []
  const data = structuredClone(saved)
  if (config.method === 'get' && blockNextRead) {
    blockNextRead = false
    await new Promise<void>((resolve) => { holdRead = resolve })
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const user = { id: 1, name: 'Ann', email: 'a@example.com', created_at: '' }
startHistorySync(axios.create())
useAuthStore.getState().enterGuestMode()
useCliStore.getState().push({ kind: 'out', text: 'guest output' })
useCliStore.getState().addHistory('aws s3 ls')
useLogStore.getState().add({ source: 'gui', command: 'guest', status: 'ok', durationMs: 1 })
assert.equal(requests, 0, 'guest history must never call the server')
assert.ok(storage.get('aws-openconsole-guest-history')?.includes('guest output'))
useAuthStore.getState().reset()
useAuthStore.getState().enterGuestMode()
assert.equal(useLogStore.getState().entries.length, 1, 'guest Inspector survives leaving guest mode')

useAuthStore.getState().setRegister('account-a', user)
await tick()
assert.equal(useCliStore.getState().history.length, 0, 'guest history is isolated')
useCliStore.getState().push({ kind: 'out', text: 'account output' })
useCliStore.getState().addHistory('aws ec2 describe-instances')
useLogStore.getState().add({ source: 'gui', command: 'account', status: 'ok', durationMs: 1 })
assert.equal(await flushHistory(), true)
await tick()
assert.equal(db['Bearer account-a'].terminal.length, 1)
assert.ok(!storage.get('aws-openconsole-guest-history')?.includes('account output'))

const lateOutput = scopedHistoryAction(useCliStore.getState().push)
useAuthStore.getState().reset()
useAuthStore.getState().setRegister('account-b', { ...user, id: 2 })
lateOutput({ kind: 'out', text: 'wrong account' })
await tick()
assert.equal(useCliStore.getState().lines.length, 0, 'late responses cannot leak between accounts')
assert.equal(db['Bearer account-b'].terminal.length, 0)
useAuthStore.getState().setRegister('account-a', user)
await tick()
assert.equal(useCliStore.getState().lines[0].text, 'account output', 'login restores saved output')
assert.equal(useLogStore.getState().entries[0].command, 'account')
useCliStore.getState().clear()
assert.equal(await flushHistory(), true)
assert.equal(db['Bearer account-a'].terminal.length, 0)
assert.equal(db['Bearer account-a'].commands.length, 1, 'clear preserves command recall')

offline = true
useCliStore.getState().push({ kind: 'out', text: 'retry me' })
await tick()
assert.equal(await flushHistory(), false, 'logout must not discard failed saves')
assert.match(useHistorySync.getState().status, /could not be saved/)
offline = false
listeners.online()
assert.equal(await flushHistory(), true)
assert.equal(db['Bearer account-a'].terminal.length, 1)

// Saving during a slow initial read must not be overwritten by that stale read.
blockNextRead = true
useAuthStore.getState().setRegister('account-c', { ...user, id: 3 })
await tick()
useCliStore.getState().push({ kind: 'out', text: 'during load' })
assert.equal(await flushHistory(), true)
holdRead?.()
await tick()
assert.equal(useCliStore.getState().lines[0].text, 'during load')
console.log('History sync checks passed: guest storage, account restore/isolation, clear, retries, stale reads.')
