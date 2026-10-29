import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unzipSync } from 'fflate'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Globe,
  Play,
  Plus,
  GitBranch,
  Link2,
  Gauge,
  RefreshCw,
  ScrollText,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchLambdaPackage, runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MetricsCard } from '../components/MetricsCard'
import { RoleInput } from '../components/RoleInput'
import { ErrorAlert } from '../components/ErrorAlert'
import { timeAgo } from '../lib/ec2'
import { errorMessage } from '../lib/errors'
import { RUNTIMES, decodeBase64, prettyJson, runtimeLabel, toRow, zipSourceBase64, type FunctionRow } from '../lib/lambda'
import { bytesParam, fileToBase64, formatBytes } from '../lib/s3'
import { toastError } from '../lib/toast'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { StateBadgeLambda } from './FunctionsPage'

function useFunctionMutation(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ op, params }: { op: string; params: Record<string, unknown>; success?: string }) =>
      runQuery('lambda', op, params),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['lambda-function', name] })
      qc.invalidateQueries({ queryKey: ['lambda-functions'] })
      if (v.success) toast.success(v.success)
    },
  })
}

export function FunctionPage() {
  const { profile, name = '' } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/functions`

  const query = useQuery({
    queryKey: ['lambda-function', name, region, activeProfileId],
    queryFn: () => runQuery<{ Configuration: any; Code?: { Location?: string } }>('lambda', 'get_function', { FunctionName: name }),
    enabled: !needsProfile && !!name,
    // Poll while AWS is still creating/updating the function so the state badge flips on its own.
    refetchInterval: (q) => (q.state.data?.Configuration?.State === 'Pending' ? 3000 : false),
  })
  const fn: FunctionRow | undefined = query.data ? toRow(query.data.Configuration) : undefined
  const codeLocation = query.data?.Code?.Location

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lambda-function', name] })
    queryClient.invalidateQueries({ queryKey: ['lambda-logs', name] })
    queryClient.invalidateQueries({ queryKey: ['lambda-url', name] })
    queryClient.invalidateQueries({ queryKey: ['lambda-tags'] })
  }

  const remove = useMutation({
    mutationFn: () => runQuery('lambda', 'delete_function', { FunctionName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lambda-functions'] })
      toast.success(`Function “${name}” deleted`)
      navigate(backTo)
    },
    onSettled: () => setConfirmDelete(false),
  })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary">
        <ArrowLeft />
        Back to functions
      </Button>

      {needsProfile ? (
        <Card title="Function"><p className="text-sm text-warning">Select an AWS profile from the account menu to view this function.</p></Card>
      ) : query.isError ? (
        <ErrorAlert error={query.error} />
      ) : query.isLoading || !fn ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Zap aria-hidden="true" className="h-6 w-6" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-semibold">{fn.FunctionName}</h1>
                  <StateBadgeLambda state={fn.State} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {runtimeLabel(fn.Runtime)} <span className="px-1 opacity-50">/</span> {fn.MemorySize} MB <span className="px-1 opacity-50">/</span> {fn.Timeout}s timeout <span className="px-1 opacity-50">/</span> updated {timeAgo(fn.LastModified)}
                </p>
                {fn.State !== 'Active' && fn.StateReason && (
                  <p className="mt-1 text-xs text-destructive">{fn.StateReason}</p>
                )}
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 border-t pt-4 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={refresh} disabled={query.isFetching} aria-label="Refresh"><RefreshCw className={cn(query.isFetching && 'animate-spin')} /></Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Button variant="outline" onClick={() => document.getElementById('invoke-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                <Play />
                Test
              </Button>
              <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>

          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y">
                <Detail label="ARN" value={<CopyText text={fn.FunctionArn} />} mono />
                <Detail label="Handler" value={fn.Handler || '—'} mono />
                <Detail label="Execution role" value={fn.Role.split('/').pop() || '—'} />
                <Detail label="Version" value={fn.Version} />
                <Detail label="Package size" value={formatBytes(fn.CodeSize)} />
                <Detail label="Last modified" value={fn.LastModified ? new Date(fn.LastModified).toLocaleString() : '—'} />
                <Detail label="Description" value={fn.Description || '—'} />
              </dl>
            </Card>
            <InvokeCard name={name} />
            <ConfigCard fn={fn} />
            <EnvCard fn={fn} />
            <CodeCard fn={fn} location={codeLocation} />
            <UrlCard name={name} />
            <ConcurrencyCard name={name} />
            <VersionsCard fn={fn} />
            <TriggersCard fn={fn} />
            <TagsCard fn={fn} />
            <Card title="Danger zone">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Delete function</div>
                  <div className="text-xs text-muted-foreground">Removes the code, configuration and any function URL.</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
              </div>
            </Card>
          </div>

          <MetricsCard
            description="Invocation counts and average duration from CloudWatch."
            metrics={[
              { label: 'Invocations', namespace: 'AWS/Lambda', metricName: 'Invocations', dimensions: [{ Name: 'FunctionName', Value: name }], stat: 'Sum' },
              { label: 'Errors', namespace: 'AWS/Lambda', metricName: 'Errors', dimensions: [{ Name: 'FunctionName', Value: name }], stat: 'Sum' },
              { label: 'Avg duration', namespace: 'AWS/Lambda', metricName: 'Duration', dimensions: [{ Name: 'FunctionName', Value: name }], stat: 'Average', format: (v) => `${Math.round(v)} ms` },
              { label: 'Throttles', namespace: 'AWS/Lambda', metricName: 'Throttles', dimensions: [{ Name: 'FunctionName', Value: name }], stat: 'Sum' },
              { label: 'Concurrent executions', namespace: 'AWS/Lambda', metricName: 'ConcurrentExecutions', dimensions: [{ Name: 'FunctionName', Value: name }], stat: 'Maximum' },
            ]}
          />
          <LogsCard name={name} />

          <ConfirmDialog
            open={confirmDelete}
            title={`Delete function “${name}”?`}
            description="This cannot be undone."
            confirmLabel="Delete function"
            pending={remove.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => remove.mutate()}
          />
        </>
      )}
    </div>
  )
}

/* ---------------- Invoke ---------------- */

interface InvokeResult { status: number; error?: string; payload: string; logs: string; ms: number }

function InvokeCard({ name }: { name: string }) {
  const [payload, setPayload] = useState('{\n  "name": "world"\n}')
  const [result, setResult] = useState<InvokeResult | null>(null)
  let parseError: string | null = null
  try {
    JSON.parse(payload)
  } catch (e) {
    parseError = (e as Error).message
  }

  const invoke = useMutation({
    mutationFn: async () => {
      const started = performance.now()
      const r = await runQuery<{ StatusCode: number; FunctionError?: string; Payload?: string; LogResult?: string }>('lambda', 'invoke', {
        FunctionName: name,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: bytesParam(btoa(unescape(encodeURIComponent(payload)))),
      })
      return {
        status: r.StatusCode,
        error: r.FunctionError,
        payload: prettyJson(r.Payload ?? ''),
        logs: r.LogResult ? decodeBase64(r.LogResult) : '',
        ms: Math.round(performance.now() - started),
      } satisfies InvokeResult
    },
    onSuccess: (r) => {
      setResult(r)
      if (r.error) toastError(`Function returned an error (${r.error})`)
      else toast.success(`Invoked ${name} in ${r.ms} ms`)
    },
  })

  return (
    <div id="invoke-card">
      <Card title={<span className="flex items-center gap-2"><Play className="h-4 w-4 text-primary" />Test</span>}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoke-payload">Event payload (JSON)</Label>
            <Textarea id="invoke-payload" value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} spellCheck={false} className="font-mono text-xs" />
            {parseError && <span className="text-xs text-destructive">Invalid JSON: {parseError}</span>}
          </div>
          <div>
            <Button onClick={() => invoke.mutate()} disabled={!!parseError || invoke.isPending}>
              <Play />
              {invoke.isPending ? 'Running…' : 'Invoke'}
            </Button>
          </div>
          {invoke.isError && <ErrorAlert error={invoke.error} />}
          {result && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className={cn('border-transparent', result.error ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300')}>
                  {result.error ? `Error: ${result.error}` : `Success · HTTP ${result.status}`}
                </Badge>
                <span className="text-muted-foreground">{result.ms} ms round-trip</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Response</div>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-xs leading-relaxed">{result.payload || '(empty)'}</pre>
              {result.logs && (
                <>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Logs</div>
                  <pre className="max-h-64 overflow-auto rounded-md bg-gray-950 p-2 font-mono text-[11px] leading-relaxed text-gray-200">{result.logs}</pre>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Configuration ---------------- */

function ConfigCard({ fn }: { fn: FunctionRow }) {
  const [memory, setMemory] = useState(String(fn.MemorySize))
  const [timeout, setTimeoutS] = useState(String(fn.Timeout))
  const [handler, setHandler] = useState(fn.Handler)
  const [description, setDescription] = useState(fn.Description)
  const [role, setRole] = useState(fn.Role)
  useEffect(() => {
    setMemory(String(fn.MemorySize))
    setTimeoutS(String(fn.Timeout))
    setHandler(fn.Handler)
    setDescription(fn.Description)
    setRole(fn.Role)
  }, [fn.MemorySize, fn.Timeout, fn.Handler, fn.Description, fn.Role])
  const m = useFunctionMutation(fn.FunctionName)
  const changed = Number(memory) !== fn.MemorySize || Number(timeout) !== fn.Timeout || handler !== fn.Handler || description !== fn.Description || role.trim() !== fn.Role

  return (
    <Card title="Configuration">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate({
            op: 'update_function_configuration',
            params: { FunctionName: fn.FunctionName, MemorySize: Number(memory), Timeout: Number(timeout), Handler: handler.trim(), Description: description.trim(), ...(role.trim() !== fn.Role ? { Role: role.trim() } : {}) },
            success: 'Configuration updated',
          })
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-memory">Memory (MB)</Label>
            <Input id="cfg-memory" type="number" min={128} max={10240} step={64} value={memory} onChange={(e) => setMemory(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-timeout">Timeout (seconds)</Label>
            <Input id="cfg-timeout" type="number" min={1} max={900} value={timeout} onChange={(e) => setTimeoutS(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-handler">Handler</Label>
          <Input id="cfg-handler" value={handler} onChange={(e) => setHandler(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-desc">Description</Label>
          <Input id="cfg-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-role">Execution role</Label>
          <RoleInput id="cfg-role" value={role} onChange={setRole} />
        </div>
        <div><Button type="submit" disabled={!changed || m.isPending}>{m.isPending ? 'Saving…' : 'Save changes'}</Button></div>
        {m.isError && <ErrorAlert error={m.error} />}
      </form>
    </Card>
  )
}

/* ---------------- Environment variables ---------------- */

function EnvCard({ fn }: { fn: FunctionRow }) {
  const current = fn.Environment?.Variables ?? {}
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => Object.entries(current).map(([k, v]) => ({ k, v })))
  useEffect(() => setRows(Object.entries(fn.Environment?.Variables ?? {}).map(([k, v]) => ({ k, v }))), [fn.Environment])
  const m = useFunctionMutation(fn.FunctionName)
  const next = Object.fromEntries(rows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]))
  const changed = JSON.stringify(next) !== JSON.stringify(current)

  return (
    <Card title="Environment variables">
      <div className="flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No environment variables.</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={r.k} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} placeholder="KEY" aria-label="Variable name" className="w-40 font-mono text-xs" />
            <Input value={r.v} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="value" aria-label="Variable value" className="flex-1 font-mono text-xs" />
            <Button variant="ghost" size="icon-sm" onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))} aria-label="Remove variable" className="text-muted-foreground hover:text-destructive"><X /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setRows((cur) => [...cur, { k: '', v: '' }])}><Plus />Add variable</Button>
          <Button size="sm" disabled={!changed || m.isPending} onClick={() => m.mutate({ op: 'update_function_configuration', params: { FunctionName: fn.FunctionName, Environment: { Variables: next } }, success: 'Environment variables saved' })}>
            {m.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

/* ---------------- Code ---------------- */

function CodeCard({ fn, location }: { fn: FunctionRow; location?: string }) {
  const runtime = RUNTIMES.find((r) => r.id === fn.Runtime)
  const [code, setCode] = useState('')
  const [loaded, setLoaded] = useState<'idle' | 'ok' | 'unavailable'>('idle')
  const [zip, setZip] = useState<File | null>(null)
  const m = useFunctionMutation(fn.FunctionName)

  // Load the current package (via the backend) and show the inline source file in the editor.
  useEffect(() => {
    let cancelled = false
    setLoaded('idle')
    if (!location || !runtime?.inline) {
      setLoaded('unavailable')
      return
    }
    fetchLambdaPackage(fn.FunctionName)
      .then(({ zipBase64 }) => {
        const bytes = Uint8Array.from(atob(zipBase64), (c) => c.charCodeAt(0))
        const files = unzipSync(bytes)
        const file = files[runtime.inline!.file]
        if (cancelled) return
        if (file) {
          setCode(new TextDecoder().decode(file))
          setLoaded('ok')
        } else setLoaded('unavailable')
      })
      .catch(() => !cancelled && setLoaded('unavailable'))
    return () => {
      cancelled = true
    }
  }, [location, fn.FunctionName, fn.LastModified, runtime])

  async function deploy() {
    const zipBase64 = zip ? await fileToBase64(zip) : runtime?.inline ? zipSourceBase64(runtime.inline.file, code) : ''
    if (!zipBase64) return
    m.mutate(
      { op: 'update_function_code', params: { FunctionName: fn.FunctionName, ZipFile: bytesParam(zipBase64) }, success: 'Code deployed' },
      { onSuccess: () => setZip(null) },
    )
  }

  return (
    <Card
      title="Code"
      actions={location && (
        <Button variant="ghost" size="xs" asChild>
          <a href={location} target="_blank" rel="noreferrer"><Download />Download package</a>
        </Button>
      )}
    >
      <div className="flex flex-col gap-3">
        {runtime?.inline && !zip && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code-editor">{runtime.inline.file}</Label>
            <Textarea id="code-editor" value={code} onChange={(e) => setCode(e.target.value)} rows={14} spellCheck={false} wrap="off" placeholder={loaded === 'unavailable' ? `Could not load the current source — paste the contents of ${runtime.inline.file} here to replace it.` : 'Loading…'} className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" />
            {loaded === 'unavailable' && <span className="text-xs text-muted-foreground">The existing package couldn't be read in the browser. Deploying replaces the whole package with this single file.</span>}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code-zip">{runtime?.inline ? 'Or upload a new deployment package (.zip)' : 'Upload a new deployment package (.zip)'}</Label>
          <Input id="code-zip" type="file" accept=".zip,.jar" onChange={(e) => setZip(e.target.files?.[0] ?? null)} />
          {zip && <span className="text-xs text-muted-foreground">{zip.name} ({formatBytes(zip.size)})</span>}
        </div>
        <div><Button onClick={deploy} disabled={m.isPending || (!zip && (!runtime?.inline || !code.trim()))}>{m.isPending ? 'Deploying…' : 'Deploy'}</Button></div>
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

/* ---------------- Function URL ---------------- */

function UrlCard({ name }: { name: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const q = useQuery({
    queryKey: ['lambda-url', name, activeProfileId],
    queryFn: async () => {
      try {
        return await runQuery<{ FunctionUrl: string; AuthType: string }>('lambda', 'get_function_url_config', { FunctionName: name })
      } catch (err) {
        if (errorMessage(err).includes('ResourceNotFound')) return null
        throw err
      }
    },
    retry: false,
  })
  const m = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        await runQuery('lambda', 'create_function_url_config', { FunctionName: name, AuthType: 'NONE' })
        // Real AWS also needs a resource policy that allows anonymous invokes of the URL.
        try {
          await runQuery('lambda', 'add_permission', {
            FunctionName: name,
            StatementId: 'openconsole-public-url',
            Action: 'lambda:InvokeFunctionUrl',
            Principal: '*',
            FunctionUrlAuthType: 'NONE',
          })
        } catch (err) {
          if (!errorMessage(err).includes('ResourceConflict')) throw err
        }
      } else {
        await runQuery('lambda', 'delete_function_url_config', { FunctionName: name })
        try {
          await runQuery('lambda', 'remove_permission', { FunctionName: name, StatementId: 'openconsole-public-url' })
        } catch {
          /* permission may not exist */
        }
      }
    },
    onSuccess: (_r, enable) => {
      qc.invalidateQueries({ queryKey: ['lambda-url', name] })
      toast.success(enable ? 'Public function URL enabled' : 'Function URL removed')
    },
  })
  return (
    <Card title={<span className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Function URL</span>}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="url-switch">Public HTTPS endpoint</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Anyone with the link can call this function (no authentication).</p>
        </div>
        <Switch id="url-switch" checked={!!q.data} disabled={q.isPending || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
      </div>
      {q.data && (
        <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
          <a href={q.data.FunctionUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline">{q.data.FunctionUrl}</a>
          <CopyText text={q.data.FunctionUrl} iconOnly />
        </div>
      )}
      {q.isError && <div className="mt-3"><ErrorAlert error={q.error} /></div>}
    </Card>
  )
}

/* ---------------- Logs ---------------- */

function LogsCard({ name }: { name: string }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const group = `/aws/lambda/${name}`
  const q = useQuery({
    queryKey: ['lambda-logs', name, region, activeProfileId],
    queryFn: async () => {
      try {
        const streams = await runQuery<{ logStreams?: { logStreamName: string }[] }>('logs', 'describe_log_streams', { logGroupName: group, orderBy: 'LastEventTime', descending: true, limit: 1 })
        const stream = streams.logStreams?.[0]?.logStreamName
        if (!stream) return { stream: null, events: [] as { timestamp: number; message: string }[] }
        const r = await runQuery<{ events?: { timestamp: number; message: string }[] }>('logs', 'get_log_events', { logGroupName: group, logStreamName: stream, limit: 100, startFromHead: false })
        return { stream, events: r.events ?? [] }
      } catch (err) {
        if (errorMessage(err).includes('ResourceNotFound')) return { stream: null, events: [] }
        throw err
      }
    },
    retry: false,
  })
  return (
    <Card
      title={<span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" />Recent logs</span>}
      actions={
        <div className="flex items-center gap-2">
          {q.data?.stream && <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{q.data.stream}</span>}
          <Button variant="ghost" size="xs" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw className={cn(q.isFetching && 'animate-spin')} />Refresh</Button>
        </div>
      }
    >
      {q.isError ? (
        <ErrorAlert error={q.error} />
      ) : q.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : q.data.events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No logs yet — invoke the function to see output here. (Log group {group})</p>
      ) : (
        <pre className="max-h-96 overflow-auto rounded-md bg-gray-950 p-3 font-mono text-[11px] leading-relaxed text-gray-200">
          {q.data.events.map((e, i) => `${new Date(e.timestamp).toLocaleTimeString()}  ${e.message.replace(/\n+$/, '')}${i < q.data.events.length - 1 ? '\n' : ''}`).join('')}
        </pre>
      )}
    </Card>
  )
}

/* ---------------- Tags ---------------- */

function TagsCard({ fn }: { fn: FunctionRow }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const q = useQuery({
    queryKey: ['lambda-tags', fn.FunctionArn, activeProfileId],
    queryFn: () => runQuery<{ Tags?: Record<string, string> }>('lambda', 'list_tags', { Resource: fn.FunctionArn }),
    retry: false,
  })
  const tags = Object.entries(q.data?.Tags ?? {})
  const add = useMutation({
    mutationFn: () => runQuery('lambda', 'tag_resource', { Resource: fn.FunctionArn, Tags: { [key.trim()]: value.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lambda-tags', fn.FunctionArn] })
      toast.success(`Label “${key.trim()}” added`)
      setKey('')
      setValue('')
    },
  })
  const remove = useMutation({
    mutationFn: (k: string) => runQuery('lambda', 'untag_resource', { Resource: fn.FunctionArn, TagKeys: [k] }),
    onSuccess: (_r, k) => {
      qc.invalidateQueries({ queryKey: ['lambda-tags', fn.FunctionArn] })
      toast.success(`Label “${k}” removed`)
    },
  })
  return (
    <Card title="Labels">
      <div className="flex flex-col gap-3">
        {q.isPending ? <Skeleton className="h-6 w-40" /> : tags.length === 0 ? <p className="text-sm text-muted-foreground">No labels on this function yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {tags.map(([k, v]) => (
              <Badge key={k} variant="secondary" className="h-auto gap-1.5 rounded-md py-1 font-normal">
                <span><span className="text-muted-foreground">{k}</span> = {v}</span>
                <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(k)} className="text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label={`Remove label ${k}`}><X className="size-3" /></button>
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

/* ---------------- Concurrency ---------------- */

function ConcurrencyCard({ name }: { name: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const q = useQuery({
    queryKey: ['lambda-concurrency', name, activeProfileId],
    queryFn: () => runQuery<{ ReservedConcurrentExecutions?: number }>('lambda', 'get_function_concurrency', { FunctionName: name }),
    retry: false,
  })
  const reserved = q.data?.ReservedConcurrentExecutions
  const [value, setValue] = useState('')
  useEffect(() => setValue(reserved == null ? '' : String(reserved)), [reserved])
  const m = useMutation({
    mutationFn: (next: number | null) =>
      next == null
        ? runQuery('lambda', 'delete_function_concurrency', { FunctionName: name })
        : runQuery('lambda', 'put_function_concurrency', { FunctionName: name, ReservedConcurrentExecutions: next }),
    onSuccess: (_r, next) => {
      qc.invalidateQueries({ queryKey: ['lambda-concurrency', name] })
      toast.success(next == null ? 'Reserved concurrency removed' : `Reserved concurrency set to ${next}`)
    },
  })
  const changed = (value.trim() === '' ? null : Number(value)) !== (reserved ?? null)
  return (
    <Card title={<span className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />Concurrency</span>}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="concurrency">Reserved concurrent executions</Label>
        <div className="flex items-center gap-2">
          <Input id="concurrency" type="number" min={0} max={1000} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Unreserved (account pool)" className="w-48" />
          <Button size="sm" disabled={!changed || m.isPending || q.isPending} onClick={() => m.mutate(value.trim() === '' ? null : Number(value))}>{m.isPending ? 'Saving…' : 'Save'}</Button>
          {reserved != null && <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate(null)}>Remove</Button>}
        </div>
        <p className="text-xs text-muted-foreground">
          {reserved == null ? 'Uses the shared account pool. Set a number to guarantee capacity (0 pauses the function).' : reserved === 0 ? 'Set to 0 — the function is throttled and will not run.' : `Up to ${reserved} instances run at once; extra invocations are throttled.`}
        </p>
        {q.isError && <ErrorAlert error={q.error} />}
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

/* ---------------- Versions & aliases ---------------- */

function VersionsCard({ fn }: { fn: FunctionRow }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const name = fn.FunctionName
  const [aliasOpen, setAliasOpen] = useState(false)
  const [aliasName, setAliasName] = useState('')
  const [aliasVersion, setAliasVersion] = useState('')
  const [confirmAlias, setConfirmAlias] = useState<string | null>(null)
  const versions = useQuery({
    queryKey: ['lambda-versions', name, activeProfileId],
    queryFn: () => runQuery<{ Versions?: { Version: string; Description?: string; LastModified?: string; CodeSize?: number }[] }>('lambda', 'list_versions_by_function', { FunctionName: name, MaxItems: 50 }),
    retry: false,
  })
  const aliases = useQuery({
    queryKey: ['lambda-aliases', name, activeProfileId],
    queryFn: () => runQuery<{ Aliases?: { Name: string; FunctionVersion: string; Description?: string }[] }>('lambda', 'list_aliases', { FunctionName: name, MaxItems: 50 }),
    retry: false,
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['lambda-versions', name] })
    qc.invalidateQueries({ queryKey: ['lambda-aliases', name] })
  }
  const publish = useMutation({
    mutationFn: () => runQuery<{ Version: string }>('lambda', 'publish_version', { FunctionName: name }),
    onSuccess: (r) => {
      invalidate()
      toast.success(`Published version ${r.Version}`)
    },
  })
  const saveAlias = useMutation({
    mutationFn: async () => {
      const existing = aliases.data?.Aliases?.find((a) => a.Name === aliasName.trim())
      return runQuery('lambda', existing ? 'update_alias' : 'create_alias', { FunctionName: name, Name: aliasName.trim(), FunctionVersion: aliasVersion })
    },
    onSuccess: () => {
      invalidate()
      setAliasOpen(false)
      toast.success(`Alias “${aliasName.trim()}” → ${aliasVersion}`)
    },
  })
  const deleteAlias = useMutation({
    mutationFn: (alias: string) => runQuery('lambda', 'delete_alias', { FunctionName: name, Name: alias }),
    onSuccess: (_r, alias) => {
      invalidate()
      toast.success(`Alias “${alias}” deleted`)
    },
    onSettled: () => setConfirmAlias(null),
  })
  const versionList = (versions.data?.Versions ?? []).filter((v) => v.Version !== '$LATEST').sort((a, b) => Number(b.Version) - Number(a.Version))
  const aliasList = aliases.data?.Aliases ?? []
  const aliasFor = (version: string) => aliasList.filter((a) => a.FunctionVersion === version).map((a) => a.Name)

  return (
    <Card
      title={<span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" />Versions & aliases</span>}
      actions={
        <div className="flex items-center gap-1">
          <Button size="xs" variant="outline" onClick={() => { setAliasName(''); setAliasVersion(versionList[0]?.Version ?? '$LATEST'); setAliasOpen(true) }}><Link2 />Alias</Button>
          <Button size="xs" onClick={() => publish.mutate()} disabled={publish.isPending || fn.State !== 'Active'}><Plus />{publish.isPending ? 'Publishing…' : 'Publish version'}</Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">Publishing freezes the current code and configuration as an immutable version. Aliases are named pointers (e.g. <span className="font-mono">prod</span>) you can move between versions.</p>
      {versions.isPending ? <Skeleton className="h-16 w-full" /> : versions.isError ? <ErrorAlert error={versions.error} /> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wide">Version</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Aliases</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Published</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">$LATEST</TableCell>
                <TableCell>{aliasFor('$LATEST').map((a) => <AliasBadge key={a} name={a} onDelete={() => setConfirmAlias(a)} />)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">unpublished (current code)</TableCell>
                <TableCell>{formatBytes(fn.CodeSize)}</TableCell>
              </TableRow>
              {versionList.map((v) => (
                <TableRow key={v.Version}>
                  <TableCell className="font-mono text-xs">{v.Version}{v.Description && <div className="text-[10px] text-muted-foreground">{v.Description}</div>}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{aliasFor(v.Version).map((a) => <AliasBadge key={a} name={a} onDelete={() => setConfirmAlias(a)} />)}</div></TableCell>
                  <TableCell>{timeAgo(v.LastModified)}</TableCell>
                  <TableCell>{formatBytes(v.CodeSize ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {publish.isError && <div className="mt-2"><ErrorAlert error={publish.error} /></div>}

      <Dialog open={aliasOpen} onOpenChange={(o) => !o && setAliasOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create or move an alias</DialogTitle>
            <DialogDescription>An alias with the same name is updated to point at the chosen version.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (aliasName.trim()) saveAlias.mutate() }} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alias-name">Alias name</Label>
              <Input id="alias-name" value={aliasName} onChange={(e) => setAliasName(e.target.value)} placeholder="prod" list="alias-suggestions" autoFocus />
              <datalist id="alias-suggestions">{aliasList.map((a) => <option key={a.Name} value={a.Name} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alias-version">Points to version</Label>
              <select id="alias-version" value={aliasVersion} onChange={(e) => setAliasVersion(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="$LATEST">$LATEST</option>
                {versionList.map((v) => <option key={v.Version} value={v.Version}>{v.Version}</option>)}
              </select>
            </div>
            {saveAlias.isError && <ErrorAlert error={saveAlias.error} />}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAliasOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!aliasName.trim() || saveAlias.isPending}>{saveAlias.isPending ? 'Saving…' : 'Save alias'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirmAlias != null} title={`Delete alias “${confirmAlias}”?`} description="Anything invoking the function through this alias will stop working." confirmLabel="Delete alias" pending={deleteAlias.isPending} onCancel={() => setConfirmAlias(null)} onConfirm={() => confirmAlias && deleteAlias.mutate(confirmAlias)} />
    </Card>
  )
}

function AliasBadge({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <Badge variant="secondary" className="h-auto gap-1 rounded-md py-0.5 font-mono text-[11px]">
      {name}
      <button type="button" onClick={onDelete} aria-label={`Delete alias ${name}`} className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
    </Badge>
  )
}

/* ---------------- Triggers (event source mappings) ---------------- */

function TriggersCard({ fn }: { fn: FunctionRow }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const name = fn.FunctionName
  const [addOpen, setAddOpen] = useState(false)
  const [sourceArn, setSourceArn] = useState('')
  const [batch, setBatch] = useState('10')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['lambda-triggers', name, activeProfileId],
    queryFn: () => runQuery<{ EventSourceMappings?: { UUID: string; EventSourceArn?: string; State?: string; BatchSize?: number; LastModified?: string }[] }>('lambda', 'list_event_source_mappings', { FunctionName: name, MaxItems: 50 }),
    retry: false,
    refetchInterval: (q) => (q.state.data?.EventSourceMappings?.some((m) => /ing$/.test(m.State ?? '')) ? 5000 : false),
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['lambda-triggers', name] })
  const add = useMutation({
    mutationFn: () => runQuery('lambda', 'create_event_source_mapping', { FunctionName: name, EventSourceArn: sourceArn.trim(), BatchSize: Number(batch), ...(/:(dynamodb|kinesis):/.test(sourceArn) ? { StartingPosition: 'LATEST' } : {}) }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      setSourceArn('')
      toast.success('Trigger added')
    },
  })
  const toggle = useMutation({
    mutationFn: ({ uuid, enabled }: { uuid: string; enabled: boolean }) => runQuery('lambda', 'update_event_source_mapping', { UUID: uuid, Enabled: enabled }),
    onSuccess: (_r, { enabled }) => {
      invalidate()
      toast.success(`Trigger ${enabled ? 'enabled' : 'disabled'}`)
    },
  })
  const remove = useMutation({
    mutationFn: (uuid: string) => runQuery('lambda', 'delete_event_source_mapping', { UUID: uuid }),
    onSuccess: () => {
      invalidate()
      toast.success('Trigger removed')
    },
    onSettled: () => setConfirmDelete(null),
  })
  const mappings = q.data?.EventSourceMappings ?? []
  const sourceKind = (arn = '') => arn.split(':')[2]?.toUpperCase() || 'Source'

  return (
    <Card
      title="Triggers"
      actions={<Button size="xs" variant="outline" onClick={() => setAddOpen(true)}><Plus />Add trigger</Button>}
    >
      <p className="mb-3 text-xs text-muted-foreground">Queues and streams that invoke this function automatically (SQS, DynamoDB Streams, Kinesis, MSK…). HTTP access is under Function URL.</p>
      {q.isPending ? <Skeleton className="h-12 w-full" /> : q.isError ? <ErrorAlert error={q.error} /> : mappings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No triggers configured.</p>
      ) : (
        <ul className="divide-y">
          {mappings.map((m) => (
            <li key={m.UUID} className="flex items-center gap-3 py-2">
              <Badge variant="outline" className="shrink-0">{sourceKind(m.EventSourceArn)}</Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs">{m.EventSourceArn}</div>
                <div className="text-[11px] text-muted-foreground">{m.State} · batch {m.BatchSize} · {timeAgo(m.LastModified)}</div>
              </div>
              <Switch checked={m.State === 'Enabled' || m.State === 'Enabling'} disabled={toggle.isPending || /ing$/.test(m.State ?? '')} onCheckedChange={(v) => toggle.mutate({ uuid: m.UUID, enabled: v })} aria-label="Enable trigger" />
              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(m.UUID)} aria-label="Remove trigger" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      {(toggle.isError || remove.isError) && <div className="mt-2"><ErrorAlert error={toggle.error || remove.error} /></div>}

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a trigger</DialogTitle>
            <DialogDescription>Paste the ARN of an SQS queue, DynamoDB stream or Kinesis stream. The execution role must be allowed to read from it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (sourceArn.trim()) add.mutate() }} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trigger-arn">Source ARN</Label>
              <Input id="trigger-arn" value={sourceArn} onChange={(e) => setSourceArn(e.target.value)} placeholder="arn:aws:sqs:us-east-1:123456789012:my-queue" className="font-mono text-xs" autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trigger-batch">Batch size</Label>
              <Input id="trigger-batch" type="number" min={1} max={10000} value={batch} onChange={(e) => setBatch(e.target.value)} className="w-32" />
            </div>
            {add.isError && <ErrorAlert error={add.error} />}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!sourceArn.trim() || add.isPending}>{add.isPending ? 'Adding…' : 'Add trigger'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirmDelete != null} title="Remove this trigger?" description="The source will stop invoking the function." confirmLabel="Remove" pending={remove.isPending} onCancel={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && remove.mutate(confirmDelete)} />
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
      <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy" className="size-5 shrink-0 text-muted-foreground hover:text-primary">
        {copied ? <Check className="text-green-500" /> : <Copy />}
      </Button>
    </span>
  )
}
