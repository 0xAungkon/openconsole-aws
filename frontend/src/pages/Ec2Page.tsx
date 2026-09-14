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
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { ActionForm } from '../components/ActionForm'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
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

const OP_LABEL: Record<string, string> = {
  start_instances: 'Start requested for',
  stop_instances: 'Stop requested for',
  terminate_instances: 'Termination requested for',
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
  const [terminateId, setTerminateId] = useState<string | null>(null)

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
    onSuccess: (_result, { op, id }) => {
      invalidate()
      toast.success(`${OP_LABEL[op] ?? 'Action applied to'} ${id}`)
    },
  })

  const launch = useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      runQuery<{ Instances?: { InstanceId?: string }[] }>('ec2', 'run_instances', params),
    onSuccess: (result) => {
      invalidate()
      setLaunchOpen(false)
      const ids = (result?.Instances ?? []).map((i) => i.InstanceId).filter(Boolean)
      toast.success(ids.length ? `Launched ${ids.join(', ')}` : 'Server launch requested')
    },
  })

  const pendingId = lifecycle.isPending ? lifecycle.variables?.id : undefined

  function act(op: string, id: string) {
    if (op === 'terminate_instances') {
      setTerminateId(id)
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
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-5 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Cpu aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your servers</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Virtual machines running in {region}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID"
              aria-label="Search servers by name or ID"
              className="pl-8 sm:w-64"
            />
          </div>
          {!needsProfile && (
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label} ({counts[f.key]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => invalidate()}
                disabled={instancesQuery.isFetching}
                aria-label="Refresh"
              >
                <RefreshCw className={cn(instancesQuery.isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button onClick={() => setLaunchOpen(true)}>
            <Plus />
            New server
          </Button>
        </div>
      </div>

      {lifecycle.isError && <ErrorAlert error={lifecycle.error} />}

      {/* Split pane: table on the left, launch form docked on the right */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 flex-1', launchOpen && 'lg:w-[70%]')}>
          {needsProfile ? (
            <Card title="Compute">
              <p className="text-sm text-warning">
                Select an AWS profile from the account menu to view your servers.
              </p>
            </Card>
          ) : instancesQuery.isError ? (
            <ErrorAlert error={instancesQuery.error} />
          ) : instancesQuery.isLoading ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasAny={rows.length > 0} onLaunch={() => setLaunchOpen(true)} />
          ) : (
            <UiCard className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 text-xs uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Size</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Zone</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Public IP</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Launched</TableHead>
                      <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((r) => (
                      <InstanceRowView
                        key={r.InstanceId}
                        row={r}
                        busy={pendingId === r.InstanceId}
                        onOpen={() => navigate(`/${profile}/compute/${r.InstanceId}`)}
                        onAct={act}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <span className="px-2">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </UiCard>
          )}
        </div>

        {/* Launch panel — docked to the right, ~30% width */}
        {launchOpen && (
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[30%]">
            <UiCard className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-block h-4 w-[3px] rounded-full bg-primary" />
                  Launch a new server
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setLaunchOpen(false)}
                  aria-label="Close"
                  className="text-muted-foreground"
                >
                  <X />
                </Button>
              </CardHeader>
              <CardContent className="p-4">
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
              </CardContent>
            </UiCard>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={terminateId != null}
        title={`Terminate ${terminateId}?`}
        description="This permanently deletes the server and cannot be undone."
        confirmLabel="Terminate"
        pending={lifecycle.isPending}
        onCancel={() => setTerminateId(null)}
        onConfirm={() => {
          if (!terminateId) return
          lifecycle.mutate(
            { op: 'terminate_instances', id: terminateId },
            { onSettled: () => setTerminateId(null) },
          )
        }}
      />
    </div>
  )
}

function EmptyState({ hasAny, onLaunch }: { hasAny: boolean; onLaunch: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
        <Cpu className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium">
          {hasAny ? 'No servers match your filters' : 'No servers yet'}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasAny
            ? 'Try a different status or search term.'
            : 'Launch your first server to get started.'}
        </p>
      </div>
      {!hasAny && (
        <Button onClick={onLaunch}>
          <Plus />
          New server
        </Button>
      )}
    </div>
  )
}

function RowAction({
  label,
  icon,
  className,
  disabled,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  className: string
  disabled: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={className}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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

  async function copyId(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(row.InstanceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }

  return (
    <TableRow onClick={onOpen} className="cursor-pointer">
      <TableCell className="px-4">
        <div className="font-medium">{row.Name || 'Unnamed server'}</div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">{row.InstanceId}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={copyId}
            aria-label="Copy instance ID"
            className="size-5 text-muted-foreground hover:text-primary"
          >
            {copied ? <Check className="text-green-500" /> : <Copy />}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <StateBadge state={row.State} />
      </TableCell>
      <TableCell>{row.InstanceType}</TableCell>
      <TableCell>{row.AZ}</TableCell>
      <TableCell className="font-mono text-xs">{row.PublicIpAddress || '—'}</TableCell>
      <TableCell>{timeAgo(row.LaunchTime)}</TableCell>
      <TableCell className="px-4">
        <div className="flex items-center justify-end gap-1">
          <RowAction
            label="Start"
            icon={<Play />}
            className="text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/40"
            disabled={busy || row.State !== 'stopped'}
            onClick={(e) => {
              stop(e)
              onAct('start_instances', row.InstanceId)
            }}
          />
          <RowAction
            label="Stop"
            icon={<Square />}
            className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40"
            disabled={busy || row.State !== 'running'}
            onClick={(e) => {
              stop(e)
              onAct('stop_instances', row.InstanceId)
            }}
          />
          <RowAction
            label="Delete"
            icon={<Trash2 />}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            disabled={busy || row.State === 'terminated'}
            onClick={(e) => {
              stop(e)
              onAct('terminate_instances', row.InstanceId)
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
