export interface InstanceRow {
  InstanceId: string
  Name: string
  State: string
  InstanceType: string
  AZ: string
  Region: string
  PublicIpAddress: string
  PrivateIpAddress: string
  PublicDnsName: string
  VpcId: string
  SubnetId: string
  KeyName: string
  LaunchTime: string
  Monitoring: string
  _raw: any
}

export function flattenInstances(data: any): InstanceRow[] {
  return (data?.Reservations ?? []).flatMap((res: any) =>
    (res.Instances ?? []).map((i: any): InstanceRow => {
      const az: string = i.Placement?.AvailabilityZone ?? ''
      return {
        InstanceId: i.InstanceId,
        Name: i.Tags?.find((t: any) => t.Key === 'Name')?.Value ?? '',
        State: i.State?.Name ?? '',
        InstanceType: i.InstanceType ?? '',
        AZ: az,
        // AZ is "<region><letter>", so drop the trailing letter for the region.
        Region: az ? az.replace(/[a-z]$/, '') : '',
        PublicIpAddress: i.PublicIpAddress ?? '',
        PrivateIpAddress: i.PrivateIpAddress ?? '',
        PublicDnsName: i.PublicDnsName ?? '',
        VpcId: i.VpcId ?? '',
        SubnetId: i.SubnetId ?? '',
        KeyName: i.KeyName ?? '',
        LaunchTime: i.LaunchTime ?? '',
        Monitoring: i.Monitoring?.State ?? '',
        _raw: i,
      }
    }),
  )
}

/** A friendly, human-readable label for an instance's power state. */
export function stateLabel(state: string): string {
  switch (state) {
    case 'running':
      return 'Running'
    case 'stopped':
      return 'Stopped'
    case 'terminated':
      return 'Terminated'
    case 'pending':
      return 'Starting'
    case 'stopping':
      return 'Stopping'
    case 'shutting-down':
      return 'Terminating'
    case 'rebooting':
      return 'Rebooting'
    default:
      return state || 'Unknown'
  }
}

export type StateTone = 'green' | 'gray' | 'red' | 'amber'

export function stateTone(state: string): StateTone {
  switch (state) {
    case 'running':
      return 'green'
    case 'stopped':
      return 'gray'
    case 'terminated':
      return 'red'
    default:
      return 'amber'
  }
}

/** Relative "time ago" for a friendly launch time; falls back to a date. */
export function timeAgo(value?: string): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return String(value)
  const s = Math.floor((Date.now() - then) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`
  return new Date(value).toLocaleDateString()
}
