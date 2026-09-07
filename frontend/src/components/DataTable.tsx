import { useMemo, useState } from 'react'
import type { Column, Row } from '../types'

interface DataTableProps {
  columns: Column[]
  rows: Row[]
}

function fmt(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function DataTable({ columns, rows }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = fmt(a[sortKey])
      const bv = fmt(b[sortKey])
      return asc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return copy
  }, [rows, sortKey, asc])

  function toggleSort(key: string) {
    if (sortKey === key) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">No results.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="cursor-pointer select-none px-3 py-2 font-medium hover:text-brand-600"
              >
                {c.label}
                {sortKey === c.key && (
                  <span className="ml-1">{asc ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300"
                >
                  {fmt(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
