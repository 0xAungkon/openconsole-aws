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
import { fetchLambdaPackage, runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { timeAgo } from '../lib/ec2'
import { errorMessage } from '../lib/errors'
import { RUNTIMES, decodeBase64, prettyJson, runtimeLabel, toRow, zipSourceBase64, type FunctionRow } from '../lib/lambda'
import { bytesParam, fileToBase64, formatBytes } from '../lib/s3'
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
          <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
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
      if (r.error) toast.error(`Function returned an error (${r.error})`)
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
  useEffect(() => {
    setMemory(String(fn.MemorySize))
    setTimeoutS(String(fn.Timeout))
    setHandler(fn.Handler)
    setDescription(fn.Description)
  }, [fn.MemorySize, fn.Timeout, fn.Handler, fn.Description])
  const m = useFunctionMutation(fn.FunctionName)
  const changed = Number(memory) !== fn.MemorySize || Number(timeout) !== fn.Timeout || handler !== fn.Handler || description !== fn.Description

  return (
    <Card title="Configuration">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate({
            op: 'update_function_configuration',
            params: { FunctionName: fn.FunctionName, MemorySize: Number(memory), Timeout: Number(timeout), Handler: handler.trim(), Description: description.trim() },
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
