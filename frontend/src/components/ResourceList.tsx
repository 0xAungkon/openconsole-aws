import { useNavigate, useParams } from 'react-router-dom'
import { CATALOG } from '../services/catalog'

/** 1Panel "Application"-list style: scrollable service rows with a primary action. */
export function ResourceList() {
  const navigate = useNavigate()
  const { profile } = useParams()
  return (
    <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {CATALOG.map((s) => (
        <li key={s.key} className="flex items-center gap-3 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-gray-800 dark:text-brand-300">
            <s.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {s.label}
            </div>
            <div className="truncate text-xs text-gray-400">{s.summary}</div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/${profile}/${s.key}`)}
            className="rounded-md border border-brand-200 px-3 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:border-gray-700 dark:text-brand-300 dark:hover:bg-gray-800"
          >
            Open
          </button>
        </li>
      ))}
    </ul>
  )
}
