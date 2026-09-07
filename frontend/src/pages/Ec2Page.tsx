import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Cpu,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { runQuery } from '../api/proxy'
import { ActionForm } from '../components/ActionForm'
import { Card } from '../components/Card'
import { ErrorAlert } from '../components/ErrorAlert'
import { StateBadge } from '../components/StateBadge'
import { flattenInstances, timeAgo, type InstanceRow } from '../lib/ec2'
import { getService } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const launchAction = getService('ec2')!.actions.find((a) => a.id === 'run_instances')!

const PAGE_SIZE = 30

type StatusFilter = 'all' | 'running' | 'stopped' | 'other'

function matchesStatus(state: string, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return state === 'running'
  if (filter === 'stopped') return state === 'stopped'
  return state !== 'running' && state !== 'stopped'
}

export function Ec2Page() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [launchOpen, setLaunchOpen] = useState(false)

  const needsProfile = mode === 'register' && activeProfileId == null

  const instancesQuery = useQuery({
    queryKey: ['ec2-instances', region, activeProfileId],
    queryFn: () => runQuery('ec2', 'describe_instances', {}),
    enabled: !needsProfile,
  })

  const rows = useMemo(
    () => flattenInstances(instancesQuery.data),
    [instancesQuery.data],
  )

  const counts = useMemo(
    () => ({
      all: rows.length,
      running: rows.filter((r) => r.State === 'running').length,
      stopped: rows.filter((r) => r.State === 'stopped').length,
      other: rows.filter((r) => r.State !== 'running' && r.State !== 'stopped')
        .length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        matchesStatus(r.State, status) &&
        (!q ||
          r.InstanceId.toLowerCase().includes(q) ||
          r.Name.toLowerCase().includes(q)),
    )
  }, [rows, search, status])

  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Reset to the first page whenever the filter/search/region changes.
  useEffect(() => {
    setPage(1)
  }, [search, status, region])

  // Clamp the page if the list shrinks (e.g. after terminating instances).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['ec2-instances'] })

  const lifecycle = useMutation({
    mutationFn: ({ op, id }: { op: string; id: string }) =>
      runQuery('ec2', op, { InstanceIds: [id] }),
    onSuccess: invalidate,
  })

  const launch = useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      runQuery('ec2', 'run_instances', params),
    onSuccess: () => {
      invalidate()
      setLaunchOpen(false)
    },
  })

  const pendingId = lifecycle.isPending ? lifecycle.variables?.id : undefined

  function act(op: string, id: string) {
    if (op === 'terminate_instances') {
      if (!window.confirm(`Terminate ${id}? This permanently deletes the server.`))
        return
    }
    lifecycle.mutate({ op, id })
  }

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All servers' },
    { key: 'running', label: 'Running' },
    { key: 'stopped', label: 'Stopped' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Your servers
          </h1>
          <p className="text-xs text-gray-400">
            Virtual machines running in {region}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID"
              className="w-52 rounded-md border border-gray-300 bg-gray-50 py-2 pl-8 pr-2 text-sm focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:focus:bg-gray-950"
            />
          </div>
          {!needsProfile && (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="rounded-md border border-gray-300 bg-gray-50 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
              title="Filter by status"
            >
              {FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} ({counts[f.key]})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => invalidate()}
            disabled={instancesQuery.isFetching}
            className="rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${instancesQuery.isFetching ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setLaunchOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New server
          </button>
        </div>
      </div>

      {lifecycle.isError && <ErrorAlert error={lifecycle.error} />}

      {/* Split pane: table on the left, launch form docked on the right */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={`min-w-0 flex-1 ${launchOpen ? 'lg:w-[70%]' : ''}`}>
          {/* Body */}
          {needsProfile ? (
        <Card title="Compute">
          <p className="text-sm text-amber-600">
            Select an AWS profile from the account menu to view your servers.
          </p>
        </Card>
      ) : instancesQuery.isError ? (
        <ErrorAlert error={instancesQuery.error} />
      ) : instancesQuery.isLoading ? (
        <p className="py-16 text-center text-sm text-gray-400">Loading your servers…</p>
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={rows.length > 0} onLaunch={() => setLaunchOpen(true)} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Size</th>
                  <th className="px-4 py-2.5 font-medium">Zone</th>
                  <th className="px-4 py-2.5 font-medium">Public IP</th>
                  <th className="px-4 py-2.5 font-medium">Launched</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <InstanceRowView
                    key={r.InstanceId}
                    row={r}
                    busy={pendingId === r.InstanceId}
                    onOpen={() => navigate(`/${profile}/compute/${r.InstanceId}`)}
                    onAct={act}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-800">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-gray-300 px-2 py-1 font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Previous
                </button>
                <span className="px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 px-2 py-1 font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </div>

        {/* Launch panel — docked to the right, ~40% width */}
        {launchOpen && (
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[30%]">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <span className="inline-block h-4 w-[3px] rounded-full bg-brand-500" />
                  Launch a new server
                </h2>
                <button
                  type="button"
                  onClick={() => setLaunchOpen(false)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="p-4">
                {launch.isError && (
                  <div className="mb-3">
                    <ErrorAlert error={launch.error} />
                  </div>
                )}
                <ActionForm
                  action={launchAction}
                  running={launch.isPending}
                  onRun={(params) => launch.mutate(params)}
                />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasAny, onLaunch }: { hasAny: boolean; onLaunch: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-gray-800">
        <Cpu className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {hasAny ? 'No servers match your filters' : 'No servers yet'}
        </p>
        <p className="text-xs text-gray-400">
          {hasAny
            ? 'Try a different status or search term.'
            : 'Launch your first server to get started.'}
        </p>
      </div>
      {!hasAny && (
        <button
          type="button"
          onClick={onLaunch}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          New server
        </button>
      )}
    </div>
  )
}

function InstanceRowView({
  row,
  busy,
  onOpen,
  onAct,
}: {
  row: InstanceRow
  busy: boolean
  onOpen: () => void
  onAct: (op: string, id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const iconBtn =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40'

  async function copyId(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(row.InstanceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
    >
      <td className="px-4 py-2.5">
        <div className="font-medium text-gray-800 dark:text-gray-100">
          {row.Name || 'Unnamed server'}
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-gray-400">{row.InstanceId}</span>
          <button
            type="button"
            onClick={copyId}
            className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
            title="Copy instance ID"
            aria-label="Copy instance ID"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <StateBadge state={row.State} />
      </td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{row.InstanceType}</td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{row.AZ}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400">
        {row.PublicIpAddress || '—'}
      </td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
        {timeAgo(row.LaunchTime)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              onAct('start_instances', row.InstanceId)
            }}
            disabled={busy || row.State !== 'stopped'}
            className={`${iconBtn} text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40`}
            title="Start"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              onAct('stop_instances', row.InstanceId)
            }}
            disabled={busy || row.State !== 'running'}
            className={`${iconBtn} text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40`}
            title="Stop"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              onAct('terminate_instances', row.InstanceId)
            }}
            disabled={busy || row.State === 'terminated'}
            className={`${iconBtn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40`}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
