import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToastStore, type ToastMessage } from '../store/toastStore'

function Toast({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (hovered || focused || toast.kind === 'error') return
    const timer = setTimeout(() => dismiss(toast.id), 6000)
    return () => clearTimeout(timer)
  }, [dismiss, toast.id, toast.kind, hovered, focused])
  const success = toast.kind === 'success'
  const Icon = success ? CheckCircle2 : CircleAlert
  return <div
    role={success ? 'status' : 'alert'}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}
    className="pointer-events-auto flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
  >
    <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
    <p className="min-w-0 flex-1 break-words text-sm text-gray-800 dark:text-gray-100">{toast.message}</p>
    <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"><X aria-hidden="true" className="h-4 w-4" /></button>
  </div>
}

export function Toasts() {
  const messages = useToastStore((s) => s.messages)
  return <div aria-label="Notifications" className="pointer-events-none fixed right-4 top-20 z-50 flex max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-sm flex-col gap-3 overflow-y-auto">
    {messages.map((toast) => <Toast key={toast.id} toast={toast} />)}
  </div>
}
