import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Plus, RefreshCw, Search, Trash2, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { CodenameInput } from '../components/CodenameInput'
import { generateCodename } from '../lib/codename'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { RoleInput } from '../components/RoleInput'
import { timeAgo } from '../lib/ec2'
import { RUNTIMES, flattenFunctions, runtimeLabel, validateFunctionName, zipSourceBase64, type FunctionRow } from '../lib/lambda'
import { bytesParam, fileToBase64, formatBytes } from '../lib/s3'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const PAGE_SIZE = 30

export function FunctionsPage() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [runtime, setRuntime] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteName, setDeleteName] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const needsProfile = mode === 'register' && activeProfileId == null

  const query = useQuery({
    queryKey: ['lambda-functions', region, activeProfileId],
    queryFn: async () => {
      const all: any[] = []
      let marker: string | undefined
      do {
        const page = await runQuery<any>('lambda', 'list_functions', { MaxItems: 200, ...(marker ? { Marker: marker } : {}) })
        all.push(...(page.Functions ?? []))
        marker = page.NextMarker || undefined
      } while (marker)
      return flattenFunctions({ Functions: all })
    },
    enabled: !needsProfile,
  })
  const rows = useMemo(() => query.data ?? [], [query.data])
  const runtimes = useMemo(() => [...new Set(rows.map((r) => r.Runtime).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => (runtime === 'all' || r.Runtime === runtime) && (!q || r.FunctionName.toLowerCase().includes(q)))
  }, [rows, search, runtime])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => setPage(1), [search, runtime, region])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lambda-functions'] })

  const remove = useMutation({
    mutationFn: (name: string) => runQuery('lambda', 'delete_function', { FunctionName: name }),
    onSuccess: (_r, name) => {
      invalidate()
      toast.success(`Function “${name}” deleted`)
    },
    onSettled: () => setDeleteName(null),
  })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-5 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Zap aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your functions</h1>
            <p className="mt-1 text-sm text-muted-foreground">Serverless code running in {region}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" aria-label="Search functions by name" className="pl-8 sm:w-64" />
          </div>
          {runtimes.length > 1 && (
            <Select value={runtime} onValueChange={setRuntime}>
              <SelectTrigger aria-label="Filter by runtime" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All runtimes ({rows.length})</SelectItem>
                {runtimes.map((r) => (
                  <SelectItem key={r} value={r}>
                    {runtimeLabel(r)} ({rows.filter((x) => x.Runtime === r).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={invalidate} disabled={query.isFetching} aria-label="Refresh">
                <RefreshCw className={cn(query.isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            New function
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 flex-1', createOpen && 'lg:w-[60%]')}>
          {needsProfile ? (
            <Card title="Functions">
              <p className="text-sm text-warning">Select an AWS profile from the account menu to view your functions.</p>
            </Card>
          ) : query.isError ? (
            <ErrorAlert error={query.error} />
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium">{rows.length ? 'No functions match your filters' : 'No functions yet'}</p>
                <p className="text-xs text-muted-foreground">{rows.length ? 'Try a different runtime or search term.' : 'Create your first function — a starter template is included.'}</p>
              </div>
              {!rows.length && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  New function
                </Button>
              )}
            </div>
          ) : (
            <UiCard className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 text-xs uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Runtime</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Memory</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Timeout</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Code</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Updated</TableHead>
                      <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((f) => (
                      <FunctionRowView
                        key={f.FunctionArn || f.FunctionName}
                        fn={f}
                        busy={remove.isPending && remove.variables === f.FunctionName}
                        onOpen={() => navigate(`/${profile}/functions/${encodeURIComponent(f.FunctionName)}`)}
                        onDelete={() => setDeleteName(f.FunctionName)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
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
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[40%]">
            <CreateFunctionPanel
              onClose={() => setCreateOpen(false)}
              onCreated={(name) => {
                invalidate()
                setCreateOpen(false)
                navigate(`/${profile}/functions/${encodeURIComponent(name)}`)
              }}
            />
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={deleteName != null}
        title={`Delete function “${deleteName}”?`}
        description="The function, its code and configuration are removed permanently."
        confirmLabel="Delete function"
        pending={remove.isPending}
        onCancel={() => setDeleteName(null)}
        onConfirm={() => deleteName && remove.mutate(deleteName)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function StateBadgeLambda({ state }: { state: string }) {
  const tone =
    state === 'Active' ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300'
    : state === 'Failed' ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
  return <Badge variant="secondary" className={cn('border-transparent', tone)}>{state || 'Unknown'}</Badge>
}

function FunctionRowView({ fn, busy, onOpen, onDelete }: { fn: FunctionRow; busy: boolean; onOpen: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  async function copyArn(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(fn.FunctionArn)
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
          <div>
            <div className="font-medium">{fn.FunctionName}</div>
            {fn.Description && <div className="max-w-xs truncate text-xs text-muted-foreground">{fn.Description}</div>}
          </div>
          <Button variant="ghost" size="icon-xs" onClick={copyArn} aria-label="Copy function ARN" className="size-5 text-muted-foreground hover:text-primary">
            {copied ? <Check className="text-green-500" /> : <Copy />}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {runtimeLabel(fn.Runtime)}
          {fn.State !== 'Active' && <StateBadgeLambda state={fn.State} />}
        </div>
      </TableCell>
      <TableCell>{fn.MemorySize} MB</TableCell>
      <TableCell>{fn.Timeout}s</TableCell>
      <TableCell>{formatBytes(fn.CodeSize)}</TableCell>
      <TableCell>{timeAgo(fn.LastModified)}</TableCell>
      <TableCell className="px-4">
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="xs" onClick={(e) => { stop(e); onOpen() }}>Open</Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={busy} onClick={(e) => { stop(e); onDelete() }} aria-label="Delete function" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40">
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  )
}

/* ------------------------------------------------------------------ */

function CreateFunctionPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState(generateCodename)
  const [runtimeId, setRuntimeId] = useState(RUNTIMES[0].id)
  const runtime = RUNTIMES.find((r) => r.id === runtimeId)!
  const [code, setCode] = useState(runtime.inline?.template ?? '')
  const [handler, setHandler] = useState(runtime.inline?.handler ?? '')
  const [zip, setZip] = useState<File | null>(null)
  const [role, setRole] = useState('')
  const [memory, setMemory] = useState('128')
  const [timeout, setTimeoutS] = useState('10')
  const [description, setDescription] = useState('')
  const problem = validateFunctionName(name.trim())

  function pickRuntime(id: string) {
    const next = RUNTIMES.find((r) => r.id === id)!
    setRuntimeId(id)
    if (next.inline) {
      setCode(next.inline.template)
      setHandler(next.inline.handler)
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const zipBase64 = runtime.inline && !zip ? zipSourceBase64(runtime.inline.file, code) : zip ? await fileToBase64(zip) : ''
      if (!zipBase64) throw new Error('Provide inline code or upload a deployment package.')
      const fn = name.trim()
      await runQuery('lambda', 'create_function', {
        FunctionName: fn,
        Runtime: runtimeId,
        Role: role.trim(),
        Handler: handler.trim(),
        Code: { ZipFile: bytesParam(zipBase64) },
        MemorySize: Number(memory),
        Timeout: Number(timeout),
        ...(description.trim() ? { Description: description.trim() } : {}),
        PackageType: 'Zip',
      })
      return fn
    },
    onSuccess: (fn) => {
      toast.success(`Function “${fn}” created`)
      onCreated(fn)
    },
  })

  return (
    <UiCard className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-4 w-[3px] rounded-full bg-primary" />
          Create a new function
        </CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-muted-foreground"><X /></Button>
      </CardHeader>
      <CardContent className="p-4">
        {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
        <form onSubmit={(e) => { e.preventDefault(); if (!problem) create.mutate() }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fn-name">Function name <span className="text-destructive">*</span></Label>
            <CodenameInput id="fn-name" value={name} required onChange={setName} />
            {name && problem && <span className="text-xs text-destructive">{problem}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fn-runtime">Runtime</Label>
            <Select value={runtimeId} onValueChange={pickRuntime}>
              <SelectTrigger id="fn-runtime" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RUNTIMES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {runtime.inline && !zip && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fn-code">Code <span className="font-normal text-muted-foreground">({runtime.inline.file})</span></Label>
              <Textarea id="fn-code" value={code} onChange={(e) => setCode(e.target.value)} rows={12} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fn-zip">{runtime.inline ? 'Or upload a deployment package (.zip)' : 'Deployment package (.zip) *'}</Label>
            <Input id="fn-zip" type="file" accept=".zip,.jar" onChange={(e) => setZip(e.target.files?.[0] ?? null)} required={!runtime.inline} />
            {zip && <span className="text-xs text-muted-foreground">{zip.name} ({formatBytes(zip.size)}) — inline code will be ignored.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fn-handler">Handler <span className="text-destructive">*</span></Label>
            <Input id="fn-handler" value={handler} onChange={(e) => setHandler(e.target.value)} required placeholder="index.handler" className="font-mono text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fn-role">Execution role <span className="text-destructive">*</span></Label>
            <RoleInput id="fn-role" value={role} onChange={setRole} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fn-memory">Memory (MB)</Label>
              <Input id="fn-memory" type="number" min={128} max={10240} step={64} value={memory} onChange={(e) => setMemory(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fn-timeout">Timeout (s)</Label>
              <Input id="fn-timeout" type="number" min={1} max={900} value={timeout} onChange={(e) => setTimeoutS(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fn-desc">Description</Label>
            <Input id="fn-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <Button type="submit" disabled={!!problem || !role.trim() || !handler.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create function'}
          </Button>
        </form>
      </CardContent>
    </UiCard>
  )
}
