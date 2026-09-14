import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Camera, Check, Copy, CopyPlus, Layers, PencilLine, Play, Plus, RefreshCw, Table2, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { MetricsCard } from '../components/MetricsCard'
import { TableStatusBadge } from '../components/TableStatusBadge'
import {
  ATTR_TYPES,
  FILTER_OPS,
  SORT_OPS,
  TABLE_BUSY,
  buildFilter,
  buildKeyCondition,
  itemId,
  itemKey,
  marshallItem,
  previewValue,
  toTableRow,
  unmarshallItem,
  type AttrType,
  type FilterOp,
  type Item,
  type KeyDef,
  type Plain,
  type SortOp,
  type TableRow as DdbTable,
} from '../lib/dynamodb'
import { timeAgo } from '../lib/ec2'
import { errorMessage } from '../lib/errors'
import { formatBytes } from '../lib/s3'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

function useTableMutation(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ op, params }: { op: string; params: Record<string, unknown>; success?: string }) => runQuery('dynamodb', op, params),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['ddb-table', name] })
      qc.invalidateQueries({ queryKey: ['ddb-tables'] })
      if (v.success) toast.success(v.success)
    },
  })
}

export function TablePage() {
  const { profile, table = '' } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/nosql`

  const query = useQuery({
    queryKey: ['ddb-table', table, region, activeProfileId],
    queryFn: () => runQuery<{ Table: any }>('dynamodb', 'describe_table', { TableName: table }),
    enabled: !needsProfile && !!table,
    refetchInterval: (q) => (TABLE_BUSY.has(q.state.data?.Table?.TableStatus ?? '') || q.state.data?.Table?.GlobalSecondaryIndexes?.some((g: any) => g.IndexStatus !== 'ACTIVE') ? 4000 : false),
  })
  const t: DdbTable | undefined = query.data ? toTableRow(query.data.Table) : undefined

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ddb-table', table] })
    queryClient.invalidateQueries({ queryKey: ['ddb-items', table] })
    queryClient.invalidateQueries({ queryKey: ['ddb-ttl', table] })
    queryClient.invalidateQueries({ queryKey: ['ddb-pitr', table] })
    queryClient.invalidateQueries({ queryKey: ['ddb-backups', table] })
    queryClient.invalidateQueries({ queryKey: ['ddb-tags'] })
  }

  const remove = useMutation({
    mutationFn: () => runQuery('dynamodb', 'delete_table', { TableName: table }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ddb-tables'] })
      toast.success(`Deleting table “${table}”`)
      navigate(backTo)
    },
    onSettled: () => setConfirmDelete(false),
  })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary"><ArrowLeft />Back to tables</Button>

      {needsProfile ? (
        <Card title="Table"><p className="text-sm text-warning">Select an AWS profile from the account menu to view this table.</p></Card>
      ) : query.isError ? (
        <ErrorAlert error={query.error} />
      ) : query.isLoading || !t ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Table2 aria-hidden="true" className="h-6 w-6" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-semibold">{t.Name}</h1>
                  <TableStatusBadge status={t.Status} size="md" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{t.PartitionKey?.name}</span>{t.SortKey && <> + <span className="font-mono">{t.SortKey.name}</span></>}
                  <span className="px-1 opacity-50">/</span> {t.ItemCount.toLocaleString()} items <span className="px-1 opacity-50">/</span> {formatBytes(t.SizeBytes)}
                  <span className="px-1 opacity-50">/</span> {t.BillingMode === 'PROVISIONED' ? `${t.ReadCapacity} RCU · ${t.WriteCapacity} WCU` : 'On-demand'}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 border-t pt-4 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">
              <Tooltip>
                <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={refresh} disabled={query.isFetching} aria-label="Refresh"><RefreshCw className={cn(query.isFetching && 'animate-spin')} /></Button></TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" disabled={t.DeletionProtection || t.Status === 'DELETING'} onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button>
            </div>
          </div>

          {t.PartitionKey && <ItemsExplorer table={t} />}

          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y">
                <Detail label="Partition key" value={t.PartitionKey ? `${t.PartitionKey.name} (${ATTR_TYPES.find((a) => a.id === t.PartitionKey!.type)?.label})` : '—'} mono />
                <Detail label="Sort key" value={t.SortKey ? `${t.SortKey.name} (${ATTR_TYPES.find((a) => a.id === t.SortKey!.type)?.label})` : 'None'} mono />
                <Detail label="Items" value={`${t.ItemCount.toLocaleString()} (updated ~every 6h)`} />
                <Detail label="Size" value={formatBytes(t.SizeBytes)} />
                <Detail label="Capacity" value={t.BillingMode === 'PROVISIONED' ? `Provisioned — ${t.ReadCapacity} RCU / ${t.WriteCapacity} WCU` : 'On-demand'} />
                <Detail label="Created" value={t.Created ? `${new Date(t.Created).toLocaleString()} (${timeAgo(t.Created)})` : '—'} />
                <Detail label="ARN" value={<CopyText text={t.Arn} />} mono />
              </dl>
            </Card>
            <CapacityCard table={t} />
            <IndexesCard table={t} />
            <TtlCard table={t} />
            <StreamsCard table={t} />
            <ProtectionCard table={t} />
            <BackupsCard table={t} />
            <TagsCard table={t} />
            <Card title="Danger zone">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Delete table</div>
                  <div className="text-xs text-muted-foreground">Deletes the table and every item in it.</div>
                </div>
                <Button variant="destructive" size="sm" disabled={t.DeletionProtection} onClick={() => setConfirmDelete(true)}>Delete</Button>
              </div>
              {t.DeletionProtection && <p className="mt-2 text-xs text-muted-foreground">Deletion protection is on — turn it off in Protection first.</p>}
            </Card>
          </div>

          <MetricsCard
            description="Consumed capacity and throttling from CloudWatch."
            metrics={[
              { label: 'Read units consumed', namespace: 'AWS/DynamoDB', metricName: 'ConsumedReadCapacityUnits', dimensions: [{ Name: 'TableName', Value: t.Name }], stat: 'Sum' },
              { label: 'Write units consumed', namespace: 'AWS/DynamoDB', metricName: 'ConsumedWriteCapacityUnits', dimensions: [{ Name: 'TableName', Value: t.Name }], stat: 'Sum' },
              { label: 'Throttled requests', namespace: 'AWS/DynamoDB', metricName: 'ThrottledRequests', dimensions: [{ Name: 'TableName', Value: t.Name }], stat: 'Sum' },
              { label: 'Latency (get)', namespace: 'AWS/DynamoDB', metricName: 'SuccessfulRequestLatency', dimensions: [{ Name: 'TableName', Value: t.Name }, { Name: 'Operation', Value: 'GetItem' }], stat: 'Average', format: (v) => `${v.toFixed(1)} ms` },
              { label: 'Latency (query)', namespace: 'AWS/DynamoDB', metricName: 'SuccessfulRequestLatency', dimensions: [{ Name: 'TableName', Value: t.Name }, { Name: 'Operation', Value: 'Query' }], stat: 'Average', format: (v) => `${v.toFixed(1)} ms` },
              { label: 'System errors', namespace: 'AWS/DynamoDB', metricName: 'SystemErrors', dimensions: [{ Name: 'TableName', Value: t.Name }], stat: 'Sum' },
            ]}
          />

          <ConfirmDialog open={confirmDelete} title={`Delete table “${table}”?`} description="All items are permanently deleted. This cannot be undone." confirmLabel="Delete table" pending={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} />
        </>
      )}
    </div>
  )
}

/* ================================================================== */
/* Items explorer                                                      */
/* ================================================================== */

const PAGE = 50
type Mode = 'scan' | 'query'

function ItemsExplorer({ table: t }: { table: DdbTable }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const pk = t.PartitionKey!
  const sk = t.SortKey

  const [mode, setMode] = useState<Mode>('scan')
  const [index, setIndex] = useState('') // '' = base table
  // Scan filter
  const [fAttr, setFAttr] = useState('')
  const [fOp, setFOp] = useState<FilterOp>('=')
  const [fVal, setFVal] = useState('')
  const [fType, setFType] = useState<'S' | 'N' | 'BOOL'>('S')
  // Query
  const [qPk, setQPk] = useState('')
  const [qSkOp, setQSkOp] = useState<SortOp>('=')
  const [qSk, setQSk] = useState('')
  const [qSk2, setQSk2] = useState('')
  // Applied (only refetch on Run)
  const [applied, setApplied] = useState<{ op: 'scan' | 'query'; params: Record<string, unknown> } | null>(null)
  const [pages, setPages] = useState<Item[]>([]) // ExclusiveStartKeys of extra pages
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ item?: Item; template?: Record<string, Plain> } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null)

  const indexKeys = useMemo(() => {
    const g = t.GSIs.find((x) => x.name === index)
    return g ? { pk: g.keys[0], sk: g.keys[1] } : { pk, sk }
  }, [index, t.GSIs, pk, sk])

  function run() {
    let params: Record<string, unknown> = { TableName: t.Name, Limit: PAGE, ...(index ? { IndexName: index } : {}) }
    if (mode === 'query') {
      if (!qPk.trim()) return toast.error(`Enter a value for ${indexKeys.pk.name}`)
      params = { ...params, ...buildKeyCondition(indexKeys.pk, qPk, indexKeys.sk, qSkOp, qSk, qSk2) }
    } else if (fAttr.trim() && (FILTER_OPS.find((o) => o.id === fOp)?.needsValue ? fVal !== '' : true)) {
      params = { ...params, ...buildFilter(fAttr.trim(), fOp, fVal, fType) }
    }
    setPages([])
    setSelected(new Set())
    setApplied({ op: mode, params })
  }

  const items = useQuery({
    queryKey: ['ddb-items', t.Name, applied, pages, region, activeProfileId],
    queryFn: async () => {
      const { op, params: base } = applied!
      const all: Item[] = []
      let last: Item | undefined
      const starts: (Item | undefined)[] = [undefined, ...pages]
      let scanned = 0
      for (const start of starts) {
        const r = await runQuery<{ Items?: Item[]; LastEvaluatedKey?: Item; ScannedCount?: number }>('dynamodb', op, { ...base, ...(start ? { ExclusiveStartKey: start } : {}) })
        all.push(...(r.Items ?? []))
        scanned += r.ScannedCount ?? 0
        last = r.LastEvaluatedKey
      }
      return { items: all, next: last, scanned }
    },
    enabled: applied != null,
    retry: false,
  })
  // Run an unfiltered scan on first mount.
  useEffect(() => {
    if (!applied) setApplied({ op: 'scan', params: { TableName: t.Name, Limit: PAGE } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.Name])

  const rows = useMemo(() => items.data?.items ?? [], [items.data])
  const columns = useMemo(() => {
    const keys = [pk.name, ...(sk ? [sk.name] : [])]
    const seen = new Map<string, number>()
    for (const it of rows) for (const k of Object.keys(it)) if (!keys.includes(k)) seen.set(k, (seen.get(k) ?? 0) + 1)
    const rest = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    return { shown: [...keys, ...rest.slice(0, 6)], hidden: rest.slice(6).length }
  }, [rows, pk.name, sk])

  const refreshItems = () => {
    qc.invalidateQueries({ queryKey: ['ddb-items', t.Name] })
    setSelected(new Set())
  }

  const save = useMutation({
    mutationFn: (obj: Record<string, Plain>) => runQuery('dynamodb', 'put_item', { TableName: t.Name, Item: marshallItem(obj) }),
    onSuccess: () => {
      refreshItems()
      setEditing(null)
      toast.success('Item saved')
    },
  })
  const del = useMutation({
    mutationFn: async (list: Item[]) => {
      for (let i = 0; i < list.length; i += 25) {
        const chunk = list.slice(i, i + 25)
        if (chunk.length === 1) await runQuery('dynamodb', 'delete_item', { TableName: t.Name, Key: itemKey(chunk[0], pk, sk) })
        else await runQuery('dynamodb', 'batch_write_item', { RequestItems: { [t.Name]: chunk.map((it) => ({ DeleteRequest: { Key: itemKey(it, pk, sk) } })) } })
      }
      return list.length
    },
    onSuccess: (n) => {
      refreshItems()
      toast.success(`Deleted ${n} item${n === 1 ? '' : 's'}`)
    },
    onSettled: () => setConfirm(null),
  })

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(itemId(r, pk, sk)))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => itemId(r, pk, sk))))
  const toggle = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const selectedItems = rows.filter((r) => selected.has(itemId(r, pk, sk)))
  const busy = t.Status !== 'ACTIVE'

  const template = (): Record<string, Plain> => ({ [pk.name]: pk.type === 'N' ? 0 : '', ...(sk ? { [sk.name]: sk.type === 'N' ? 0 : '' } : {}) })

  return (
    <Card
      title="Items"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setConfirm({ title: `Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`, description: 'This cannot be undone.', run: () => del.mutate(selectedItems) })}><Trash2 />Delete {selected.size}</Button>
          )}
          <Button variant="ghost" size="sm" onClick={refreshItems} disabled={items.isFetching}><RefreshCw className={cn(items.isFetching && 'animate-spin')} />Refresh</Button>
          <Button size="sm" disabled={busy} onClick={() => setEditing({ template: template() })}><Plus />Add item</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Search controls */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList><TabsTrigger value="scan">Scan</TabsTrigger><TabsTrigger value="query">Query</TabsTrigger></TabsList>
          </Tabs>
          {t.GSIs.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Index</Label>
              <Select value={index || '__table__'} onValueChange={(v) => setIndex(v === '__table__' ? '' : v)}>
                <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__table__">Table (primary keys)</SelectItem>
                  {t.GSIs.map((g) => <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === 'scan' ? (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Filter attribute</Label>
                <Input value={fAttr} onChange={(e) => setFAttr(e.target.value)} placeholder="optional, e.g. status" className="h-7 w-40 font-mono text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Condition</Label>
                <Select value={fOp} onValueChange={(v) => setFOp(v as FilterOp)}>
                  <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{FILTER_OPS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {FILTER_OPS.find((o) => o.id === fOp)?.needsValue && (
                <>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Value</Label>
                    <Input value={fVal} onChange={(e) => setFVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} className="h-7 w-40 font-mono text-xs" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Type</Label>
                    <Select value={fType} onValueChange={(v) => setFType(v as typeof fType)}>
                      <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="S">String</SelectItem><SelectItem value="N">Number</SelectItem><SelectItem value="BOOL">Boolean</SelectItem></SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">{indexKeys.pk.name} <span className="opacity-60">({indexKeys.pk.type})</span> =</Label>
                <Input value={qPk} onChange={(e) => setQPk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="partition key value" className="h-7 w-44 font-mono text-xs" />
              </div>
              {indexKeys.sk && (
                <>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">{indexKeys.sk.name} <span className="opacity-60">({indexKeys.sk.type})</span></Label>
                    <Select value={qSkOp} onValueChange={(v) => setQSkOp(v as SortOp)}>
                      <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{SORT_OPS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Value</Label>
                    <Input value={qSk} onChange={(e) => setQSk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="optional" className="h-7 w-36 font-mono text-xs" />
                  </div>
                  {qSkOp === 'between' && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px] text-muted-foreground">and</Label>
                      <Input value={qSk2} onChange={(e) => setQSk2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} className="h-7 w-36 font-mono text-xs" />
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <Button size="sm" onClick={run} disabled={items.isFetching}><Play />Run</Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.data ? `${rows.length} item${rows.length === 1 ? '' : 's'} shown${applied?.op === 'scan' && items.data.scanned > rows.length ? ` (${items.data.scanned} scanned)` : ''}${items.data.next ? ' — more available' : ''}` : ''}
          </span>
        </div>

        {items.isError ? (
          <ErrorAlert error={items.error} />
        ) : items.isPending && !items.data ? (
          <div className="flex flex-col gap-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Table2 className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{applied && Object.keys(applied.params).length > 2 ? 'No items match' : 'This table is empty'}</p>
            <p className="text-xs text-muted-foreground">{applied && Object.keys(applied.params).length > 2 ? 'Try a different filter or query.' : 'Add your first item as JSON.'}</p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-4"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
                  {columns.shown.map((c) => (
                    <TableHead key={c} className="font-mono text-xs normal-case tracking-normal">
                      {c}{c === pk.name && <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">PK</Badge>}{sk && c === sk.name && <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">SK</Badge>}
                    </TableHead>
                  ))}
                  {columns.hidden > 0 && <TableHead className="text-xs normal-case tracking-normal text-muted-foreground">+{columns.hidden} more</TableHead>}
                  <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((it) => {
                  const id = itemId(it, pk, sk)
                  const plain = unmarshallItem(it)
                  return (
                    <TableRow key={id} className={cn('cursor-pointer', selected.has(id) && 'bg-accent/40')} onClick={() => setEditing({ item: it })}>
                      <TableCell className="px-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(id)} onCheckedChange={() => toggle(id)} aria-label="Select item" /></TableCell>
                      {columns.shown.map((c) => (
                        <TableCell key={c} className={cn('max-w-[16rem] truncate font-mono text-xs', !(c in plain) && 'text-muted-foreground/50')} title={c in plain ? JSON.stringify(plain[c]) : undefined}>
                          {c in plain ? previewValue(plain[c]) : '—'}
                        </TableCell>
                      ))}
                      {columns.hidden > 0 && <TableCell className="text-xs text-muted-foreground">…</TableCell>}
                      <TableCell className="px-4">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Edit" className="text-muted-foreground hover:text-primary" onClick={() => setEditing({ item: it })}><PencilLine /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Duplicate" className="text-muted-foreground hover:text-primary" onClick={() => setEditing({ template: { ...plain, [pk.name]: pk.type === 'N' ? 0 : `${plain[pk.name]}-copy` } })}><CopyPlus /></Button></TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Delete" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirm({ title: 'Delete this item?', description: JSON.stringify(unmarshallItem(itemKey(it, pk, sk))), run: () => del.mutate([it]) })}><Trash2 /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {items.data?.next && (
              <div className="flex justify-center border-t p-2">
                <Button variant="outline" size="sm" onClick={() => setPages((p) => [...p, items.data!.next!])} disabled={items.isFetching}>Load more</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ItemDialog state={editing} pk={pk} sk={sk} pending={save.isPending} error={save.isError ? save.error : undefined} onClose={() => setEditing(null)} onSave={(obj) => save.mutate(obj)} />
      <ConfirmDialog open={confirm != null} title={confirm?.title ?? ''} description={confirm?.description ?? ''} confirmLabel="Delete" pending={del.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm?.run()} />
    </Card>
  )
}

function ItemDialog({ state, pk, sk, pending, error, onClose, onSave }: { state: { item?: Item; template?: Record<string, Plain> } | null; pk: KeyDef; sk?: KeyDef; pending: boolean; error?: unknown; onClose: () => void; onSave: (obj: Record<string, Plain>) => void }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!state) return
    const obj = state.item ? unmarshallItem(state.item) : (state.template ?? {})
    setText(JSON.stringify(obj, null, 2))
  }, [state])
  let parsed: Record<string, Plain> | null = null
  let problem: string | null = null
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object' || Array.isArray(v)) problem = 'The item must be a JSON object.'
    else {
      parsed = v
      if (!(pk.name in v) || v[pk.name] === '' || v[pk.name] === null) problem = `Missing partition key “${pk.name}”.`
      else if (sk && (!(sk.name in v) || v[sk.name] === '' || v[sk.name] === null)) problem = `Missing sort key “${sk.name}”.`
      else if (pk.type === 'N' && typeof v[pk.name] !== 'number') problem = `“${pk.name}” must be a number.`
      else if (sk?.type === 'N' && typeof v[sk.name] !== 'number') problem = `“${sk.name}” must be a number.`
    }
  } catch (e) {
    problem = `Invalid JSON: ${(e as Error).message}`
  }
  const isEdit = !!state?.item
  return (
    <Dialog open={state != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit item' : 'Add item'}</DialogTitle>
          <DialogDescription>Plain JSON — strings, numbers, booleans, null, lists and nested objects are converted to DynamoDB types for you. {isEdit && 'Changing a key attribute creates a new item instead.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (parsed && !problem) onSave(parsed) }} className="flex flex-col gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" autoFocus />
          {problem && <span className="text-xs text-destructive">{problem}</span>}
          {error != null && <ErrorAlert error={error} />}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!!problem || pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== */
/* Settings cards                                                      */
/* ================================================================== */

function CapacityCard({ table: t }: { table: DdbTable }) {
  const [billing, setBilling] = useState(t.BillingMode)
  const [rcu, setRcu] = useState(String(t.ReadCapacity || 5))
  const [wcu, setWcu] = useState(String(t.WriteCapacity || 5))
  useEffect(() => {
    setBilling(t.BillingMode)
    setRcu(String(t.ReadCapacity || 5))
    setWcu(String(t.WriteCapacity || 5))
  }, [t.BillingMode, t.ReadCapacity, t.WriteCapacity])
  const m = useTableMutation(t.Name)
  const changed = billing !== t.BillingMode || (billing === 'PROVISIONED' && (Number(rcu) !== t.ReadCapacity || Number(wcu) !== t.WriteCapacity))
  return (
    <Card title="Capacity">
      <div className="flex flex-col gap-3">
        <Tabs value={billing} onValueChange={(v) => setBilling(v as typeof billing)}>
          <TabsList className="w-full"><TabsTrigger value="PAY_PER_REQUEST">On-demand</TabsTrigger><TabsTrigger value="PROVISIONED">Provisioned</TabsTrigger></TabsList>
        </Tabs>
        {billing === 'PROVISIONED' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="cap-rcu">Read units</Label><Input id="cap-rcu" type="number" min={1} value={rcu} onChange={(e) => setRcu(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="cap-wcu">Write units</Label><Input id="cap-wcu" type="number" min={1} value={wcu} onChange={(e) => setWcu(e.target.value)} /></div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Pay per request; scales automatically with traffic. Switching modes is allowed once per 24 hours.</p>
        )}
        <div>
          <Button size="sm" disabled={!changed || m.isPending || t.Status !== 'ACTIVE'} onClick={() => m.mutate({ op: 'update_table', params: { TableName: t.Name, BillingMode: billing, ...(billing === 'PROVISIONED' ? { ProvisionedThroughput: { ReadCapacityUnits: Number(rcu), WriteCapacityUnits: Number(wcu) } } : {}) }, success: 'Capacity update started' })}>
            {m.isPending ? 'Applying…' : 'Apply'}
          </Button>
        </div>
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

function IndexesCard({ table: t }: { table: DdbTable }) {
  const m = useTableMutation(t.Name)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pk, setPk] = useState('')
  const [pkType, setPkType] = useState<AttrType>('S')
  const [sk, setSk] = useState('')
  const [skType, setSkType] = useState<AttrType>('S')
  const [projection, setProjection] = useState<'ALL' | 'KEYS_ONLY'>('ALL')
  const [confirm, setConfirm] = useState<string | null>(null)
  const existingTypes: Record<string, AttrType> = Object.fromEntries((t._raw.AttributeDefinitions ?? []).map((a: any) => [a.AttributeName, a.AttributeType]))
  const valid = !!name.trim() && !!pk.trim() && !t.GSIs.some((g) => g.name === name.trim()) && (!sk.trim() || sk.trim() !== pk.trim())

  function create() {
    const defs = [...(t._raw.AttributeDefinitions ?? [])]
    const ensure = (n: string, ty: AttrType) => { if (!defs.some((d: any) => d.AttributeName === n)) defs.push({ AttributeName: n, AttributeType: ty }) }
    ensure(pk.trim(), existingTypes[pk.trim()] ?? pkType)
    if (sk.trim()) ensure(sk.trim(), existingTypes[sk.trim()] ?? skType)
    m.mutate({
      op: 'update_table',
      params: {
        TableName: t.Name,
        AttributeDefinitions: defs,
        GlobalSecondaryIndexUpdates: [{
          Create: {
            IndexName: name.trim(),
            KeySchema: [{ AttributeName: pk.trim(), KeyType: 'HASH' }, ...(sk.trim() ? [{ AttributeName: sk.trim(), KeyType: 'RANGE' }] : [])],
            Projection: { ProjectionType: projection },
            ...(t.BillingMode === 'PROVISIONED' ? { ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 } } : {}),
          },
        }],
      },
      success: `Creating index “${name.trim()}” — this can take a while on large tables`,
    }, { onSuccess: () => setOpen(false) })
  }

  return (
    <Card title={<span className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Indexes</span>} actions={<Button size="xs" variant="outline" disabled={t.Status !== 'ACTIVE'} onClick={() => { setName(''); setPk(''); setSk(''); setOpen(true) }}><Plus />Add index</Button>}>
      <p className="mb-3 text-xs text-muted-foreground">Global secondary indexes let you query by attributes other than the primary key.</p>
      {t.GSIs.length === 0 ? <p className="text-sm text-muted-foreground">No indexes.</p> : (
        <ul className="divide-y">
          {t.GSIs.map((g) => (
            <li key={g.name} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">{g.name}<TableStatusBadge status={g.status} /></div>
                <div className="font-mono text-xs text-muted-foreground">{g.keys.map((k) => `${k.name} (${k.type})`).join(' + ')} · {g.projection}</div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Delete index" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" disabled={g.status !== 'ACTIVE'} onClick={() => setConfirm(g.name)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      {m.isError && <div className="mt-2"><ErrorAlert error={m.error} /></div>}
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add a global secondary index</DialogTitle><DialogDescription>Choose the attributes to index. Existing attributes keep their declared type.</DialogDescription></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (valid) create() }} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="gsi-name">Index name</Label><Input id="gsi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="status-index" autoFocus /></div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div className="flex flex-col gap-1.5"><Label htmlFor="gsi-pk">Partition key</Label><Input id="gsi-pk" value={pk} onChange={(e) => setPk(e.target.value)} className="font-mono text-xs" /></div>
              <div className="flex flex-col gap-1.5"><Label>Type</Label><Select value={existingTypes[pk.trim()] ?? pkType} onValueChange={(v) => setPkType(v as AttrType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{ATTR_TYPES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div className="flex flex-col gap-1.5"><Label htmlFor="gsi-sk">Sort key <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="gsi-sk" value={sk} onChange={(e) => setSk(e.target.value)} className="font-mono text-xs" /></div>
              <div className="flex flex-col gap-1.5"><Label>Type</Label><Select value={existingTypes[sk.trim()] ?? skType} onValueChange={(v) => setSkType(v as AttrType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{ATTR_TYPES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Projected attributes</Label>
              <Tabs value={projection} onValueChange={(v) => setProjection(v as typeof projection)}><TabsList className="w-full"><TabsTrigger value="ALL">All attributes</TabsTrigger><TabsTrigger value="KEYS_ONLY">Keys only</TabsTrigger></TabsList></Tabs>
            </div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={!valid || m.isPending}>{m.isPending ? 'Creating…' : 'Create index'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirm != null} title={`Delete index “${confirm}”?`} description="Queries using this index will fail." confirmLabel="Delete index" pending={m.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm && m.mutate({ op: 'update_table', params: { TableName: t.Name, GlobalSecondaryIndexUpdates: [{ Delete: { IndexName: confirm } }] }, success: `Deleting index “${confirm}”` }, { onSettled: () => setConfirm(null) })} />
    </Card>
  )
}

function TtlCard({ table: t }: { table: DdbTable }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [attr, setAttr] = useState('expiresAt')
  const q = useQuery({
    queryKey: ['ddb-ttl', t.Name, activeProfileId],
    queryFn: () => runQuery<{ TimeToLiveDescription?: { TimeToLiveStatus?: string; AttributeName?: string } }>('dynamodb', 'describe_time_to_live', { TableName: t.Name }),
    retry: false,
  })
  const status = q.data?.TimeToLiveDescription?.TimeToLiveStatus ?? 'DISABLED'
  const enabled = status === 'ENABLED' || status === 'ENABLING'
  useEffect(() => { if (q.data?.TimeToLiveDescription?.AttributeName) setAttr(q.data.TimeToLiveDescription.AttributeName) }, [q.data])
  const m = useMutation({
    mutationFn: (next: boolean) => runQuery('dynamodb', 'update_time_to_live', { TableName: t.Name, TimeToLiveSpecification: { Enabled: next, AttributeName: attr.trim() } }),
    onSuccess: (_r, next) => {
      qc.invalidateQueries({ queryKey: ['ddb-ttl', t.Name] })
      toast.success(next ? `TTL enabled on “${attr.trim()}”` : 'TTL disabled')
    },
  })
  return (
    <Card title="Time to live (TTL)">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="ttl-switch">Expire items automatically</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{q.isPending ? 'Loading…' : enabled ? `Items whose “${q.data?.TimeToLiveDescription?.AttributeName}” (Unix seconds) is in the past are deleted.` : 'Store a Unix timestamp (seconds) in an attribute and DynamoDB deletes the item after it.'}</p>
          </div>
          <Switch id="ttl-switch" checked={enabled} disabled={q.isPending || m.isPending || (!enabled && !attr.trim())} onCheckedChange={(v) => m.mutate(v)} />
        </div>
        {!enabled && (
          <div className="flex flex-col gap-1.5"><Label htmlFor="ttl-attr">TTL attribute</Label><Input id="ttl-attr" value={attr} onChange={(e) => setAttr(e.target.value)} className="w-56 font-mono text-xs" /></div>
        )}
        {q.isError && <ErrorAlert error={q.error} />}
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

function StreamsCard({ table: t }: { table: DdbTable }) {
  const m = useTableMutation(t.Name)
  const [view, setView] = useState(t.StreamViewType || 'NEW_AND_OLD_IMAGES')
  return (
    <Card title="Streams">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="stream-switch">Change data capture</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Emit every insert, update and delete to a stream that Lambda or Kinesis can consume.</p>
          </div>
          <Switch id="stream-switch" checked={t.StreamEnabled} disabled={m.isPending || t.Status !== 'ACTIVE'} onCheckedChange={(v) => m.mutate({ op: 'update_table', params: { TableName: t.Name, StreamSpecification: v ? { StreamEnabled: true, StreamViewType: view } : { StreamEnabled: false } }, success: v ? 'Stream enabled' : 'Stream disabled' })} />
        </div>
        {t.StreamEnabled ? (
          <dl className="divide-y">
            <Detail label="View type" value={t.StreamViewType} mono />
            <Detail label="Stream ARN" value={<CopyText text={t.StreamArn} />} mono />
          </dl>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stream-view">What each record contains</Label>
            <Select value={view} onValueChange={setView}>
              <SelectTrigger id="stream-view" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW_AND_OLD_IMAGES">New and old item (recommended)</SelectItem>
                <SelectItem value="NEW_IMAGE">New item only</SelectItem>
                <SelectItem value="OLD_IMAGE">Old item only</SelectItem>
                <SelectItem value="KEYS_ONLY">Keys only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

function ProtectionCard({ table: t }: { table: DdbTable }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const m = useTableMutation(t.Name)
  const pitr = useQuery({
    queryKey: ['ddb-pitr', t.Name, activeProfileId],
    queryFn: () => runQuery<{ ContinuousBackupsDescription?: { PointInTimeRecoveryDescription?: { PointInTimeRecoveryStatus?: string } } }>('dynamodb', 'describe_continuous_backups', { TableName: t.Name }),
    retry: false,
    meta: { silent: true },
  })
  const pitrOn = pitr.data?.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus === 'ENABLED'
  const pitrM = useMutation({
    mutationFn: (v: boolean) => runQuery('dynamodb', 'update_continuous_backups', { TableName: t.Name, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['ddb-pitr', t.Name] })
      toast.success(v ? 'Point-in-time recovery enabled' : 'Point-in-time recovery disabled')
    },
  })
  return (
    <Card title="Protection">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div><Label htmlFor="prot-delete">Deletion protection</Label><p className="mt-0.5 text-xs text-muted-foreground">Blocks deleting the table until turned off.</p></div>
          <Switch id="prot-delete" checked={t.DeletionProtection} disabled={m.isPending} onCheckedChange={(v) => m.mutate({ op: 'update_table', params: { TableName: t.Name, DeletionProtectionEnabled: v }, success: v ? 'Deletion protection on' : 'Deletion protection off' })} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div><Label htmlFor="prot-pitr">Point-in-time recovery</Label><p className="mt-0.5 text-xs text-muted-foreground">{pitr.isError ? 'Not available on this endpoint.' : 'Continuous backups — restore to any second in the last 35 days.'}</p></div>
          <Switch id="prot-pitr" checked={pitrOn} disabled={pitr.isPending || pitr.isError || pitrM.isPending} onCheckedChange={(v) => pitrM.mutate(v)} />
        </div>
        {(m.isError || pitrM.isError) && <ErrorAlert error={m.error || pitrM.error} />}
      </div>
    </Card>
  )
}

function BackupsCard({ table: t }: { table: DdbTable }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [restoreFrom, setRestoreFrom] = useState<{ arn: string; name: string } | null>(null)
  const [restoreName, setRestoreName] = useState('')
  const [confirm, setConfirm] = useState<{ arn: string; name: string } | null>(null)
  const q = useQuery({
    queryKey: ['ddb-backups', t.Name, activeProfileId],
    queryFn: () => runQuery<{ BackupSummaries?: { BackupArn: string; BackupName: string; BackupStatus: string; BackupCreationDateTime: string; BackupSizeBytes?: number }[] }>('dynamodb', 'list_backups', { TableName: t.Name }),
    retry: false,
    meta: { silent: true },
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ddb-backups', t.Name] })
  const create = useMutation({
    mutationFn: () => runQuery('dynamodb', 'create_backup', { TableName: t.Name, BackupName: `${t.Name}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}` }),
    onSuccess: () => { invalidate(); toast.success('Backup created') },
  })
  const remove = useMutation({
    mutationFn: (arn: string) => runQuery('dynamodb', 'delete_backup', { BackupArn: arn }),
    onSuccess: () => { invalidate(); toast.success('Backup deleted') },
    onSettled: () => setConfirm(null),
  })
  const restore = useMutation({
    mutationFn: () => runQuery('dynamodb', 'restore_table_from_backup', { TargetTableName: restoreName.trim(), BackupArn: restoreFrom!.arn }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ddb-tables'] })
      toast.success(`Restoring into “${restoreName.trim()}”`)
      setRestoreFrom(null)
    },
  })
  const list = (q.data?.BackupSummaries ?? []).sort((a, b) => (b.BackupCreationDateTime ?? '').localeCompare(a.BackupCreationDateTime ?? ''))
  return (
    <Card title={<span className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" />Backups</span>} actions={<Button size="xs" variant="outline" disabled={create.isPending || q.isError || t.Status !== 'ACTIVE'} onClick={() => create.mutate()}><Plus />{create.isPending ? 'Creating…' : 'Create backup'}</Button>}>
      {q.isPending ? <Skeleton className="h-12 w-full" /> : q.isError ? <p className="text-sm text-muted-foreground">On-demand backups are not available on this endpoint. ({errorMessage(q.error)})</p> : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No on-demand backups yet.</p>
      ) : (
        <ul className="divide-y">
          {list.map((b) => (
            <li key={b.BackupArn} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium"><span className="truncate font-mono text-xs">{b.BackupName}</span><TableStatusBadge status={b.BackupStatus === 'AVAILABLE' ? 'ACTIVE' : b.BackupStatus} /></div>
                <div className="text-[11px] text-muted-foreground">{timeAgo(b.BackupCreationDateTime)}{b.BackupSizeBytes != null ? ` · ${formatBytes(b.BackupSizeBytes)}` : ''}</div>
              </div>
              <Button variant="outline" size="xs" disabled={b.BackupStatus !== 'AVAILABLE'} onClick={() => { setRestoreFrom({ arn: b.BackupArn, name: b.BackupName }); setRestoreName(`${t.Name}-restored`) }}>Restore</Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete backup" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirm({ arn: b.BackupArn, name: b.BackupName })}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      {(create.isError || remove.isError) && <div className="mt-2"><ErrorAlert error={create.error || remove.error} /></div>}
      <Dialog open={restoreFrom != null} onOpenChange={(o) => !o && setRestoreFrom(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Restore backup</DialogTitle><DialogDescription>Creates a new table from <span className="font-mono">{restoreFrom?.name}</span>. The current table is not changed.</DialogDescription></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (restoreName.trim()) restore.mutate() }} className="flex flex-col gap-2">
            <Label htmlFor="restore-table">New table name</Label>
            <Input id="restore-table" value={restoreName} onChange={(e) => setRestoreName(e.target.value)} autoFocus />
            {restore.isError && <ErrorAlert error={restore.error} />}
            <DialogFooter className="mt-2"><Button type="button" variant="ghost" onClick={() => setRestoreFrom(null)}>Cancel</Button><Button type="submit" disabled={!restoreName.trim() || restore.isPending}>{restore.isPending ? 'Restoring…' : 'Restore'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirm != null} title={`Delete backup “${confirm?.name}”?`} description="This cannot be undone." confirmLabel="Delete backup" pending={remove.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm && remove.mutate(confirm.arn)} />
    </Card>
  )
}

function TagsCard({ table: t }: { table: DdbTable }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const q = useQuery({
    queryKey: ['ddb-tags', t.Arn, activeProfileId],
    queryFn: () => runQuery<{ Tags?: { Key: string; Value: string }[] }>('dynamodb', 'list_tags_of_resource', { ResourceArn: t.Arn }),
    enabled: !!t.Arn,
    retry: false,
  })
  const tags = (q.data?.Tags ?? []).filter((x) => x.Key !== 'Name')
  const add = useMutation({
    mutationFn: () => runQuery('dynamodb', 'tag_resource', { ResourceArn: t.Arn, Tags: [{ Key: key.trim(), Value: value.trim() }] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ddb-tags', t.Arn] }); toast.success(`Label “${key.trim()}” added`); setKey(''); setValue('') },
  })
  const remove = useMutation({
    mutationFn: (k: string) => runQuery('dynamodb', 'untag_resource', { ResourceArn: t.Arn, TagKeys: [k] }),
    onSuccess: (_r, k) => { qc.invalidateQueries({ queryKey: ['ddb-tags', t.Arn] }); toast.success(`Label “${k}” removed`) },
  })
  return (
    <Card title="Labels">
      <div className="flex flex-col gap-3">
        {q.isPending ? <Skeleton className="h-6 w-40" /> : tags.length === 0 ? <p className="text-sm text-muted-foreground">No labels on this table yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {tags.map((x) => (
              <Badge key={x.Key} variant="secondary" className="h-auto gap-1.5 rounded-md py-1 font-normal">
                <span><span className="text-muted-foreground">{x.Key}</span> = {x.Value}</span>
                <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(x.Key)} className="text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label={`Remove label ${x.Key}`}><X className="size-3" /></button>
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

/* ---------------- shared bits ---------------- */

function Detail({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-all text-right', mono ? 'font-mono text-xs' : 'font-medium')}>{value}</dd>
    </div>
  )
}

function CopyText({ text }: { text: string }) {
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
      <span className="break-all">{text || '—'}</span>
      {text && <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy" className="size-5 shrink-0 text-muted-foreground hover:text-primary">{copied ? <Check className="text-green-500" /> : <Copy />}</Button>}
    </span>
  )
}
