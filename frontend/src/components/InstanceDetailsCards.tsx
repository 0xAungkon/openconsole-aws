import { useQuery } from '@tanstack/react-query'
import { runQuery } from '../api/proxy'
import type { InstanceRow } from '../lib/ec2'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { Card } from './Card'
import { ErrorAlert } from './ErrorAlert'

function useScope() {
  const mode = useAuthStore((s) => s.mode)
  const guest = useAuthStore((s) => s.guestCreds)
  const user = useAuthStore((s) => s.user?.id)
  const profile = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const endpoint = useSessionStore((s) => s.endpointUrl)
  return [mode, user, profile, guest?.accessKeyId, mode === 'guest' ? guest?.region || region : region, mode === 'guest' ? guest?.endpointUrl || endpoint : endpoint]
}

function Fact({ label, value }: { label: string; value: string | number | undefined }) {
  return <div className="flex justify-between gap-3 border-b border-gray-100 py-2 text-sm last:border-0 dark:border-gray-800">
    <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="min-w-0 break-words text-right font-medium text-gray-800 dark:text-gray-100">{value ?? 'Not provided'}</dd>
  </div>
}

export function ImageHardwareCard({ row }: { row: InstanceRow }) {
  const scope = useScope()
  const imageId: string | undefined = row._raw?.ImageId
  const image = useQuery({
    queryKey: ['ec2-detail-image', imageId, ...scope],
    queryFn: () => runQuery<{ Images?: { ImageId: string; Name?: string; Description?: string; PlatformDetails?: string }[] }>('ec2', 'describe_images', { ImageIds: [imageId] }),
    enabled: !!imageId,
    retry: false,
  })
  const hardware = useQuery({
    queryKey: ['ec2-detail-hardware', row.InstanceType, ...scope],
    queryFn: () => runQuery<{ InstanceTypes?: { VCpuInfo?: { DefaultVCpus?: number }; MemoryInfo?: { SizeInMiB?: number } }[] }>('ec2', 'describe_instance_types', { InstanceTypes: [row.InstanceType] }),
    enabled: !!row.InstanceType,
    retry: false,
  })
  const ami = image.data?.Images?.find((entry) => entry.ImageId === imageId)
  const type = hardware.data?.InstanceTypes?.[0]
  const cpuOptions = row._raw?.CpuOptions
  const cpus = cpuOptions?.CoreCount != null && cpuOptions?.ThreadsPerCore != null
    ? cpuOptions.CoreCount * cpuOptions.ThreadsPerCore : type?.VCpuInfo?.DefaultVCpus
  const arch = row._raw?.Architecture
  return <Card title="Operating system & hardware">
    <dl>
      <Fact label="Image name" value={ami?.Name || (image.isFetching ? 'Loading…' : 'Image name unavailable')} />
      <Fact label="Image ID" value={imageId} />
      <Fact label="Operating system" value={row._raw?.PlatformDetails || ami?.PlatformDetails || row._raw?.Platform} />
      <Fact label="Server size" value={row.InstanceType} />
      <Fact label="Virtual CPUs" value={cpus ?? (hardware.isFetching ? 'Loading…' : 'Unavailable')} />
      <Fact label="Memory" value={type?.MemoryInfo?.SizeInMiB != null ? `${type.MemoryInfo.SizeInMiB / 1024} GiB (${type.MemoryInfo.SizeInMiB.toLocaleString()} MiB)` : hardware.isFetching ? 'Loading…' : 'Unavailable'} />
      <Fact label="Processor" value={arch === 'x86_64' ? '64-bit Intel / AMD' : arch === 'arm64' ? '64-bit ARM' : arch} />
    </dl>
    {ami?.Description && <p className="mt-3 break-words text-xs text-gray-500">{ami.Description}</p>}
    {image.isError && <ErrorAlert error={image.error} />}
    {!!imageId && image.isSuccess && !ami && <p className="mt-2 text-xs text-gray-500">The original image may have been removed or may no longer be accessible.</p>}
    {hardware.isError && <ErrorAlert error={hardware.error} />}
  </Card>
}

interface HealthCheck { Status?: string }
interface Health {
  InstanceId: string
  InstanceStatus?: HealthCheck
  SystemStatus?: HealthCheck
  AttachedEbsStatus?: HealthCheck
  Events?: { Code?: string; Description?: string; NotBefore?: string; NotAfter?: string }[]
}

function HealthResult({ label, check }: { label: string; check?: HealthCheck }) {
  const status = check?.Status
  const labels: Record<string, string> = { ok: 'Passed', impaired: 'Needs attention', initializing: 'Checking…', 'insufficient-data': 'Waiting for data', 'not-applicable': 'Not applicable' }
  return <div className="flex items-center justify-between gap-3 py-2 text-sm">
    <span>{label}</span>
    <span className={`rounded px-2 py-1 text-xs font-medium ${status === 'ok' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : status === 'impaired' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{labels[status ?? ''] ?? 'Unavailable'}</span>
  </div>
}

export function InstanceHealthCard({ row }: { row: InstanceRow }) {
  const scope = useScope()
  const health = useQuery({
    queryKey: ['ec2-detail-health', row.InstanceId, row.State, ...scope],
    queryFn: () => runQuery<{ InstanceStatuses?: Health[] }>('ec2', 'describe_instance_status', { InstanceIds: [row.InstanceId], IncludeAllInstances: true }),
    refetchInterval: row.State === 'running' || row.State === 'pending' ? 30000 : false,
    retry: false,
  })
  const status = health.data?.InstanceStatuses?.find((entry) => entry.InstanceId === row.InstanceId)
  return <Card title="Server health">
    <p className="mb-3 text-xs text-gray-500">AWS checks the server, its host hardware, and attached disk connectivity. These checks do not test your application.</p>
    {health.isError ? <ErrorAlert error={health.error} /> : health.isPending ? <p className="text-sm text-gray-500">Loading health checks…</p> : <>
      {row.State !== 'running' && <p className="mb-2 text-xs text-gray-500">Health checks may not be available while the server is {row.State}.</p>}
      <HealthResult label="Server reachability" check={status?.InstanceStatus} />
      <HealthResult label="AWS host hardware" check={status?.SystemStatus} />
      <HealthResult label="Attached disk connectivity" check={status?.AttachedEbsStatus} />
      {!!status?.Events?.length && <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <h3 className="text-sm font-medium">Scheduled AWS events</h3>
        {status.Events.map((event, index) => <div key={index} className="mt-2 text-xs text-gray-500">
          <p>{event.Description || event.Code || 'Scheduled event'}</p>
          {event.NotBefore && <p>Starts: {new Date(event.NotBefore).toLocaleString()}</p>}
          {event.NotAfter && <p>Ends: {new Date(event.NotAfter).toLocaleString()}</p>}
        </div>)}
      </div>}
    </>}
  </Card>
}

interface Rule {
  IpProtocol?: string
  FromPort?: number
  ToPort?: number
  IpRanges?: { CidrIp?: string; Description?: string }[]
  Ipv6Ranges?: { CidrIpv6?: string; Description?: string }[]
  UserIdGroupPairs?: { GroupId?: string; GroupName?: string; Description?: string }[]
  PrefixListIds?: { PrefixListId?: string; Description?: string }[]
}

function traffic(rule: Rule) {
  const protocol = rule.IpProtocol
  if (protocol === '-1') return 'All traffic'
  if (['icmp', 'icmpv6', '1', '58'].includes(protocol ?? '')) {
    return `${protocol === 'icmpv6' || protocol === '58' ? 'ICMPv6' : 'ICMP'} network messages · type ${rule.FromPort === -1 ? 'all' : rule.FromPort ?? 'unspecified'}, code ${rule.ToPort === -1 ? 'all' : rule.ToPort ?? 'unspecified'}`
  }
  const name = protocol === '6' ? 'TCP' : protocol === '17' ? 'UDP' : protocol?.toUpperCase() || 'Unspecified protocol'
  if (rule.FromPort == null) return name
  const ports = rule.FromPort === rule.ToPort ? `${rule.FromPort}` : `${rule.FromPort}–${rule.ToPort ?? rule.FromPort}`
  const services: Record<number, string> = { 22: 'Remote login (SSH)', 80: 'Web (HTTP)', 443: 'Secure web (HTTPS)', 3389: 'Remote desktop' }
  const service = name === 'TCP' && rule.FromPort === rule.ToPort ? services[rule.FromPort] : undefined
  return `${service ? `${service} · ` : ''}${name} port ${ports}`
}

function RuleList({ title, rules, direction }: { title: string; rules: Rule[]; direction: 'from' | 'to' }) {
  return <div className="mt-3">
    <h4 className="text-sm font-medium">{title}</h4>
    {rules.length === 0 && <p className="mt-1 text-xs text-gray-500">No {direction === 'from' ? 'incoming' : 'outgoing'} rules in this group.</p>}
    {rules.map((rule, index) => {
      const peers = [
        ...(rule.IpRanges ?? []).map((p) => ({ label: p.CidrIp === '0.0.0.0/0' ? 'Anywhere on the internet (IPv4)' : p.CidrIp, description: p.Description })),
        ...(rule.Ipv6Ranges ?? []).map((p) => ({ label: p.CidrIpv6 === '::/0' ? 'Anywhere on the internet (IPv6)' : p.CidrIpv6, description: p.Description })),
        ...(rule.UserIdGroupPairs ?? []).map((p) => ({ label: `Security group ${p.GroupName || ''} ${p.GroupId || ''}`.trim(), description: p.Description })),
        ...(rule.PrefixListIds ?? []).map((p) => ({ label: `Address list ${p.PrefixListId || ''}`, description: p.Description })),
      ]
      return <div key={index} className="mt-2 rounded border border-gray-100 p-2 text-xs dark:border-gray-800">
        <p className="font-medium">{traffic(rule)}</p>
        {peers.length === 0 && <p className="mt-1 text-gray-500">{direction === 'from' ? 'Source' : 'Destination'} not provided</p>}
        {peers.map((peer, i) => <p key={i} className="mt-1 break-words text-gray-500 dark:text-gray-400">Allow {direction} {peer.label || 'unspecified address'}{peer.description ? ` — ${peer.description}` : ''}</p>)}
      </div>
    })}
  </div>
}

export function InstanceFirewallRulesCard({ row }: { row: InstanceRow }) {
  const scope = useScope()
  const groups: { GroupId: string }[] = row._raw?.SecurityGroups ?? []
  const ids = groups.map((group) => group.GroupId).sort()
  const query = useQuery({
    queryKey: ['ec2-detail-rules', ids, ...scope],
    queryFn: () => runQuery<{ SecurityGroups?: { GroupId: string; GroupName?: string; Description?: string; IpPermissions?: Rule[]; IpPermissionsEgress?: Rule[] }[] }>('ec2', 'describe_security_groups', { GroupIds: ids }),
    enabled: ids.length > 0,
    retry: false,
  })
  return <Card title="Allowed network traffic">
    <p className="text-xs text-gray-500">Rules from the attached security groups combine to allow traffic. Other network settings can still block a connection.</p>
    {!ids.length ? <p className="mt-3 text-sm text-gray-500">No security groups attached.</p> : query.isError ? <ErrorAlert error={query.error} /> : query.isPending ? <p className="mt-3 text-sm text-gray-500">Loading firewall rules…</p> : !query.data?.SecurityGroups?.length ? <p className="mt-3 text-sm text-gray-500">Attached group details are unavailable.</p> : query.data.SecurityGroups.map((group) => <div key={group.GroupId} className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
      <h3 className="break-words text-sm font-semibold">{group.GroupName || 'Security group'}</h3>
      <p className="text-xs text-gray-500">{group.GroupId}</p>
      {group.Description && <p className="mt-1 text-xs text-gray-500">{group.Description}</p>}
      <RuleList title="Incoming connections" rules={group.IpPermissions ?? []} direction="from" />
      <RuleList title="Outgoing connections" rules={group.IpPermissionsEgress ?? []} direction="to" />
    </div>)}
  </Card>
}
