import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Plus, RefreshCw, Search, Table2, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { CodenameInput } from '../components/CodenameInput'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { TableStatusBadge } from '../components/TableStatusBadge'
import { generateCodename } from '../lib/codename'
import { ATTR_TYPES, TABLE_BUSY, toTableRow, validateTableName, type AttrType, type TableRow as DdbTable } from '../lib/dynamodb'
import { timeAgo } from '../lib/ec2'
import { formatBytes } from '../lib/s3'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const PAGE_SIZE = 30

export function TablesPage() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteName, setDeleteName] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const needsProfile = mode === 'register' && activeProfileId == null

  const query = useQuery({
    queryKey: ['ddb-tables', region, activeProfileId],
    queryFn: async () => {
      const names: string[] = []
      let start: string | undefined
      do {
        const p = await runQuery<{ TableNames?: string[]; LastEvaluatedTableName?: string }>('dynamodb', 'list_tables', { Limit: 100, ...(start ? { ExclusiveStartTableName: start } : {}) })
        names.push(...(p.TableNames ?? []))
        start = p.LastEvaluatedTableName
      } while (start)
      // Describe in parallel (bounded) for status / size / keys.
      const rows: DdbTable[] = []
      for (let i = 0; i < names.length; i += 8) {
        const chunk = await Promise.all(names.slice(i, i + 8).map((n) => runQuery<{ Table: any }>('dynamodb', 'describe_table', { TableName: n }).then((r) => toTableRow(r.Table)).catch(() => toTableRow({ TableName: n, TableStatus: 'UNKNOWN' }))))
        rows.push(...chunk)
      }
      return rows
    },
    enabled: !needsProfile,
    refetchInterval: (q) => (q.state.data?.some((t) => TABLE_BUSY.has(t.Status)) ? 5000 : false),
  })
  const rows = useMemo(() => query.data ?? [], [query.data])
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.Status))].sort(), [rows])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => (status === 'all' || r.Status === status) && (!q || r.Name.toLowerCase().includes(q)))
  }, [rows, search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => setPage(1), [search, status, region])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ddb-tables'] })
  const remove = useMutation({
    mutationFn: (name: string) => runQuery('dynamodb', 'delete_table', { TableName: name }),
    onSuccess: (_r, name) => {
      invalidate()
      toast.success(`Deleting table “${name}”`)
    },
    onSettled: () => setDeleteName(null),
  })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-5 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Table2 aria-hidden="true" className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your tables</h1>
            <p className="mt-1 text-sm text-muted-foreground">Serverless NoSQL key-value tables in {region}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" aria-label="Search tables" className="pl-8 sm:w-64" />
          </div>
          {statuses.length > 1 && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filter by status" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s} ({rows.filter((x) => x.Status === s).length})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Tooltip>
            <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={invalidate} disabled={query.isFetching} aria-label="Refresh"><RefreshCw className={cn(query.isFetching && 'animate-spin')} /></Button></TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button onClick={() => setCreateOpen(true)}><Plus />New table</Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 flex-1', createOpen && 'lg:w-[62%]')}>
          {needsProfile ? (
            <Card title="NoSQL"><p className="text-sm text-warning">Select an AWS profile from the account menu to view your tables.</p></Card>
          ) : query.isError ? (
            <ErrorAlert error={query.error} />
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 py-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary"><Table2 className="h-6 w-6" /></div>
              <div>
                <p className="text-sm font-medium">{rows.length ? 'No tables match your filters' : 'No tables yet'}</p>
                <p className="text-xs text-muted-foreground">{rows.length ? 'Try a different status or search term.' : 'Create your first table — just pick a partition key.'}</p>
              </div>
              {!rows.length && <Button onClick={() => setCreateOpen(true)}><Plus />New table</Button>}
            </div>
          ) : (
            <UiCard className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 text-xs uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Keys</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Items</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Size</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Capacity</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Created</TableHead>
                      <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((t) => (
                      <TableRowView key={t.Name} table={t} busy={remove.isPending && remove.variables === t.Name} onOpen={() => navigate(`/${profile}/nosql/${encodeURIComponent(t.Name)}`)} onDelete={() => setDeleteName(t.Name)} />
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
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[38%]">
            <CreateTablePanel onClose={() => setCreateOpen(false)} onCreated={(name) => { invalidate(); setCreateOpen(false); navigate(`/${profile}/nosql/${encodeURIComponent(name)}`) }} />
          </aside>
        )}
      </div>

      <ConfirmDialog open={deleteName != null} title={`Delete table “${deleteName}”?`} description="All items in the table are permanently deleted." confirmLabel="Delete table" pending={remove.isPending} onCancel={() => setDeleteName(null)} onConfirm={() => deleteName && remove.mutate(deleteName)} />
    </div>
  )
}

function TableRowView({ table: t, busy, onOpen, onDelete }: { table: DdbTable; busy: boolean; onOpen: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  async function copyArn(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(t.Arn)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }
  return (
    <TableRow onClick={onOpen} className="cursor-pointer">
      <TableCell className="px-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">{t.Name}</span>
          {t.Arn && <Button variant="ghost" size="icon-xs" onClick={copyArn} aria-label="Copy table ARN" className="size-5 text-muted-foreground hover:text-primary">{copied ? <Check className="text-green-500" /> : <Copy />}</Button>}
        </div>
      </TableCell>
      <TableCell><TableStatusBadge status={t.Status} /></TableCell>
      <TableCell className="font-mono text-xs">{t.PartitionKey ? `${t.PartitionKey.name} (${t.PartitionKey.type})` : '—'}{t.SortKey ? <span className="text-muted-foreground"> · {t.SortKey.name} ({t.SortKey.type})</span> : ''}</TableCell>
      <TableCell>{t.ItemCount.toLocaleString()}</TableCell>
      <TableCell>{formatBytes(t.SizeBytes)}</TableCell>
      <TableCell>{t.BillingMode === 'PROVISIONED' ? `${t.ReadCapacity} RCU / ${t.WriteCapacity} WCU` : 'On-demand'}</TableCell>
      <TableCell>{timeAgo(t.Created)}</TableCell>
      <TableCell className="px-4">
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="xs" onClick={(e) => { stop(e); onOpen() }}>Open</Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={busy || t.DeletionProtection} onClick={(e) => { stop(e); onDelete() }} aria-label="Delete table" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"><Trash2 /></Button>
            </TooltipTrigger>
            <TooltipContent>{t.DeletionProtection ? 'Deletion protection is on' : 'Delete'}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  )
}

/* ------------------------------------------------------------------ */

function CreateTablePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState(generateCodename)
  const [pk, setPk] = useState('id')
  const [pkType, setPkType] = useState<AttrType>('S')
  const [useSk, setUseSk] = useState(false)
  const [sk, setSk] = useState('createdAt')
  const [skType, setSkType] = useState<AttrType>('S')
  const [billing, setBilling] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>('PAY_PER_REQUEST')
  const [rcu, setRcu] = useState('5')
  const [wcu, setWcu] = useState('5')
  const [protect, setProtect] = useState(false)
  const problem = validateTableName(name.trim())
  const keysOk = !!pk.trim() && (!useSk || (!!sk.trim() && sk.trim() !== pk.trim()))

  const create = useMutation({
    mutationFn: async () => {
      const table = name.trim()
      await runQuery('dynamodb', 'create_table', {
        TableName: table,
        AttributeDefinitions: [{ AttributeName: pk.trim(), AttributeType: pkType }, ...(useSk ? [{ AttributeName: sk.trim(), AttributeType: skType }] : [])],
        KeySchema: [{ AttributeName: pk.trim(), KeyType: 'HASH' }, ...(useSk ? [{ AttributeName: sk.trim(), KeyType: 'RANGE' }] : [])],
        BillingMode: billing,
        ...(billing === 'PROVISIONED' ? { ProvisionedThroughput: { ReadCapacityUnits: Number(rcu), WriteCapacityUnits: Number(wcu) } } : {}),
        DeletionProtectionEnabled: protect,
        Tags: [{ Key: 'Name', Value: table }],
      })
      return table
    },
    onSuccess: (table) => {
      toast.success(`Table “${table}” is being created`)
      onCreated(table)
    },
  })

  return (
    <UiCard className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><span className="inline-block h-4 w-[3px] rounded-full bg-primary" />Create a new table</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-muted-foreground"><X /></Button>
      </CardHeader>
      <CardContent className="p-4">
        {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
        <form onSubmit={(e) => { e.preventDefault(); if (!problem && keysOk) create.mutate() }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tbl-name">Table name <span className="text-destructive">*</span></Label>
            <CodenameInput id="tbl-name" value={name} required onChange={setName} />
            {name && problem && <span className="text-xs text-destructive">{problem}</span>}
          </div>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tbl-pk">Partition key <span className="text-destructive">*</span></Label>
              <Input id="tbl-pk" value={pk} onChange={(e) => setPk(e.target.value)} required className="font-mono text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tbl-pk-type">Type</Label>
              <Select value={pkType} onValueChange={(v) => setPkType(v as AttrType)}>
                <SelectTrigger id="tbl-pk-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ATTR_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <span className="-mt-1 text-xs text-muted-foreground">Every item needs this attribute; it decides how data is spread across partitions.</span>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="tbl-use-sk">Add a sort key</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Lets you store several items per partition key and query ranges (e.g. by date).</p>
            </div>
            <Switch id="tbl-use-sk" checked={useSk} onCheckedChange={setUseSk} />
          </div>
          {useSk && (
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tbl-sk">Sort key</Label>
                <Input id="tbl-sk" value={sk} onChange={(e) => setSk(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tbl-sk-type">Type</Label>
                <Select value={skType} onValueChange={(v) => setSkType(v as AttrType)}>
                  <SelectTrigger id="tbl-sk-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ATTR_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Capacity</Label>
            <Tabs value={billing} onValueChange={(v) => setBilling(v as typeof billing)}>
              <TabsList className="w-full"><TabsTrigger value="PAY_PER_REQUEST">On-demand</TabsTrigger><TabsTrigger value="PROVISIONED">Provisioned</TabsTrigger></TabsList>
            </Tabs>
            <span className="text-xs text-muted-foreground">{billing === 'PAY_PER_REQUEST' ? 'Pay per request — no capacity planning, scales automatically.' : 'Fixed read/write capacity units — cheaper for steady traffic.'}</span>
          </div>
          {billing === 'PROVISIONED' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label htmlFor="tbl-rcu">Read units</Label><Input id="tbl-rcu" type="number" min={1} value={rcu} onChange={(e) => setRcu(e.target.value)} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="tbl-wcu">Write units</Label><Input id="tbl-wcu" type="number" min={1} value={wcu} onChange={(e) => setWcu(e.target.value)} /></div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="tbl-protect">Deletion protection</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Blocks deleting the table until turned off.</p>
            </div>
            <Switch id="tbl-protect" checked={protect} onCheckedChange={setProtect} />
          </div>
          <Button type="submit" disabled={!!problem || !keysOk || create.isPending}>{create.isPending ? 'Creating…' : 'Create table'}</Button>
        </form>
      </CardContent>
    </UiCard>
  )
}
