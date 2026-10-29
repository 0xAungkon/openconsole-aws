import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Camera,
  Cpu,
  HardDrive,
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
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { StateBadge } from '../components/StateBadge'
import { InstanceTypeInput } from '../components/InstanceTypeInput'
import { ImageHardwareCard, InstanceHealthCard, InstanceFirewallRulesCard } from '../components/InstanceDetailsCards'
import { flattenInstances, timeAgo, type InstanceRow } from '../lib/ec2'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

/** Shared mutation that runs an EC2 operation and refreshes instance/list/volume data. */
function useEc2Mutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ op, params }: { op: string; params: Record<string, unknown>; success?: string }) =>
      runQuery('ec2', op, params),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ec2-instance'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-instances'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-volumes'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-security-groups'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-detail-health'] })
      queryClient.invalidateQueries({ queryKey: ['ec2-detail-rules'] })
      if (variables.success) toast.success(variables.success)
    },
  })
}

const POWER_LABEL: Record<string, string> = {
  start_instances: 'Start requested',
  stop_instances: 'Stop requested',
  reboot_instances: 'Reboot requested',
  terminate_instances: 'Termination requested',
}

export function Ec2InstancePage() {
  const { profile, instanceId } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()
  const [confirmTerminate, setConfirmTerminate] = useState(false)

  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/compute`

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
    for (const key of ['ec2-detail-image', 'ec2-detail-hardware', 'ec2-detail-health', 'ec2-detail-rules', 'ec2-volumes', 'ec2-security-groups']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const power = useEc2Mutation()

  function powerAction(op: string) {
    if (op === 'terminate_instances') {
      setConfirmTerminate(true)
      return
    }
    power.mutate({ op, params: { InstanceIds: [instanceId] }, success: `${POWER_LABEL[op]} for ${instanceId}` })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button
        variant="link"
        onClick={() => navigate(backTo)}
        className="w-fit px-0 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft />
        Back to servers
      </Button>

      {needsProfile ? (
        <Card title="Server details">
          <p className="text-sm text-warning">
            Select an AWS profile from the account menu to view this server.
          </p>
        </Card>
      ) : query.isError ? (
        <ErrorAlert error={query.error} />
      ) : query.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : !row ? (
        <Card title="Server not found">
          <p className="text-sm text-muted-foreground">
            This server no longer exists in {region}.
          </p>
        </Card>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Cpu aria-hidden="true" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <NameEditor row={row} instanceId={instanceId!} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {row.InstanceType} <span className="px-1 opacity-50">/</span> {row.AZ || region}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 border-t pt-4 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={refresh} disabled={query.isFetching} aria-label="Refresh">
                    <RefreshCw className={cn(query.isFetching && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <ActionButton
                label="Start"
                icon={<Play />}
                tone="green"
                disabled={power.isPending || row.State !== 'stopped'}
                onClick={() => powerAction('start_instances')}
              />
              <ActionButton
                label="Stop"
                icon={<Square />}
                tone="amber"
                disabled={power.isPending || row.State !== 'running'}
                onClick={() => powerAction('stop_instances')}
              />
              <ActionButton
                label="Reboot"
                icon={<RotateCw />}
                tone="blue"
                disabled={power.isPending || row.State !== 'running'}
                onClick={() => powerAction('reboot_instances')}
              />
              <ActionButton
                label="Delete"
                icon={<Trash2 />}
                tone="red"
                disabled={power.isPending || row.State === 'terminated'}
                onClick={() => powerAction('terminate_instances')}
              />
            </div>
          </div>

          {power.isError && <ErrorAlert error={power.error} />}

          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y">
                <Detail label="Status" value={<StateBadge state={row.State} />} />
                <Detail label="Size" value={row.InstanceType} />
                <Detail label="Availability zone" value={row.AZ} />
                <Detail label="Region" value={row.Region} />
                <Detail label="Launched" value={timeAgo(row.LaunchTime)} />
                <Detail label="Key pair" value={row.KeyName || 'None'} />
              </dl>
            </Card>

            <Card title="Networking">
              <dl className="divide-y">
                <Detail label="Public IP" value={row.PublicIpAddress || 'None'} mono />
                <Detail label="Private IP" value={row.PrivateIpAddress || 'None'} mono />
                <Detail label="Public DNS" value={row.PublicDnsName || 'None'} mono />
                <Detail label="VPC" value={row.VpcId || 'None'} mono />
                <Detail label="Subnet" value={row.SubnetId || 'None'} mono />
              </dl>
            </Card>

            <ImageHardwareCard row={row} />
            <InstanceHealthCard row={row} />
            <ConfigCard row={row} instanceId={instanceId!} />
            <FirewallCard row={row} instanceId={instanceId!} />
            <TagsCard row={row} instanceId={instanceId!} />
            <BackupCard instanceId={instanceId!} />
          </div>

          <InstanceFirewallRulesCard row={row} />
          <VolumesCard instanceId={instanceId!} />

          <ConfirmDialog
            open={confirmTerminate}
            title={`Terminate ${instanceId}?`}
            description="This permanently deletes the server and cannot be undone."
            confirmLabel="Terminate"
            pending={power.isPending}
            onCancel={() => setConfirmTerminate(false)}
            onConfirm={() =>
              power.mutate(
                {
                  op: 'terminate_instances',
                  params: { InstanceIds: [instanceId] },
                  success: `Termination requested for ${instanceId}`,
                },
                { onSettled: () => setConfirmTerminate(false) },
              )
            }
          />
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
  const skipSave = useRef(false)
  const rename = useEc2Mutation()

  useEffect(() => setName(row.Name), [row.Name])

  // Save on blur: persist only if the name actually changed and wasn't cancelled.
  function commit() {
    if (skipSave.current) {
      skipSave.current = false
      setName(row.Name)
      setEditing(false)
      return
    }
    const next = name.trim()
    if (next && next !== row.Name) {
      rename.mutate({
        op: 'create_tags',
        params: { Resources: [instanceId], Tags: [{ Key: 'Name', Value: next }] },
        success: `Renamed to “${next}”`,
      })
    } else {
      setName(row.Name)
    }
    setEditing(false)
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                skipSave.current = true
                e.currentTarget.blur()
              }
            }}
            placeholder="Server name"
            aria-label="Server name"
            className="-mx-1 min-w-0 max-w-xs rounded border-0 bg-transparent px-1 py-0.5 text-lg font-semibold outline-none ring-2 ring-ring/50"
          />
        ) : (
          <h1
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="-mx-1 cursor-text truncate rounded px-1 text-lg font-semibold hover:bg-muted"
          >
            {row.Name || 'Unnamed server'}
          </h1>
        )}
        <StateBadge state={row.State} size="md" />
      </div>
      <p className="font-mono text-xs text-muted-foreground">{row.InstanceId}</p>
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
  const monitoringOn = row.Monitoring === 'enabled' || row.Monitoring === 'pending'

  return (
    <Card title="Configuration">
      <div className="flex flex-col gap-4">
        {/* Resize */}
        <div>
          <Label htmlFor="resize-instance-type" className="mb-1.5">
            Server size
          </Label>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {stopped ? (
                <InstanceTypeInput id="resize-instance-type" value={size} required onChange={setSize} />
              ) : (
                <Input id="resize-instance-type" disabled value={row.InstanceType} />
              )}
            </div>
            <Button
              onClick={() =>
                resize.mutate({
                  op: 'modify_instance_attribute',
                  params: { InstanceId: instanceId, InstanceType: { Value: size.trim() } },
                  success: `Server size changed to ${size.trim()}`,
                })
              }
              disabled={!stopped || resize.isPending || !size.trim() || size.trim() === row.InstanceType}
            >
              {resize.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
          {!stopped && (
            <p className="mt-1 text-xs text-warning">
              Stop the server first to change its size.
            </p>
          )}
          {resize.isError && (
            <div className="mt-2">
              <ErrorAlert error={resize.error} />
            </div>
          )}
        </div>

        <Separator />

        {/* Monitoring */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="detailed-monitoring" className="text-sm font-medium">
              Detailed monitoring
            </Label>
            <div className="text-xs text-muted-foreground">
              {monitoringOn ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <Switch
            id="detailed-monitoring"
            checked={monitoringOn}
            disabled={monitor.isPending}
            onCheckedChange={(next) =>
              monitor.mutate({
                op: next ? 'monitor_instances' : 'unmonitor_instances',
                params: { InstanceIds: [instanceId] },
                success: `Detailed monitoring ${next ? 'enabled' : 'disabled'}`,
              })
            }
          />
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
          <Shield className="h-4 w-4 text-primary" />
          Firewall
        </span>
      }
    >
      {groupsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading firewalls…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No security groups found in this VPC.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Choose which security groups control traffic to this server.
          </p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {groups.map((g) => (
              <Label
                key={g.GroupId}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(g.GroupId)}
                  onCheckedChange={() => toggle(g.GroupId)}
                />
                <span className="min-w-0">
                  <span className="font-medium">{g.GroupName}</span>
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{g.GroupId}</span>
                </span>
              </Label>
            ))}
          </div>
          <div>
            <Button
              size="sm"
              onClick={() =>
                apply.mutate({
                  op: 'modify_instance_attribute',
                  params: { InstanceId: instanceId, Groups: selected },
                  success: 'Firewall changes applied',
                })
              }
              disabled={!changed || selected.length === 0 || apply.isPending}
            >
              {apply.isPending ? 'Applying…' : 'Apply firewall changes'}
            </Button>
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
        success: `Label “${key.trim()}” added`,
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
          <p className="text-sm text-muted-foreground">No labels on this server yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t.Key} variant="secondary" className="h-auto gap-1.5 rounded-md py-1 font-normal">
                <span>
                  <span className="text-muted-foreground">{t.Key}</span> = {t.Value}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    removeTag.mutate({
                      op: 'delete_tags',
                      params: { Resources: [instanceId], Tags: [{ Key: t.Key }] },
                      success: `Label “${t.Key}” removed`,
                    })
                  }
                  disabled={removeTag.isPending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={`Remove label ${t.Key}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Separator />
        <div className="flex items-center gap-2">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Label"
            aria-label="Label key"
            className="w-28"
          />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Value"
            aria-label="Label value"
            className="flex-1"
          />
          <Button onClick={add} disabled={!key.trim() || addTag.isPending}>
            <Plus />
            Add
          </Button>
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
          <Camera className="h-4 w-4 text-primary" />
          Backup image
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Save the current state of this server as a reusable image (AMI).
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Image name"
            aria-label="Image name"
            className="flex-1"
          />
          <Button
            onClick={() =>
              create.mutate(
                {
                  op: 'create_image',
                  params: { InstanceId: instanceId, Name: name.trim() },
                  success: `Image creation started for “${name.trim()}”. It will appear in your AMIs when ready.`,
                },
                { onSuccess: () => setName('') },
              )
            }
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create image'}
          </Button>
        </div>
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
  const [detachId, setDetachId] = useState<string | null>(null)

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
          <HardDrive className="h-4 w-4 text-primary" />
          Disks
        </span>
      }
    >
      {volumesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading disks…</p>
      ) : volumes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No disks attached.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wide">Volume ID</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Device</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Size</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Type</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">State</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volumes.map((v) => {
                const device = v.Attachments?.[0]?.Device ?? ''
                return (
                  <TableRow key={v.VolumeId}>
                    <TableCell className="font-mono text-xs">{v.VolumeId}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{device}</TableCell>
                    <TableCell>{v.Size} GiB</TableCell>
                    <TableCell>{v.VolumeType}</TableCell>
                    <TableCell>{v.State}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => setDetachId(v.VolumeId)}
                        disabled={detach.isPending}
                      >
                        Detach
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {detach.isError && (
        <div className="mt-2">
          <ErrorAlert error={detach.error} />
        </div>
      )}
      <ConfirmDialog
        open={detachId != null}
        title={`Detach ${detachId}?`}
        description="Detaching the root disk can break the server."
        confirmLabel="Detach"
        pending={detach.isPending}
        onCancel={() => setDetachId(null)}
        onConfirm={() =>
          detachId &&
          detach.mutate(
            { op: 'detach_volume', params: { VolumeId: detachId }, success: `Detach requested for ${detachId}` },
            { onSettled: () => setDetachId(null) },
          )
        }
      />
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
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-all text-right', mono ? 'font-mono text-xs' : 'font-medium')}>
        {value}
      </dd>
    </div>
  )
}

const TONE_CLASS: Record<string, string> = {
  green:
    'border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950/40',
  amber:
    'border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40',
  blue: 'border-primary/30 text-primary hover:bg-accent hover:text-accent-foreground',
  red: 'border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40',
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
    <Button variant="outline" onClick={onClick} disabled={disabled} className={TONE_CLASS[tone]}>
      {icon}
      {label}
    </Button>
  )
}
