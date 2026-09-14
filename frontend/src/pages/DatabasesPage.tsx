import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Database, Eye, EyeOff, Play, Plus, RefreshCw, Search, Square, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { CodenameInput } from '../components/CodenameInput'
import { generateCodename } from '../lib/codename'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DbStatusBadge } from '../components/DbStatusBadge'
import { ErrorAlert } from '../components/ErrorAlert'
import { timeAgo } from '../lib/ec2'
import { DB_BUSY, DB_CLASSES, ENGINES, engineLabel, flattenDbInstances, generatePassword, validateDbIdentifier, type DbRow } from '../lib/rds'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const PAGE_SIZE = 30
type StatusFilter = 'all' | 'available' | 'stopped' | 'other'

export function DatabasesPage() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const needsProfile = mode === 'register' && activeProfileId == null

  const query = useQuery({
    queryKey: ['rds-instances', region, activeProfileId],
    queryFn: async () => {
      const all: any[] = []
      let marker: string | undefined
      do {
        const p = await runQuery<any>('rds', 'describe_db_instances', { MaxRecords: 100, ...(marker ? { Marker: marker } : {}) })
        all.push(...(p.DBInstances ?? []))
        marker = p.Marker || undefined
      } while (marker)
      return flattenDbInstances({ DBInstances: all })
    },
    enabled: !needsProfile,
    refetchInterval: (q) => (q.state.data?.some((d) => DB_BUSY.has(d.Status)) ? 10000 : false),
  })
  const rows = useMemo(() => query.data ?? [], [query.data])
  const counts = useMemo(() => ({
    all: rows.length,
    available: rows.filter((r) => r.Status === 'available').length,
    stopped: rows.filter((r) => r.Status === 'stopped').length,
    other: rows.filter((r) => r.Status !== 'available' && r.Status !== 'stopped').length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) =>
      (status === 'all' || (status === 'other' ? r.Status !== 'available' && r.Status !== 'stopped' : r.Status === status)) &&
      (!q || r.Id.toLowerCase().includes(q) || r.Engine.toLowerCase().includes(q) || r.Endpoint.toLowerCase().includes(q)))
  }, [rows, search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => setPage(1), [search, status, region])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rds-instances'] })

  const lifecycle = useMutation({
    mutationFn: ({ op, id }: { op: string; id: string }) => runQuery('rds', op, { DBInstanceIdentifier: id }),
    onSuccess: (_r, { op, id }) => {
      invalidate()
      toast.success(`${op === 'start_db_instance' ? 'Start' : 'Stop'} requested for ${id}`)
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => runQuery('rds', 'delete_db_instance', { DBInstanceIdentifier: id, SkipFinalSnapshot: true }),
    onSuccess: (_r, id) => {
      invalidate()
      toast.success(`Deletion started for ${id}`)
    },
    onSettled: () => setDeleteId(null),
  })
  const pendingId = lifecycle.isPending ? lifecycle.variables?.id : undefined

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All databases' },
    { key: 'available', label: 'Available' },
    { key: 'stopped', label: 'Stopped' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-5 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Database aria-hidden="true" className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your databases</h1>
            <p className="mt-1 text-sm text-muted-foreground">Managed relational databases in {region}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, engine or host" aria-label="Search databases" className="pl-8 sm:w-64" />
          </div>
          {!needsProfile && (
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label} ({counts[f.key]})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={invalidate} disabled={query.isFetching} aria-label="Refresh"><RefreshCw className={cn(query.isFetching && 'animate-spin')} /></Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button onClick={() => setCreateOpen(true)}><Plus />New database</Button>
        </div>
      </div>

      {lifecycle.isError && <ErrorAlert error={lifecycle.error} />}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 flex-1', createOpen && 'lg:w-[65%]')}>
          {needsProfile ? (
            <Card title="Databases"><p className="text-sm text-warning">Select an AWS profile from the account menu to view your databases.</p></Card>
          ) : query.isError ? (
            <ErrorAlert error={query.error} />
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 py-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary"><Database className="h-6 w-6" /></div>
              <div>
                <p className="text-sm font-medium">{rows.length ? 'No databases match your filters' : 'No databases yet'}</p>
                <p className="text-xs text-muted-foreground">{rows.length ? 'Try a different status or search term.' : 'Create your first managed database — PostgreSQL, MySQL and more.'}</p>
              </div>
              {!rows.length && <Button onClick={() => setCreateOpen(true)}><Plus />New database</Button>}
            </div>
          ) : (
            <UiCard className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 text-xs uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Engine</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Size</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Storage</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Endpoint</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Created</TableHead>
                      <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((d) => (
                      <DbRowView
                        key={d.Id}
                        db={d}
                        busy={pendingId === d.Id}
                        onOpen={() => navigate(`/${profile}/databases/${encodeURIComponent(d.Id)}`)}
                        onAct={(op) => (op === 'delete' ? setDeleteId(d.Id) : lifecycle.mutate({ op, id: d.Id }))}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                    <span className="px-2">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                  </div>
                )}
              </div>
            </UiCard>
          )}
        </div>

        {createOpen && (
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[35%]">
            <CreateDatabasePanel
              onClose={() => setCreateOpen(false)}
              onCreated={(id) => {
                invalidate()
                setCreateOpen(false)
                navigate(`/${profile}/databases/${encodeURIComponent(id)}`)
              }}
            />
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={deleteId != null}
        title={`Delete database “${deleteId}”?`}
        description="The instance and its data are deleted without a final snapshot. Open the database to delete with a final snapshot instead."
        confirmLabel="Delete database"
        pending={remove.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function DbRowView({ db, busy, onOpen, onAct }: { db: DbRow; busy: boolean; onOpen: () => void; onAct: (op: string) => void }) {
  const [copied, setCopied] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  async function copyEndpoint(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(`${db.Endpoint}:${db.Port}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }
  const action = (label: string, icon: React.ReactNode, className: string, disabled: boolean, op: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={(e) => { stop(e); onAct(op) }} aria-label={label} className={className}>{icon}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
  return (
    <TableRow onClick={onOpen} className="cursor-pointer">
      <TableCell className="px-4">
        <div className="font-medium">{db.Id}</div>
        {db.DBName && <div className="text-xs text-muted-foreground">db: {db.DBName}</div>}
      </TableCell>
      <TableCell><DbStatusBadge status={db.Status} /></TableCell>
      <TableCell>{engineLabel(db.Engine)} <span className="text-xs text-muted-foreground">{db.EngineVersion}</span></TableCell>
      <TableCell>{db.Class}</TableCell>
      <TableCell>{db.Storage} GiB</TableCell>
      <TableCell>
        {db.Endpoint ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs">
            <span className="max-w-[16rem] truncate">{db.Endpoint}:{db.Port}</span>
            <Button variant="ghost" size="icon-xs" onClick={copyEndpoint} aria-label="Copy endpoint" className="size-5 text-muted-foreground hover:text-primary">{copied ? <Check className="text-green-500" /> : <Copy />}</Button>
          </span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>{timeAgo(db.Created)}</TableCell>
      <TableCell className="px-4">
        <div className="flex items-center justify-end gap-1">
          {action('Start', <Play />, 'text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/40', busy || db.Status !== 'stopped', 'start_db_instance')}
          {action('Stop', <Square />, 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40', busy || db.Status !== 'available', 'stop_db_instance')}
          {action('Delete', <Trash2 />, 'text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40', busy || db.Status === 'deleting', 'delete')}
        </div>
      </TableCell>
    </TableRow>
  )
}

/* ------------------------------------------------------------------ */

function CreateDatabasePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [id, setId] = useState(generateCodename)
  const [engine, setEngine] = useState(ENGINES[0].id)
  const [klass, setKlass] = useState('db.t3.micro')
  const [storage, setStorage] = useState('20')
  const [username, setUsername] = useState(ENGINES[0].user)
  const [password, setPassword] = useState(generatePassword)
  const [showPw, setShowPw] = useState(false)
  const [dbName, setDbName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [backups, setBackups] = useState('7')
  const problem = validateDbIdentifier(id.trim())
  const pwProblem = password.length < 8 ? 'At least 8 characters.' : /[/@"' ]/.test(password) ? 'Cannot contain / @ " \' or spaces.' : null

  const create = useMutation({
    mutationFn: async () => {
      const identifier = id.trim()
      await runQuery('rds', 'create_db_instance', {
        DBInstanceIdentifier: identifier,
        Engine: engine,
        DBInstanceClass: klass,
        AllocatedStorage: Number(storage),
        MasterUsername: username.trim(),
        MasterUserPassword: password,
        PubliclyAccessible: isPublic,
        BackupRetentionPeriod: Number(backups),
        StorageType: 'gp3',
        ...(dbName.trim() ? { DBName: dbName.trim() } : {}),
        Tags: [{ Key: 'Name', Value: identifier }],
      })
      return identifier
    },
    onSuccess: (identifier) => {
      toast.success(`Database “${identifier}” is being created — this usually takes a few minutes`)
      onCreated(identifier)
    },
  })

  return (
    <UiCard className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><span className="inline-block h-4 w-[3px] rounded-full bg-primary" />Create a new database</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-muted-foreground"><X /></Button>
      </CardHeader>
      <CardContent className="p-4">
        {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
        <form onSubmit={(e) => { e.preventDefault(); if (!problem && !pwProblem) create.mutate() }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-id">Database name <span className="text-destructive">*</span></Label>
            <CodenameInput id="db-id" value={id} required onChange={setId} />
            <span className={cn('text-xs', id && problem ? 'text-destructive' : 'text-muted-foreground')}>{(id && problem) || 'The instance identifier — lowercase letters, numbers and hyphens.'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="db-engine">Engine</Label>
              <Select value={engine} onValueChange={(v) => { setEngine(v); setUsername(ENGINES.find((e) => e.id === v)?.user ?? 'admin') }}>
                <SelectTrigger id="db-engine" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ENGINES.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="db-class">Size</Label>
              <Select value={klass} onValueChange={setKlass}>
                <SelectTrigger id="db-class" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{DB_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="db-storage">Storage (GiB)</Label>
              <Input id="db-storage" type="number" min={20} max={65536} value={storage} onChange={(e) => setStorage(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="db-backups">Backup retention (days)</Label>
              <Input id="db-backups" type="number" min={0} max={35} value={backups} onChange={(e) => setBackups(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-user">Master username <span className="text-destructive">*</span></Label>
            <Input id="db-user" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-password">Master password <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-2">
              <Input id="db-password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff /> : <Eye />}</Button>
              <Button type="button" variant="outline" size="icon" onClick={() => { setPassword(generatePassword()); setShowPw(true) }} aria-label="Generate a new password"><RefreshCw /></Button>
            </div>
            <span className={cn('text-xs', pwProblem ? 'text-destructive' : 'text-muted-foreground')}>{pwProblem ?? 'Save this now — it is not shown again after creation.'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-name">Initial database</Label>
            <Input id="db-name" value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="Optional — e.g. app" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="db-public">Publicly accessible</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Give the instance a public IP so you can connect from outside the VPC.</p>
            </div>
            <Switch id="db-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button type="submit" disabled={!!problem || !!pwProblem || !username.trim() || create.isPending}>{create.isPending ? 'Creating…' : 'Create database'}</Button>
        </form>
      </CardContent>
    </UiCard>
  )
}
