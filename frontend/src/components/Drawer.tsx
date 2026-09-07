import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** Tailwind width class for the panel, e.g. "max-w-md". */
  width?: string
}

/** Right-side slide-over panel. Backdrop click and Esc close it. */
export function Drawer({ open, onClose, title, children, width = 'max-w-md' }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* panel */}
      <div
        className={`relative flex h-full w-full ${width} flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900`}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <span className="inline-block h-4 w-[3px] rounded-full bg-brand-500" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
