import type { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** Rounded white card with the 1Panel-style vertical blue accent-bar title. */
export function Card({ title, actions, children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          {title && (
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              <span className="inline-block h-4 w-[3px] rounded-full bg-brand-500" />
              {title}
            </h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}
