import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Info,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Square,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { runQuery } from '../api/proxy'
import { ActionForm } from '../components/ActionForm'
import { Card } from '../components/Card'
import { Drawer } from '../components/Drawer'
import { ErrorAlert } from '../components/ErrorAlert'
import { getService } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

interface InstanceRow {
  InstanceId: string
  Name: string
  State: string
  InstanceType: string
  AZ: string
  PublicIpAddress: string
  PrivateIpAddress: string
  LaunchTime: string
  KeyName: string
  _raw: any
}

function flatten(data: any): InstanceRow[] {
  return (data?.Reservations ?? []).flatMap((res: any) =>
    (res.Instances ?? []).map(
      (i: any): InstanceRow => ({
        InstanceId: i.InstanceId,
        Name: i.Tags?.find((t: any) => t.Key === 'Name')?.Value ?? '',
        State: i.State?.Name ?? '',
        InstanceType: i.InstanceType ?? '',
        AZ: i.Placement?.AvailabilityZone ?? '',
        PublicIpAddress: i.PublicIpAddress ?? '',
        PrivateIpAddress: i.PrivateIpAddress ?? '',
        LaunchTime: i.LaunchTime ?? '',
        KeyName: i.KeyName ?? '',
        _raw: i,
      }),
    ),
  )
}

function stateColor(state: string): string {
  switch (state) {
    case 'running':
      return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
    case 'stopped':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
    case 'terminated':
      return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
    default:
      // pending, stopping, shutting-down, rebooting…
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
  }
}

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${stateColor(
        state,
      )}`}
    >
      {state || 'unknown'}
    </span>
  )
}

const launchAction = getService('ec2')!.actions.find((a) => a.id === 'run_instances')!

export function Ec2Page() {
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [launchOpen, setLaunchOpen] = useState(false)
  const [details, setDetails] = useState<InstanceRow | null>(null)

  const needsProfile = mode === 'register' && activeProfileId == null

  const instancesQuery = useQuery({
    queryKey: ['ec2-instances', region, activeProfileId],
    queryFn: () => runQuery('ec2', 'describe_instances', {}),
    enabled: !needsProfile,
  })

  const rows = useMemo(() => flatten(instancesQuery.data), [instancesQuery.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.InstanceId.toLowerCase().includes(q) ||
        r.Name.toLowerCase().includes(q),
    )
  }, [rows, search])

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
      if (!window.confirm(`Terminate ${id}? This permanently deletes the instance.`))
        return
    }
    lifecycle.mutate({ op, id })
  }

  const iconBtn =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Server className="h-4 w-4 text-brand-500" />
            Compute
            <span className="rounded bg-gray-100 px-1 text-[10px] font-medium uppercase text-gray-400 dark:bg-gray-800 dark:text-gray-500">
              ec2
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or id"
                className="w-44 rounded-md border border-gray-300 py-1 pl-7 pr-2 text-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
              />
            </div>
            <button
              type="button"
              onClick={() => invalidate()}
              disabled={instancesQuery.isFetching}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${instancesQuery.isFetching ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => setLaunchOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Launch instance
            </button>
          </div>
        }
      >
        {needsProfile ? (
          <p className="text-sm text-amber-600">
            Select an AWS profile from the account menu to view instances.
          </p>
        ) : instancesQuery.isError ? (
          <ErrorAlert error={instancesQuery.error} />
        ) : instancesQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-gray-400">Loading instances…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {rows.length === 0
              ? 'No instances in this region. Launch one to get started.'
              : 'No instances match your search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Instance ID</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">AZ</th>
                  <th className="px-3 py-2 font-medium">Public IP</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const busy = pendingId === r.InstanceId
                  return (
                    <tr
                      key={r.InstanceId}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                        {r.Name || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {r.InstanceId}
                      </td>
                      <td className="px-3 py-2">
                        <StateBadge state={r.State} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {r.InstanceType}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {r.AZ}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {r.PublicIpAddress || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => act('start_instances', r.InstanceId)}
                            disabled={busy || r.State !== 'stopped'}
                            className={`${iconBtn} text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40`}
                            title="Start"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => act('stop_instances', r.InstanceId)}
                            disabled={busy || r.State !== 'running'}
                            className={`${iconBtn} text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40`}
                            title="Stop"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => act('terminate_instances', r.InstanceId)}
                            disabled={busy || r.State === 'terminated'}
                            className={`${iconBtn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40`}
                            title="Terminate"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetails(r)}
                            className={`${iconBtn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800`}
                            title="Details"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {lifecycle.isError && (
          <div className="mt-3">
            <ErrorAlert error={lifecycle.error} />
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          {filtered.length} of {rows.length} instance{rows.length === 1 ? '' : 's'}
        </p>
      </Card>

      {/* Launch drawer */}
      <Drawer
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        title="Launch instance"
      >
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
      </Drawer>

      {/* Details drawer */}
      <Drawer
        open={details !== null}
        onClose={() => setDetails(null)}
        title={
          <span className="flex items-center gap-2">
            Instance details
            {details && <StateBadge state={details.State} />}
          </span>
        }
        width="max-w-lg"
      >
        {details && <InstanceDetails row={details} />}
      </Drawer>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-32 shrink-0 text-gray-400">{label}</span>
      <span className="min-w-0 break-all font-mono text-xs text-gray-700 dark:text-gray-200">
        {value || '—'}
      </span>
    </div>
  )
}

function InstanceDetails({ row }: { row: InstanceRow }) {
  const tags: { Key: string; Value: string }[] = row._raw?.Tags ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <DetailRow label="Instance ID" value={row.InstanceId} />
        <DetailRow label="Name" value={row.Name} />
        <DetailRow label="State" value={row.State} />
        <DetailRow label="Type" value={row.InstanceType} />
        <DetailRow label="Availability zone" value={row.AZ} />
        <DetailRow label="Public IP" value={row.PublicIpAddress} />
        <DetailRow label="Private IP" value={row.PrivateIpAddress} />
        <DetailRow label="Key pair" value={row.KeyName} />
        <DetailRow
          label="Launch time"
          value={row.LaunchTime ? String(row.LaunchTime) : ''}
        />
      </div>

      {tags.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Tags
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t.Key}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {t.Key}={t.Value}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="rounded-md border border-gray-200 dark:border-gray-800">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
          Raw JSON
        </summary>
        <pre className="max-h-96 overflow-auto border-t border-gray-100 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-700 dark:border-gray-800 dark:text-gray-300">
          {JSON.stringify(row._raw, null, 2)}
        </pre>
      </details>
    </div>
  )
}
