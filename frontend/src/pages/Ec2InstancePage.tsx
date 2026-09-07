import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Camera,
  Check,
  HardDrive,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Shield,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ErrorAlert } from '../components/ErrorAlert'
import { StateBadge } from '../components/StateBadge'
import { flattenInstances, timeAgo, type InstanceRow } from '../lib/ec2'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const INSTANCE_SIZES = [
  't2.micro',
  't2.small',
  't2.medium',
  't3.micro',
  't3.small',
  't3.medium',
  't3.large',
  'm5.large',
  'm5.xlarge',
  'c5.large',
]

/** Shared mutation that runs an EC2 operation and refreshes instance/list/volume data. */
function useEc2Mutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ op, params }: { op: string; params: Record<string, unknown> }) =>
      runQuery('ec2', op, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec2-instance'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-instances'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-volumes'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-security-groups'] })
    },
  })
}

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

  const power = useEc2Mutation()

  function powerAction(op: string) {
    if (op === 'terminate_instances') {
      if (!window.confirm(`Terminate ${instanceId}? This permanently deletes the server.`))
        return
    }
    power.mutate({ op, params: { InstanceIds: [instanceId] } })
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
            <NameEditor row={row} instanceId={instanceId!} />

            <div className="ml-auto flex flex-wrap items-center gap-2">
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
                disabled={power.isPending || row.State !== 'stopped'}
                onClick={() => powerAction('start_instances')}
              />
              <ActionButton
                label="Stop"
                icon={<Square className="h-4 w-4" />}
                tone="amber"
                disabled={power.isPending || row.State !== 'running'}
                onClick={() => powerAction('stop_instances')}
              />
              <ActionButton
                label="Reboot"
                icon={<RotateCw className="h-4 w-4" />}
                tone="blue"
                disabled={power.isPending || row.State !== 'running'}
                onClick={() => powerAction('reboot_instances')}
              />
              <ActionButton
                label="Delete"
                icon={<Trash2 className="h-4 w-4" />}
                tone="red"
                disabled={power.isPending || row.State === 'terminated'}
                onClick={() => powerAction('terminate_instances')}
              />
            </div>
          </div>

          {power.isError && <ErrorAlert error={power.error} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Overview">
              <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                <Detail label="Status" value={<StateBadge state={row.State} />} />
                <Detail label="Size" value={row.InstanceType} />
                <Detail label="Availability zone" value={row.AZ} />
                <Detail label="Region" value={row.Region} />
                <Detail label="Launched" value={timeAgo(row.LaunchTime)} />
                <Detail label="Key pair" value={row.KeyName || 'None'} />
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

            <ConfigCard row={row} instanceId={instanceId!} />
            <FirewallCard row={row} instanceId={instanceId!} />
            <TagsCard row={row} instanceId={instanceId!} />
            <BackupCard instanceId={instanceId!} />
          </div>

          <VolumesCard instanceId={instanceId!} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Header name + inline rename                                         */
/* ------------------------------------------------------------------ */

function NameEditor({ row, instanceId }: { row: InstanceRow; instanceId: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(row.Name)
  const rename = useEc2Mutation()

  useEffect(() => setName(row.Name), [row.Name])

  function save() {
    rename.mutate(
      {
        op: 'create_tags',
        params: { Resources: [instanceId], Tags: [{ Key: 'Name', Value: name }] },
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="Server name"
          className="rounded-md border border-gray-300 px-2 py-1 text-lg font-semibold focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
        />
        <button
          type="button"
          onClick={save}
          disabled={rename.isPending}
          className="rounded-md bg-brand-500 px-2 py-1.5 text-white hover:bg-brand-600 disabled:opacity-50"
          title="Save name"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h1 className="truncate text-lg font-semibold text-gray-800 dark:text-gray-100">
          {row.Name || 'Unnamed server'}
        </h1>
        <StateBadge state={row.State} size="md" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
          title="Rename"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="font-mono text-xs text-gray-400">{row.InstanceId}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Configuration: resize + monitoring                                 */
/* ------------------------------------------------------------------ */

function ConfigCard({ row, instanceId }: { row: InstanceRow; instanceId: string }) {
  const [size, setSize] = useState(row.InstanceType)
  const resize = useEc2Mutation()
  const monitor = useEc2Mutation()

  useEffect(() => setSize(row.InstanceType), [row.InstanceType])

  const stopped = row.State === 'stopped'
  const sizes = INSTANCE_SIZES.includes(row.InstanceType)
    ? INSTANCE_SIZES
    : [row.InstanceType, ...INSTANCE_SIZES]
  const monitoringOn = row.Monitoring === 'enabled' || row.Monitoring === 'pending'

  return (
    <Card title="Configuration">
      <div className="flex flex-col gap-4">
        {/* Resize */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Server size
          </label>
          <div className="flex items-center gap-2">
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={!stopped}
              className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                resize.mutate({
                  op: 'modify_instance_attribute',
                  params: { InstanceId: instanceId, InstanceType: { Value: size } },
                })
              }
              disabled={!stopped || resize.isPending || size === row.InstanceType}
              className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
            >
              {resize.isPending ? 'Applying…' : 'Apply'}
            </button>
          </div>
          {!stopped && (
            <p className="mt-1 text-xs text-amber-600">
              Stop the server first to change its size.
            </p>
          )}
          {resize.isError && (
            <div className="mt-2">
              <ErrorAlert error={resize.error} />
            </div>
          )}
        </div>

        {/* Monitoring */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Detailed monitoring
            </div>
            <div className="text-xs text-gray-400">
              {monitoringOn ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              monitor.mutate({
                op: monitoringOn ? 'unmonitor_instances' : 'monitor_instances',
                params: { InstanceIds: [instanceId] },
              })
            }
            disabled={monitor.isPending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {monitoringOn ? 'Disable' : 'Enable'}
          </button>
        </div>
        {monitor.isError && <ErrorAlert error={monitor.error} />}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Firewall / security groups                                         */
/* ------------------------------------------------------------------ */

function FirewallCard({ row, instanceId }: { row: InstanceRow; instanceId: string }) {
  const region = useSessionStore((s) => s.region)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const attached: { GroupId: string; GroupName: string }[] =
    row._raw?.SecurityGroups ?? []
  const [selected, setSelected] = useState<string[]>(attached.map((g) => g.GroupId))
  const apply = useEc2Mutation()

  useEffect(() => {
    setSelected(attached.map((g) => g.GroupId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.InstanceId, attached.length])

  const groupsQuery = useQuery({
    queryKey: ['ec2-security-groups', row.VpcId, region, activeProfileId],
    queryFn: () =>
      runQuery('ec2', 'describe_security_groups', {
        Filters: [{ Name: 'vpc-id', Values: [row.VpcId] }],
      }),
    enabled: !!row.VpcId,
  })

  const groups: { GroupId: string; GroupName: string; Description: string }[] =
    (groupsQuery.data as any)?.SecurityGroups ?? []

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id],
    )
  }

  const changed =
    selected.length !== attached.length ||
    selected.some((id) => !attached.find((g) => g.GroupId === id))

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-500" />
          Firewall
        </span>
      }
    >
      {groupsQuery.isLoading ? (
        <p className="text-sm text-gray-400">Loading firewalls…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400">No security groups found in this VPC.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400">
            Choose which security groups control traffic to this server.
          </p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {groups.map((g) => (
              <label
                key={g.GroupId}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(g.GroupId)}
                  onChange={() => toggle(g.GroupId)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="min-w-0">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {g.GroupName}
                  </span>
                  <span className="ml-1 font-mono text-xs text-gray-400">{g.GroupId}</span>
                </span>
              </label>
            ))}
          </div>
          <div>
            <button
              type="button"
              onClick={() =>
                apply.mutate({
                  op: 'modify_instance_attribute',
                  params: { InstanceId: instanceId, Groups: selected },
                })
              }
              disabled={!changed || selected.length === 0 || apply.isPending}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
            >
              {apply.isPending ? 'Applying…' : 'Apply firewall changes'}
            </button>
          </div>
          {apply.isError && <ErrorAlert error={apply.error} />}
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Tags / labels                                                      */
/* ------------------------------------------------------------------ */

function TagsCard({ row, instanceId }: { row: InstanceRow; instanceId: string }) {
  const tags: { Key: string; Value: string }[] = (row._raw?.Tags ?? []).filter(
    (t: any) => t.Key !== 'Name',
  )
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const addTag = useEc2Mutation()
  const removeTag = useEc2Mutation()

  function add() {
    if (!key.trim()) return
    addTag.mutate(
      {
        op: 'create_tags',
        params: {
          Resources: [instanceId],
          Tags: [{ Key: key.trim(), Value: value.trim() }],
        },
      },
      {
        onSuccess: () => {
          setKey('')
          setValue('')
        },
      },
    )
  }

  return (
    <Card title="Labels">
      <div className="flex flex-col gap-3">
        {tags.length === 0 ? (
          <p className="text-sm text-gray-400">No labels on this server yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t.Key}
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <span>
                  <span className="text-gray-400">{t.Key}</span> = {t.Value}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    removeTag.mutate({
                      op: 'delete_tags',
                      params: { Resources: [instanceId], Tags: [{ Key: t.Key }] },
                    })
                  }
                  disabled={removeTag.isPending}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                  title="Remove label"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Label"
            className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Value"
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="button"
            onClick={add}
            disabled={!key.trim() || addTag.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {(addTag.isError || removeTag.isError) && (
          <ErrorAlert error={addTag.error || removeTag.error} />
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Backup: create image (AMI)                                         */
/* ------------------------------------------------------------------ */

function BackupCard({ instanceId }: { instanceId: string }) {
  const [name, setName] = useState('')
  const create = useEc2Mutation()

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-brand-500" />
          Backup image
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400">
          Save the current state of this server as a reusable image (AMI).
        </p>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Image name"
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="button"
            onClick={() =>
              create.mutate(
                {
                  op: 'create_image',
                  params: { InstanceId: instanceId, Name: name.trim() },
                },
                { onSuccess: () => setName('') },
              )
            }
            disabled={!name.trim() || create.isPending}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
          >
            {create.isPending ? 'Creating…' : 'Create image'}
          </button>
        </div>
        {create.isSuccess && (
          <p className="text-xs text-green-600">
            Image creation started — it will appear under your AMIs shortly.
          </p>
        )}
        {create.isError && <ErrorAlert error={create.error} />}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Storage: attached volumes                                          */
/* ------------------------------------------------------------------ */

function VolumesCard({ instanceId }: { instanceId: string }) {
  const region = useSessionStore((s) => s.region)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const detach = useEc2Mutation()

  const volumesQuery = useQuery({
    queryKey: ['ec2-volumes', instanceId, region, activeProfileId],
    queryFn: () =>
      runQuery('ec2', 'describe_volumes', {
        Filters: [{ Name: 'attachment.instance-id', Values: [instanceId] }],
      }),
  })

  const volumes: any[] = (volumesQuery.data as any)?.Volumes ?? []

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-brand-500" />
          Disks
        </span>
      }
    >
      {volumesQuery.isLoading ? (
        <p className="text-sm text-gray-400">Loading disks…</p>
      ) : volumes.length === 0 ? (
        <p className="text-sm text-gray-400">No disks attached.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                <th className="px-3 py-2 font-medium">Volume ID</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => {
                const device = v.Attachments?.[0]?.Device ?? ''
                return (
                  <tr
                    key={v.VolumeId}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {v.VolumeId}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {device}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {v.Size} GiB
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {v.VolumeType}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {v.State}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Detach ${v.VolumeId}? Detaching the root disk can break the server.`,
                            )
                          )
                            detach.mutate({
                              op: 'detach_volume',
                              params: { VolumeId: v.VolumeId },
                            })
                        }}
                        disabled={detach.isPending}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/40"
                      >
                        Detach
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {detach.isError && (
        <div className="mt-2">
          <ErrorAlert error={detach.error} />
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

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

const TONE_CLASS: Record<string, string> = {
  green:
    'text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-900 dark:hover:bg-green-950/40',
  amber:
    'text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:hover:bg-amber-950/40',
  blue: 'text-brand-700 border-brand-200 hover:bg-brand-50 dark:text-brand-300 dark:border-brand-900 dark:hover:bg-brand-900/40',
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
  tone: 'green' | 'amber' | 'red' | 'blue'
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
