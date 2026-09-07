import { create } from 'zustand'

export interface ToastMessage {
  id: number
  kind: 'success' | 'error'
  message: string
}

let nextId = 0

export const useToastStore = create<{
  messages: ToastMessage[]
  add: (kind: ToastMessage['kind'], message: string) => void
  dismiss: (id: number) => void
}>((set) => ({
  messages: [],
  add: (kind, message) => set((s) => ({ messages: [...s.messages, { id: ++nextId, kind, message }].slice(-4) })),
  dismiss: (id) => set((s) => ({ messages: s.messages.filter((message) => message.id !== id) })),
}))
