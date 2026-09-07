import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, RefreshCw, Square, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ErrorAlert } from '../components/ErrorAlert'
import { StateBadge } from '../components/StateBadge'
import { flattenInstances, timeAgo } from '../lib/ec2'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

export function Ec2InstancePage() {
  const { profile, instanceId } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/ec2`

  const query = useQuery({
    queryKey: ['ec2-instance', instanceId, region, activeProfileId],
    queryFn: () =>
      runQuery('ec2', 'describe_instances', { InstanceIds: [instanceId] }),
    enabled: !needsProfile && !!instanceId,
  })

  const row = flattenInstances(query.data)[0]

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ec2-instance', instanceId] })
    queryClient.invalidateQueries({ queryKey: ['ec2-instances'] })
  }

  const lifecycle = useMutation({
    mutationFn: (op: string) =>
      runQuery('ec2', op, { InstanceIds: [instanceId] }),
    onSuccess: refresh,
  })

  function act(op: string) {
    if (op === 'terminate_instances') {
      if (!window.confirm(`Terminate ${instanceId}? This permanently deletes the server.`))
        return
    }
    lifecycle.mutate(op)
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to servers
      </button>

      {needsProfile ? (
        <Card title="Server details">
          <p className="text-sm text-amber-600">
            Select an AWS profile from the account menu to view this server.
          </p>
        </Card>
      ) : query.isError ? (
        <ErrorAlert error={query.error} />
      ) : query.isLoading ? (
        <p className="py-16 text-center text-sm text-gray-400">Loading server…</p>
      ) : !row ? (
        <Card title="Server not found">
          <p className="text-sm text-gray-500">
            This server no longer exists in {region}.
          </p>
        </Card>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {row.Name || 'Unnamed server'}
                </h1>
                <StateBadge state={row.State} size="md" />
              </div>
              <p className="font-mono text-xs text-gray-400">{row.InstanceId}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={query.isFetching}
                className="rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
              </button>
              <ActionButton
                label="Start"
                icon={<Play className="h-4 w-4" />}
                tone="green"
                disabled={lifecycle.isPending || row.State !== 'stopped'}
                onClick={() => act('start_instances')}
              />
              <ActionButton
                label="Stop"
                icon={<Square className="h-4 w-4" />}
                tone="amber"
                disabled={lifecycle.isPending || row.State !== 'running'}
                onClick={() => act('stop_instances')}
              />
              <ActionButton
                label="Delete"
                icon={<Trash2 className="h-4 w-4" />}
                tone="red"
                disabled={lifecycle.isPending || row.State === 'terminated'}
                onClick={() => act('terminate_instances')}
              />
            </div>
          </div>

          {lifecycle.isError && <ErrorAlert error={lifecycle.error} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Overview">
              <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                <Detail label="Status" value={<StateBadge state={row.State} />} />
                <Detail label="Size" value={row.InstanceType} />
                <Detail label="Availability zone" value={row.AZ} />
                <Detail label="Region" value={row.Region} />
                <Detail label="Launched" value={timeAgo(row.LaunchTime)} />
                <Detail label="Key pair" value={row.KeyName || 'None'} />
                <Detail
                  label="Monitoring"
                  value={row.Monitoring ? row.Monitoring : 'Disabled'}
                />
              </dl>
            </Card>

            <Card title="Networking">
              <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                <Detail label="Public IP" value={row.PublicIpAddress || 'None'} mono />
                <Detail label="Private IP" value={row.PrivateIpAddress || 'None'} mono />
                <Detail label="Public DNS" value={row.PublicDnsName || 'None'} mono />
                <Detail label="VPC" value={row.VpcId || 'None'} mono />
                <Detail label="Subnet" value={row.SubnetId || 'None'} mono />
              </dl>
            </Card>
          </div>

          <TagsCard tags={row._raw?.Tags ?? []} />
        </>
      )}
    </div>
  )
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span
        className={`min-w-0 break-all text-right text-gray-700 dark:text-gray-200 ${
          mono ? 'font-mono text-xs' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function TagsCard({ tags }: { tags: { Key: string; Value: string }[] }) {
  const visible = tags.filter((t) => t.Key !== 'Name')
  return (
    <Card title="Tags">
      {visible.length === 0 ? (
        <p className="text-sm text-gray-400">No tags on this server.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((t) => (
            <span
              key={t.Key}
              className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <span className="text-gray-400">{t.Key}</span> = {t.Value}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

const TONE_CLASS: Record<string, string> = {
  green:
    'text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-900 dark:hover:bg-green-950/40',
  amber:
    'text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:hover:bg-amber-950/40',
  red: 'text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-900 dark:hover:bg-red-950/40',
}

function ActionButton({
  label,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  tone: 'green' | 'amber' | 'red'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-900 ${TONE_CLASS[tone]}`}
    >
      {icon}
      {label}
    </button>
  )
}
