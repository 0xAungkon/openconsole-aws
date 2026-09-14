export interface DbRow {
  Id: string
  Arn: string
  Status: string
  Engine: string
  EngineVersion: string
  Class: string
  Storage: number
  StorageType: string
  Endpoint: string
  Port: number
  MasterUsername: string
  DBName: string
  MultiAZ: boolean
  Public: boolean
  BackupRetention: number
  VpcId: string
  SecurityGroups: { id: string; status: string }[]
  AZ: string
  Created: string
  _raw: any
}

export function toDbRow(d: any): DbRow {
  return {
    Id: d.DBInstanceIdentifier ?? '',
    Arn: d.DBInstanceArn ?? '',
    Status: d.DBInstanceStatus ?? '',
    Engine: d.Engine ?? '',
    EngineVersion: d.EngineVersion ?? '',
    Class: d.DBInstanceClass ?? '',
    Storage: d.AllocatedStorage ?? 0,
    StorageType: d.StorageType ?? '',
    Endpoint: d.Endpoint?.Address ?? '',
    Port: d.Endpoint?.Port ?? 0,
    MasterUsername: d.MasterUsername ?? '',
    DBName: d.DBName ?? '',
    MultiAZ: !!d.MultiAZ,
    Public: !!d.PubliclyAccessible,
    BackupRetention: d.BackupRetentionPeriod ?? 0,
    VpcId: d.DBSubnetGroup?.VpcId ?? '',
    SecurityGroups: (d.VpcSecurityGroups ?? []).map((g: any) => ({ id: g.VpcSecurityGroupId, status: g.Status })),
    AZ: d.AvailabilityZone ?? '',
    Created: d.InstanceCreateTime ?? '',
    _raw: d,
  }
}

export function flattenDbInstances(data: any): DbRow[] {
  return (data?.DBInstances ?? []).map(toDbRow)
}

export const ENGINES: { id: string; label: string; port: number; user: string }[] = [
  { id: 'postgres', label: 'PostgreSQL', port: 5432, user: 'postgres' },
  { id: 'mysql', label: 'MySQL', port: 3306, user: 'admin' },
  { id: 'mariadb', label: 'MariaDB', port: 3306, user: 'admin' },
  { id: 'oracle-se2', label: 'Oracle SE2', port: 1521, user: 'admin' },
  { id: 'sqlserver-ex', label: 'SQL Server Express', port: 1433, user: 'admin' },
]

export const engineLabel = (id: string) => ENGINES.find((e) => e.id === id)?.label ?? id

export const DB_CLASSES = [
  'db.t3.micro',
  'db.t3.small',
  'db.t3.medium',
  'db.t4g.micro',
  'db.t4g.small',
  'db.t4g.medium',
  'db.m6g.large',
  'db.m6g.xlarge',
  'db.r6g.large',
  'db.r6g.xlarge',
]

export const DB_STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  stopped: 'Stopped',
  creating: 'Creating',
  starting: 'Starting',
  stopping: 'Stopping',
  rebooting: 'Rebooting',
  modifying: 'Modifying',
  'backing-up': 'Backing up',
  deleting: 'Deleting',
  failed: 'Failed',
  'storage-full': 'Storage full',
}

export function dbStatusTone(status: string): 'green' | 'gray' | 'amber' | 'red' {
  if (status === 'available') return 'green'
  if (status === 'stopped') return 'gray'
  if (['failed', 'deleting', 'storage-full', 'incompatible-parameters', 'inaccessible-encryption-credentials'].includes(status)) return 'red'
  return 'amber'
}

/** Transitional statuses worth polling for. */
export const DB_BUSY = new Set(['creating', 'starting', 'stopping', 'rebooting', 'modifying', 'backing-up', 'deleting', 'configuring-enhanced-monitoring', 'renaming', 'upgrading'])

export function validateDbIdentifier(id: string): string | null {
  if (id.length < 1 || id.length > 63) return 'Must be 1–63 characters.'
  if (!/^[a-z][a-z0-9-]*$/.test(id)) return 'Lowercase letters, numbers and hyphens; must start with a letter.'
  if (id.endsWith('-')) return 'Cannot end with a hyphen.'
  if (id.includes('--')) return 'Cannot contain two consecutive hyphens.'
  return null
}

export function generatePassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#$%^&*-_=+'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Sample connection commands for the engine. */
export function connectionSnippets(db: DbRow): { label: string; value: string }[] {
  const host = db.Endpoint || '<endpoint>'
  const port = db.Port || ENGINES.find((e) => e.id === db.Engine)?.port || 0
  const user = db.MasterUsername || 'admin'
  const name = db.DBName || (db.Engine === 'postgres' ? 'postgres' : '')
  if (db.Engine === 'postgres') {
    return [
      { label: 'psql', value: `psql "host=${host} port=${port} user=${user} dbname=${name || 'postgres'} sslmode=require"` },
      { label: 'URL', value: `postgresql://${user}:<password>@${host}:${port}/${name || 'postgres'}?sslmode=require` },
    ]
  }
  if (db.Engine === 'mysql' || db.Engine === 'mariadb') {
    return [
      { label: 'mysql', value: `mysql -h ${host} -P ${port} -u ${user} -p${name ? ` ${name}` : ''}` },
      { label: 'URL', value: `mysql://${user}:<password>@${host}:${port}/${name}` },
    ]
  }
  return [{ label: 'Host', value: `${host}:${port}` }]
}
