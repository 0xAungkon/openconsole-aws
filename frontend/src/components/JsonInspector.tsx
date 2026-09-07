import { useState } from 'react'

interface JsonInspectorProps {
  value: unknown
  defaultOpen?: boolean
}

export function JsonInspector({ value, defaultOpen = false }: JsonInspectorProps) {
  const [open, setOpen] = useState(defaultOpen)
  const text = JSON.stringify(value, null, 2)

  return (
    <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <span className={`transition ${open ? 'rotate-90' : ''}`}>▶</span>
        Raw JSON
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
          {text}
        </pre>
      )}
    </div>
  )
}
