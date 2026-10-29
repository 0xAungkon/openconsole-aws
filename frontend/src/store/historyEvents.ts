import { uid } from '../lib/uid'

export type HistoryKind = 'inspector' | 'terminal' | 'commands'
export interface HistoryChange {
  kind: HistoryKind
  entries?: { id: string; payload: object }[]
}
let listener: (change: HistoryChange) => void = () => {}
export function onHistoryChange(handler: typeof listener) { listener = handler }
export function appendHistory(kind: HistoryKind, payloads: object[]) {
  listener({ kind, entries: payloads.map((payload) => ({ id: uid(), payload })) })
}
export function clearHistory(kind: HistoryKind) { listener({ kind }) }

let generation = 0
export function changeHistorySession() { generation++ }
/** Ignore output from requests started in a previous login/guest session. */
export function scopedHistoryAction<T extends unknown[]>(action: (...args: T) => void) {
  const origin = generation
  return (...args: T) => { if (origin === generation) action(...args) }
}
