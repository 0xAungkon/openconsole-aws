import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Camera, Check, Copy, Database, FileText, Play, Plus, RefreshCw, RotateCw, Shield, Square, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MetricsCard } from '../components/MetricsCard'
import { DbStatusBadge } from '../components/DbStatusBadge'
import { ErrorAlert } from '../components/ErrorAlert'
import { timeAgo } from '../lib/ec2'
import { DB_BUSY, DB_CLASSES, connectionSnippets, engineLabel, generatePassword, toDbRow, validateDbIdentifier, type DbRow } from '../lib/rds'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

function useDbMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ op, params }: { op: string; params: Record<string, unknown>; success?: string }) => runQuery('rds', op, params),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['rds-instance', id] })
      qc.invalidateQueries({ queryKey: ['rds-instances'] })
      qc.invalidateQueries({ queryKey: ['rds-snapshots', id] })
      if (v.success) toast.success(v.success)
    },
  })
}

export function DatabasePage() {
  const { profile, id = '' } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<{ title: string; description: ReactNode; label: string; run: () => void } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/databases`

  const query = useQuery({
    queryKey: ['rds-instance', id, region, activeProfileId],
    queryFn: () => runQuery<{ DBInstances?: any[] }>('rds', 'describe_db_instances', { DBInstanceIdentifier: id }),
    enabled: !needsProfile && !!id,
    refetchInterval: (q) => (DB_BUSY.has(q.state.data?.DBInstances?.[0]?.DBInstanceStatus ?? '') ? 5000 : false),
  })
  const db: DbRow | undefined = query.data?.DBInstances?.[0] ? toDbRow(query.data.DBInstances[0]) : undefined

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rds-instance', id] })
    queryClient.invalidateQueries({ queryKey: ['rds-snapshots', id] })
    queryClient.invalidateQueries({ queryKey: ['rds-tags'] })
  }

  const power = useDbMutation(id)
  const act = (op: string, label: string) => power.mutate({ op, params: { DBInstanceIdentifier: id }, success: `${label} requested for ${id}` })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary"><ArrowLeft />Back to databases</Button>

      {needsProfile ? (
        <Card title="Database"><p className="text-sm text-warning">Select an AWS profile from the account menu to view this database.</p></Card>
      ) : query.isError ? (
        <ErrorAlert error={query.error} />
      ) : query.isLoading ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-24 w-full" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div>
      ) : !db ? (
        <Card title="Database not found"><p className="text-sm text-muted-foreground">This database no longer exists in {region}.</p></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Database aria-hidden="true" className="h-6 w-6" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <NameEditor db={db} onRenamed={(next) => navigate(`/${profile}/databases/${encodeURIComponent(next)}`, { replace: true })} />
                  <DbStatusBadge status={db.Status} size="md" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {engineLabel(db.Engine)} {db.EngineVersion} <span className="px-1 opacity-50">/</span> {db.Class} <span className="px-1 opacity-50">/</span> {db.Storage} GiB {db.StorageType} <span className="px-1 opacity-50">/</span> {db.AZ || region}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 border-t pt-4 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">
              <Tooltip>
                <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={refresh} disabled={query.isFetching} aria-label="Refresh"><RefreshCw className={cn(query.isFetching && 'animate-spin')} /></Button></TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <ActionButton label="Start" icon={<Play />} tone="green" disabled={power.isPending || db.Status !== 'stopped'} onClick={() => act('start_db_instance', 'Start')} />
              <ActionButton label="Stop" icon={<Square />} tone="amber" disabled={power.isPending || db.Status !== 'available'} onClick={() => setConfirm({ title: `Stop ${db.Id}?`, description: 'Connections will be dropped. AWS restarts stopped databases automatically after 7 days.', label: 'Stop', run: () => act('stop_db_instance', 'Stop') })} />
              <ActionButton label="Reboot" icon={<RotateCw />} tone="blue" disabled={power.isPending || db.Status !== 'available'} onClick={() => setConfirm({ title: `Reboot ${db.Id}?`, description: 'The database will be unavailable for a short time.', label: 'Reboot', run: () => act('reboot_db_instance', 'Reboot') })} />
              <ActionButton label="Delete" icon={<Trash2 />} tone="red" disabled={power.isPending || db.Status === 'deleting' || db.DeletionProtection} onClick={() => setDeleteOpen(true)} />
            </div>
          </div>

          {power.isError && <ErrorAlert error={power.error} />}

          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y">
                <Detail label="Status" value={<DbStatusBadge status={db.Status} />} />
                <Detail label="Engine" value={`${engineLabel(db.Engine)} ${db.EngineVersion}`} />
                <Detail label="Size" value={db.Class} />
                <Detail label="Storage" value={`${db.Storage} GiB ${db.StorageType}`} />
                <Detail label="Multi-AZ" value={db.MultiAZ ? 'Yes' : 'No'} />
                <Detail label="Public access" value={db.Public ? <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Public</Badge> : 'Private'} />
                <Detail label="Backups" value={db.BackupRetention ? `${db.BackupRetention} day${db.BackupRetention === 1 ? '' : 's'}${db.BackupWindow ? ` · ${db.BackupWindow} UTC` : ''}` : 'Disabled'} />
                <Detail label="Maintenance window" value={db.MaintenanceWindow ? `${db.MaintenanceWindow} UTC` : '—'} />
                <Detail label="Deletion protection" value={db.DeletionProtection ? <Badge variant="secondary" className="border-transparent bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300">On</Badge> : 'Off'} />
                <Detail label="VPC" value={db.VpcId || '—'} mono />
                <Detail label="Created" value={db.Created ? `${new Date(db.Created).toLocaleString()} (${timeAgo(db.Created)})` : '—'} />
                <Detail label="ARN" value={<CopyText text={db.Arn} />} mono />
              </dl>
            </Card>
            <ConnectionCard db={db} />
            <ConfigCard db={db} />
            <FirewallCard db={db} />
            <SnapshotsCard db={db} />
            <TagsCard db={db} />
            <Card title="Danger zone">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Delete database</div>
                  <div className="text-xs text-muted-foreground">Optionally take a final snapshot first.</div>
                </div>
                <Button variant="destructive" size="sm" disabled={db.DeletionProtection} onClick={() => setDeleteOpen(true)}>Delete</Button>
              </div>
              {db.DeletionProtection && <p className="mt-2 text-xs text-muted-foreground">Deletion protection is on — turn it off in Configuration first.</p>}
            </Card>
          </div>

          <MetricsCard
            description="Live CloudWatch metrics for this instance."
            metrics={[
              { label: 'CPU', namespace: 'AWS/RDS', metricName: 'CPUUtilization', dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.Id }], stat: 'Average', format: (v) => `${v.toFixed(1)}%` },
              { label: 'Connections', namespace: 'AWS/RDS', metricName: 'DatabaseConnections', dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.Id }], stat: 'Average', format: (v) => String(Math.round(v)) },
              { label: 'Free storage', namespace: 'AWS/RDS', metricName: 'FreeStorageSpace', dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.Id }], stat: 'Average', format: (v) => `${(v / 1024 ** 3).toFixed(1)} GiB` },
              { label: 'Free memory', namespace: 'AWS/RDS', metricName: 'FreeableMemory', dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.Id }], stat: 'Average', format: (v) => `${(v / 1024 ** 2).toFixed(0)} MiB` },
              { label: 'Read IOPS', namespace: 'AWS/RDS', metricName: 'ReadIOPS', dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.Id }], stat: 'Average', format: (v) => v.toFixed(1) },
              { label: 'Write IOPS', namespace: 'AWS/RDS', metricName: 'WriteIOPS', dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.Id }], stat: 'Average', format: (v) => v.toFixed(1) },
            ]}
          />
          <LogsCard db={db} />

          <ConfirmDialog open={confirm != null} title={confirm?.title ?? ''} description={confirm?.description ?? ''} confirmLabel={confirm?.label} destructive={confirm?.label === 'Stop'} pending={power.isPending} onCancel={() => setConfirm(null)} onConfirm={() => { confirm?.run(); setConfirm(null) }} />
          <DeleteDialog db={db} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={() => navigate(backTo)} />
        </>
      )}
    </div>
  )
}

/* ---------------- Connection ---------------- */

function ConnectionCard({ db }: { db: DbRow }) {
  const snippets = connectionSnippets(db)
  return (
    <Card title="Connect">
      {!db.Endpoint ? (
        <p className="text-sm text-muted-foreground">The endpoint appears once the database is available.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="divide-y">
            <Detail label="Host" value={<CopyText text={db.Endpoint} />} mono />
            <Detail label="Port" value={<CopyText text={String(db.Port)} />} mono />
            <Detail label="Username" value={<CopyText text={db.MasterUsername} />} mono />
            {db.DBName && <Detail label="Database" value={<CopyText text={db.DBName} />} mono />}
          </dl>
          {snippets.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{s.value}</code>
                <CopyText text={s.value} iconOnly />
              </div>
            </div>
          ))}
          {db.Status !== 'available' && <p className="text-xs text-warning">The database is {db.Status} — connections may fail until it is available.</p>}
          {!db.Public && <p className="text-xs text-muted-foreground">This database is private: connect from inside its VPC (e.g. a server or a bastion host).</p>}
        </div>
      )}
    </Card>
  )
}

/* ---------------- Configuration ---------------- */

function ConfigCard({ db }: { db: DbRow }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [klass, setKlass] = useState(db.Class)
  const [storage, setStorage] = useState(String(db.Storage))
  const [backups, setBackups] = useState(String(db.BackupRetention))
  const [isPublic, setIsPublic] = useState(db.Public)
  const [multiAz, setMultiAz] = useState(db.MultiAZ)
  const [protect, setProtect] = useState(db.DeletionProtection)
  const [autoMinor, setAutoMinor] = useState(db.AutoMinorUpgrade)
  const [maintWindow, setMaintWindow] = useState(db.MaintenanceWindow)
  const [backupWindow, setBackupWindow] = useState(db.BackupWindow)
  const [engineVersion, setEngineVersion] = useState(db.EngineVersion)
  const [password, setPassword] = useState('')
  useEffect(() => {
    setKlass(db.Class)
    setStorage(String(db.Storage))
    setBackups(String(db.BackupRetention))
    setIsPublic(db.Public)
    setMultiAz(db.MultiAZ)
    setProtect(db.DeletionProtection)
    setAutoMinor(db.AutoMinorUpgrade)
    setMaintWindow(db.MaintenanceWindow)
    setBackupWindow(db.BackupWindow)
    setEngineVersion(db.EngineVersion)
  }, [db.Class, db.Storage, db.BackupRetention, db.Public, db.MultiAZ, db.DeletionProtection, db.AutoMinorUpgrade, db.MaintenanceWindow, db.BackupWindow, db.EngineVersion])
  const m = useDbMutation(db.Id)

  // Valid upgrade targets for the current engine version.
  const upgrades = useQuery({
    queryKey: ['rds-upgrades', db.Engine, db.EngineVersion, activeProfileId],
    queryFn: () => runQuery<{ DBEngineVersions?: { ValidUpgradeTarget?: { EngineVersion: string; IsMajorVersionUpgrade?: boolean }[] }[] }>('rds', 'describe_db_engine_versions', { Engine: db.Engine, EngineVersion: db.EngineVersion }),
    enabled: !!db.Engine && !!db.EngineVersion,
    staleTime: 10 * 60 * 1000,
    retry: false,
    meta: { silent: true },
  })
  const targets = upgrades.data?.DBEngineVersions?.[0]?.ValidUpgradeTarget ?? []
  const majorUpgrade = targets.find((t) => t.EngineVersion === engineVersion)?.IsMajorVersionUpgrade

  const changed =
    klass !== db.Class || Number(storage) !== db.Storage || Number(backups) !== db.BackupRetention || isPublic !== db.Public ||
    multiAz !== db.MultiAZ || protect !== db.DeletionProtection || autoMinor !== db.AutoMinorUpgrade ||
    maintWindow !== db.MaintenanceWindow || backupWindow !== db.BackupWindow || engineVersion !== db.EngineVersion || !!password
  const busy = db.Status !== 'available'
  const windowOk = (v: string, re: RegExp) => !v || re.test(v)
  const maintOk = windowOk(maintWindow, /^(mon|tue|wed|thu|fri|sat|sun):\d{2}:\d{2}-(mon|tue|wed|thu|fri|sat|sun):\d{2}:\d{2}$/i)
  const backupOk = windowOk(backupWindow, /^\d{2}:\d{2}-\d{2}:\d{2}$/)

  return (
    <Card title="Configuration">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate({
            op: 'modify_db_instance',
            params: {
              DBInstanceIdentifier: db.Id,
              ApplyImmediately: true,
              ...(klass !== db.Class ? { DBInstanceClass: klass } : {}),
              ...(Number(storage) !== db.Storage ? { AllocatedStorage: Number(storage) } : {}),
              ...(Number(backups) !== db.BackupRetention ? { BackupRetentionPeriod: Number(backups) } : {}),
              ...(isPublic !== db.Public ? { PubliclyAccessible: isPublic } : {}),
              ...(multiAz !== db.MultiAZ ? { MultiAZ: multiAz } : {}),
              ...(protect !== db.DeletionProtection ? { DeletionProtection: protect } : {}),
              ...(autoMinor !== db.AutoMinorUpgrade ? { AutoMinorVersionUpgrade: autoMinor } : {}),
              ...(maintWindow !== db.MaintenanceWindow ? { PreferredMaintenanceWindow: maintWindow } : {}),
              ...(backupWindow !== db.BackupWindow ? { PreferredBackupWindow: backupWindow } : {}),
              ...(engineVersion !== db.EngineVersion ? { EngineVersion: engineVersion, ...(majorUpgrade ? { AllowMajorVersionUpgrade: true } : {}) } : {}),
              ...(password ? { MasterUserPassword: password } : {}),
            },
            success: 'Changes are being applied',
          }, { onSuccess: () => setPassword('') })
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-class">Size</Label>
            <Select value={klass} onValueChange={setKlass}>
              <SelectTrigger id="cfg-class" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{[...new Set([db.Class, ...DB_CLASSES])].filter(Boolean).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-storage">Storage (GiB)</Label>
            <Input id="cfg-storage" type="number" min={db.Storage} max={65536} value={storage} onChange={(e) => setStorage(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-engine-version">Engine version</Label>
          <Select value={engineVersion} onValueChange={setEngineVersion}>
            <SelectTrigger id="cfg-engine-version" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={db.EngineVersion}>{db.EngineVersion} (current)</SelectItem>
              {targets.filter((t) => t.EngineVersion !== db.EngineVersion).map((t) => <SelectItem key={t.EngineVersion} value={t.EngineVersion}>{t.EngineVersion}{t.IsMajorVersionUpgrade ? ' — major upgrade' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className={cn('text-xs', majorUpgrade ? 'text-warning' : 'text-muted-foreground')}>
            {majorUpgrade ? 'Major upgrades can change behaviour — take a snapshot first.' : targets.length ? `${targets.length} upgrade target${targets.length === 1 ? '' : 's'} available.` : upgrades.isPending ? 'Checking upgrade targets…' : 'No upgrade targets available.'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-backups">Backup retention (days)</Label>
            <Input id="cfg-backups" type="number" min={0} max={35} value={backups} onChange={(e) => setBackups(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-backup-window">Backup window (UTC)</Label>
            <Input id="cfg-backup-window" value={backupWindow} onChange={(e) => setBackupWindow(e.target.value)} placeholder="03:00-04:00" className="font-mono text-xs" aria-invalid={!backupOk} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-maint-window">Maintenance window (UTC)</Label>
          <Input id="cfg-maint-window" value={maintWindow} onChange={(e) => setMaintWindow(e.target.value)} placeholder="sun:05:00-sun:06:00" className="font-mono text-xs" aria-invalid={!maintOk} />
          {(!maintOk || !backupOk) && <span className="text-xs text-destructive">Windows use the form {!maintOk ? 'ddd:hh:mm-ddd:hh:mm' : 'hh:mm-hh:mm'} (30 minutes minimum).</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-password">Reset master password</Label>
          <div className="flex items-center gap-2">
            <Input id="cfg-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep the current password" autoComplete="new-password" className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} aria-label="Generate a new password"><RefreshCw /></Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow id="cfg-public" label="Publicly accessible" hint="Public IP for connections from outside the VPC." checked={isPublic} onChange={setIsPublic} />
          <ToggleRow id="cfg-multiaz" label="Multi-AZ standby" hint="Synchronous replica in another zone for failover." checked={multiAz} onChange={setMultiAz} />
          <ToggleRow id="cfg-protect" label="Deletion protection" hint="Blocks deleting the instance until turned off." checked={protect} onChange={setProtect} />
          <ToggleRow id="cfg-autominor" label="Auto minor upgrades" hint="Apply minor engine versions in the maintenance window." checked={autoMinor} onChange={setAutoMinor} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!changed || !maintOk || !backupOk || m.isPending || busy}>{m.isPending ? 'Applying…' : 'Apply changes'}</Button>
          {busy && <span className="text-xs text-warning">Available only while the database is running.</span>}
        </div>
        {m.isError && <ErrorAlert error={m.error} />}
      </form>
    </Card>
  )
}

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/* ---------------- Name (inline rename) ---------------- */

function NameEditor({ db, onRenamed }: { db: DbRow; onRenamed: (next: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(db.Id)
  const skipSave = useRef(false)
  const m = useDbMutation(db.Id)
  useEffect(() => setName(db.Id), [db.Id])

  function commit() {
    if (skipSave.current) {
      skipSave.current = false
      setName(db.Id)
      setEditing(false)
      return
    }
    const next = name.trim()
    setEditing(false)
    if (!next || next === db.Id) {
      setName(db.Id)
      return
    }
    const problem = validateDbIdentifier(next)
    if (problem) {
      toast.error(problem)
      setName(db.Id)
      return
    }
    m.mutate(
      { op: 'modify_db_instance', params: { DBInstanceIdentifier: db.Id, NewDBInstanceIdentifier: next, ApplyImmediately: true }, success: `Renaming to “${next}”…` },
      { onSuccess: () => onRenamed(next), onError: () => setName(db.Id) },
    )
  }

  return editing ? (
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
      aria-label="Database name"
      className="-mx-1 min-w-0 max-w-xs rounded border-0 bg-transparent px-1 py-0.5 text-lg font-semibold outline-none ring-2 ring-ring/50"
    />
  ) : (
    <h1 onClick={() => db.Status === 'available' && setEditing(true)} title={db.Status === 'available' ? 'Click to rename' : undefined} className={cn('-mx-1 truncate rounded px-1 text-lg font-semibold', db.Status === 'available' && 'cursor-text hover:bg-muted')}>
      {db.Id}
    </h1>
  )
}

/* ---------------- Firewall / security groups ---------------- */

function FirewallCard({ db }: { db: DbRow }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const attached = db.SecurityGroups.map((g) => g.id)
  const [selected, setSelected] = useState<string[]>(attached)
  useEffect(() => setSelected(db.SecurityGroups.map((g) => g.id)), [db.SecurityGroups])
  const m = useDbMutation(db.Id)
  const groups = useQuery({
    queryKey: ['ec2-security-groups', db.VpcId || 'all', region, activeProfileId],
    queryFn: () => runQuery<{ SecurityGroups?: { GroupId: string; GroupName: string; Description?: string }[] }>('ec2', 'describe_security_groups', db.VpcId ? { Filters: [{ Name: 'vpc-id', Values: [db.VpcId] }] } : {}),
    retry: false,
  })
  const list = groups.data?.SecurityGroups ?? []
  const changed = selected.length !== attached.length || selected.some((id) => !attached.includes(id))
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]))

  return (
    <Card title={<span className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Firewall</span>}>
      {groups.isPending ? <Skeleton className="h-16 w-full" /> : groups.isError ? <ErrorAlert error={groups.error} /> : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No security groups found{db.VpcId ? ' in this VPC' : ''}.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Security groups control which hosts can reach port {db.Port || 'the database port'}.</p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {list.map((g) => (
              <Label key={g.GroupId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-muted">
                <Checkbox checked={selected.includes(g.GroupId)} onCheckedChange={() => toggle(g.GroupId)} />
                <span className="min-w-0">
                  <span className="font-medium">{g.GroupName}</span>
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{g.GroupId}</span>
                  {db.SecurityGroups.find((x) => x.id === g.GroupId)?.status && db.SecurityGroups.find((x) => x.id === g.GroupId)!.status !== 'active' && <Badge variant="outline" className="ml-2 text-[10px]">{db.SecurityGroups.find((x) => x.id === g.GroupId)!.status}</Badge>}
                </span>
              </Label>
            ))}
          </div>
          <div>
            <Button size="sm" disabled={!changed || selected.length === 0 || m.isPending} onClick={() => m.mutate({ op: 'modify_db_instance', params: { DBInstanceIdentifier: db.Id, VpcSecurityGroupIds: selected, ApplyImmediately: true }, success: 'Firewall changes applied' })}>
              {m.isPending ? 'Applying…' : 'Apply firewall changes'}
            </Button>
          </div>
          {m.isError && <ErrorAlert error={m.error} />}
        </div>
      )}
    </Card>
  )
}

/* ---------------- Log files ---------------- */

function LogsCard({ db }: { db: DbRow }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const [file, setFile] = useState<string>('')
  const files = useQuery({
    queryKey: ['rds-logfiles', db.Id, region, activeProfileId],
    queryFn: () => runQuery<{ DescribeDBLogFiles?: { LogFileName: string; LastWritten?: number; Size?: number }[] }>('rds', 'describe_db_log_files', { DBInstanceIdentifier: db.Id }),
    retry: false,
    meta: { silent: true },
  })
  const list = (files.data?.DescribeDBLogFiles ?? []).sort((a, b) => (b.LastWritten ?? 0) - (a.LastWritten ?? 0))
  const current = file || list[0]?.LogFileName || ''
  const content = useQuery({
    queryKey: ['rds-logfile', db.Id, current, region, activeProfileId],
    queryFn: () => runQuery<{ LogFileData?: string; AdditionalDataPending?: boolean }>('rds', 'download_db_log_file_portion', { DBInstanceIdentifier: db.Id, LogFileName: current, NumberOfLines: 200 }),
    enabled: !!current,
    retry: false,
  })
  return (
    <Card
      title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Log files</span>}
      actions={
        <div className="flex items-center gap-2">
          {list.length > 0 && (
            <Select value={current} onValueChange={setFile}>
              <SelectTrigger size="sm" className="w-64 font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{list.map((f) => <SelectItem key={f.LogFileName} value={f.LogFileName} className="font-mono text-xs">{f.LogFileName}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="xs" onClick={() => { files.refetch(); content.refetch() }} disabled={files.isFetching || content.isFetching}><RefreshCw className={cn((files.isFetching || content.isFetching) && 'animate-spin')} />Refresh</Button>
        </div>
      }
    >
      {files.isPending ? <Skeleton className="h-24 w-full" /> : files.isError ? (
        <p className="text-sm text-muted-foreground">Log files are not available for this database{db.Status !== 'available' ? ` while it is ${db.Status}` : ''}.</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No log files yet.</p>
      ) : content.isError ? <ErrorAlert error={content.error} /> : content.isPending ? <Skeleton className="h-24 w-full" /> : (
        <Textarea readOnly value={content.data?.LogFileData?.trim() || '(empty)'} rows={12} spellCheck={false} className="resize-y bg-gray-950 font-mono text-[11px] leading-relaxed text-gray-200" />
      )}
    </Card>
  )
}

/* ---------------- Snapshots ---------------- */

function SnapshotsCard({ db }: { db: DbRow }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const m = useDbMutation(db.Id)
  const [restoreFrom, setRestoreFrom] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['rds-snapshots', db.Id, region, activeProfileId],
    queryFn: () => runQuery<{ DBSnapshots?: any[] }>('rds', 'describe_db_snapshots', { DBInstanceIdentifier: db.Id }),
    refetchInterval: (q) => (q.state.data?.DBSnapshots?.some((s) => s.Status !== 'available') ? 10000 : false),
  })
  const snapshots = (q.data?.DBSnapshots ?? []).sort((a, b) => (b.SnapshotCreateTime ?? '').localeCompare(a.SnapshotCreateTime ?? ''))
  const restoreProblem = validateDbIdentifier(restoreId.trim())

  return (
    <Card
      title={<span className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" />Snapshots</span>}
      actions={
        <Button size="xs" variant="outline" disabled={m.isPending || db.Status !== 'available'} onClick={() => {
          const snap = `${db.Id}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
          m.mutate({ op: 'create_db_snapshot', params: { DBInstanceIdentifier: db.Id, DBSnapshotIdentifier: snap }, success: `Snapshot ${snap} started` })
        }}>
          <Plus />Take snapshot
        </Button>
      }
    >
      {q.isError ? <ErrorAlert error={q.error} /> : q.isPending ? <Skeleton className="h-16 w-full" /> : snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No snapshots yet. Snapshots let you restore this database to a point in time as a new instance.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wide">Snapshot</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Taken</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.DBSnapshotIdentifier}>
                  <TableCell className="font-mono text-xs">{s.DBSnapshotIdentifier}<div className="text-[10px] text-muted-foreground">{s.SnapshotType}</div></TableCell>
                  <TableCell><DbStatusBadge status={s.Status} /></TableCell>
                  <TableCell>{timeAgo(s.SnapshotCreateTime)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="xs" disabled={s.Status !== 'available'} onClick={() => { setRestoreFrom(s.DBSnapshotIdentifier); setRestoreId(`${db.Id}-restored`) }}>Restore</Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete snapshot" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirmDelete(s.DBSnapshotIdentifier)}><Trash2 /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {m.isError && <div className="mt-2"><ErrorAlert error={m.error} /></div>}

      <ConfirmDialog open={confirmDelete != null} title={`Delete snapshot ${confirmDelete}?`} description="This cannot be undone." confirmLabel="Delete snapshot" pending={m.isPending} onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && m.mutate({ op: 'delete_db_snapshot', params: { DBSnapshotIdentifier: confirmDelete }, success: `Snapshot ${confirmDelete} deleted` }, { onSettled: () => setConfirmDelete(null) })} />

      <Dialog open={restoreFrom != null} onOpenChange={(o) => !o && setRestoreFrom(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore snapshot</DialogTitle>
            <DialogDescription>Creates a new database instance from <span className="font-mono">{restoreFrom}</span>. The current database is not changed.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!restoreProblem && restoreFrom) m.mutate({ op: 'restore_db_instance_from_db_snapshot', params: { DBInstanceIdentifier: restoreId.trim(), DBSnapshotIdentifier: restoreFrom, DBInstanceClass: db.Class, PubliclyAccessible: db.Public }, success: `Restoring into “${restoreId.trim()}”` }, { onSuccess: () => setRestoreFrom(null) }) }} className="flex flex-col gap-2">
            <Label htmlFor="restore-id">New database name</Label>
            <Input id="restore-id" value={restoreId} onChange={(e) => setRestoreId(e.target.value)} autoFocus />
            {restoreId && restoreProblem && <span className="text-xs text-destructive">{restoreProblem}</span>}
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={() => setRestoreFrom(null)}>Cancel</Button>
              <Button type="submit" disabled={!!restoreProblem || m.isPending}>{m.isPending ? 'Restoring…' : 'Restore'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ---------------- Tags ---------------- */

function TagsCard({ db }: { db: DbRow }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const q = useQuery({
    queryKey: ['rds-tags', db.Arn, activeProfileId],
    queryFn: () => runQuery<{ TagList?: { Key: string; Value: string }[] }>('rds', 'list_tags_for_resource', { ResourceName: db.Arn }),
    enabled: !!db.Arn,
    retry: false,
  })
  const tags = (q.data?.TagList ?? []).filter((t) => t.Key !== 'Name')
  const add = useMutation({
    mutationFn: () => runQuery('rds', 'add_tags_to_resource', { ResourceName: db.Arn, Tags: [{ Key: key.trim(), Value: value.trim() }] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rds-tags', db.Arn] })
      toast.success(`Label “${key.trim()}” added`)
      setKey('')
      setValue('')
    },
  })
  const remove = useMutation({
    mutationFn: (k: string) => runQuery('rds', 'remove_tags_from_resource', { ResourceName: db.Arn, TagKeys: [k] }),
    onSuccess: (_r, k) => {
      qc.invalidateQueries({ queryKey: ['rds-tags', db.Arn] })
      toast.success(`Label “${k}” removed`)
    },
  })
  return (
    <Card title="Labels">
      <div className="flex flex-col gap-3">
        {q.isPending ? <Skeleton className="h-6 w-40" /> : tags.length === 0 ? <p className="text-sm text-muted-foreground">No labels on this database yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t.Key} variant="secondary" className="h-auto gap-1.5 rounded-md py-1 font-normal">
                <span><span className="text-muted-foreground">{t.Key}</span> = {t.Value}</span>
                <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(t.Key)} className="text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label={`Remove label ${t.Key}`}><X className="size-3" /></button>
              </Badge>
            ))}
          </div>
        )}
        <Separator />
        <div className="flex items-center gap-2">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Label" aria-label="Label key" className="w-28" />
          <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && key.trim() && add.mutate()} placeholder="Value" aria-label="Label value" className="flex-1" />
          <Button onClick={() => add.mutate()} disabled={!key.trim() || add.isPending}><Plus />Add</Button>
        </div>
        {q.isError && <ErrorAlert error={q.error} />}
      </div>
    </Card>
  )
}

/* ---------------- Delete dialog ---------------- */

function DeleteDialog({ db, open, onClose, onDeleted }: { db: DbRow; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [finalSnapshot, setFinalSnapshot] = useState(true)
  const [snapshotId, setSnapshotId] = useState(`${db.Id}-final`)
  const problem = finalSnapshot ? validateDbIdentifier(snapshotId.trim()) : null
  const m = useMutation({
    mutationFn: () => runQuery('rds', 'delete_db_instance', {
      DBInstanceIdentifier: db.Id,
      ...(finalSnapshot ? { SkipFinalSnapshot: false, FinalDBSnapshotIdentifier: snapshotId.trim() } : { SkipFinalSnapshot: true }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rds-instances'] })
      toast.success(finalSnapshot ? `Deleting ${db.Id} after snapshot ${snapshotId.trim()}` : `Deletion started for ${db.Id}`)
      onDeleted()
    },
  })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete database “{db.Id}”?</DialogTitle>
          <DialogDescription>The instance and its data will be permanently removed.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="final-snapshot">Take a final snapshot</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Recommended — you can restore from it later.</p>
            </div>
            <Switch id="final-snapshot" checked={finalSnapshot} onCheckedChange={setFinalSnapshot} />
          </div>
          {finalSnapshot && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="final-snapshot-id">Snapshot name</Label>
              <Input id="final-snapshot-id" value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)} />
              {problem && <span className="text-xs text-destructive">{problem}</span>}
            </div>
          )}
          {m.isError && <ErrorAlert error={m.error} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={m.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={!!problem || m.isPending}>{m.isPending ? 'Deleting…' : 'Delete database'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- shared bits ---------------- */

function Detail({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-all text-right', mono ? 'font-mono text-xs' : 'font-medium')}>{value}</dd>
    </div>
  )
}

function CopyText({ text, iconOnly }: { text: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      {!iconOnly && <span className="break-all">{text}</span>}
      <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy" className="size-5 shrink-0 text-muted-foreground hover:text-primary">{copied ? <Check className="text-green-500" /> : <Copy />}</Button>
    </span>
  )
}

const TONE_CLASS: Record<string, string> = {
  green: 'border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950/40',
  amber: 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40',
  blue: 'border-primary/30 text-primary hover:bg-accent hover:text-accent-foreground',
  red: 'border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40',
}

function ActionButton({ label, icon, tone, disabled, onClick }: { label: string; icon: ReactNode; tone: keyof typeof TONE_CLASS; disabled: boolean; onClick: () => void }) {
  return <Button variant="outline" onClick={onClick} disabled={disabled} className={TONE_CLASS[tone]}>{icon}{label}</Button>
}
