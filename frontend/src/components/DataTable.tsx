import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
    return <p className="py-6 text-center text-sm text-muted-foreground">No results.</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                onClick={() => toggleSort(c.key)}
                aria-sort={sortKey === c.key ? (asc ? 'ascending' : 'descending') : 'none'}
                className="cursor-pointer select-none text-xs uppercase tracking-wide hover:text-primary"
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key ? (
                    asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-40" />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key} className="font-mono text-xs">
                  {fmt(row[c.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
