export type HistoryKind = 'inspector' | 'terminal' | 'commands'
export interface HistoryChange {
  kind: HistoryKind
  entries?: { id: string; payload: object }[]
}
let listener: (change: HistoryChange) => void = () => {}
export function onHistoryChange(handler: typeof listener) { listener = handler }
export function appendHistory(kind: HistoryKind, payloads: object[]) {
  listener({ kind, entries: payloads.map((payload) => ({ id: crypto.randomUUID(), payload })) })
}
export function clearHistory(kind: HistoryKind) { listener({ kind }) }
