import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Check, Copy, FolderOpen, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
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
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { timeAgo } from '../lib/ec2'
import { generateBucketName, validateBucketName, type BucketRow } from '../lib/s3'
import { useAuthStore } from '../store/authStore'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'

const PAGE_SIZE = 30

export function StoragePage() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteName, setDeleteName] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const needsProfile = mode === 'register' && activeProfileId == null

  const bucketsQuery = useQuery({
    queryKey: ['s3-buckets', activeProfileId],
    queryFn: () => runQuery<{ Buckets?: BucketRow[] }>('s3', 'list_buckets', {}),
    enabled: !needsProfile,
  })
  const buckets = useMemo(() => bucketsQuery.data?.Buckets ?? [], [bucketsQuery.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? buckets.filter((b) => b.Name.toLowerCase().includes(q)) : buckets
  }, [buckets, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => setPage(1), [search])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  // Region per visible bucket (buckets are global; the list call doesn't include it).
  const locations = useQueries({
    queries: paged.map((b) => ({
      queryKey: ['s3-bucket-location', b.Name, activeProfileId],
      queryFn: () => runQuery<{ LocationConstraint?: string | null }>('s3', 'get_bucket_location', { Bucket: b.Name }),
      staleTime: 5 * 60 * 1000,
      retry: false,
      meta: { silent: true },
    })),
  })
  const regionOf = (i: number) => {
    const q = locations[i]
    if (!q || q.isPending) return '…'
    if (q.isError) return '—'
    return q.data?.LocationConstraint || 'us-east-1'
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['s3-buckets'] })

  const remove = useMutation({
    mutationFn: (name: string) => runQuery('s3', 'delete_bucket', { Bucket: name }),
    onSuccess: (_r, name) => {
      invalidate()
      toast.success(`Bucket “${name}” deleted`)
    },
    onSettled: () => setDeleteName(null),
  })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-5 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Boxes aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your buckets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Object storage for files, backups and static sites
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buckets"
              aria-label="Search buckets by name"
              className="pl-8 sm:w-64"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={invalidate} disabled={bucketsQuery.isFetching} aria-label="Refresh">
                <RefreshCw className={cn(bucketsQuery.isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            New bucket
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 flex-1', createOpen && 'lg:w-[70%]')}>
          {needsProfile ? (
            <Card title="Storage">
              <p className="text-sm text-warning">Select an AWS profile from the account menu to view your buckets.</p>
            </Card>
          ) : bucketsQuery.isError ? (
            <ErrorAlert error={bucketsQuery.error} />
          ) : bucketsQuery.isLoading ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasAny={buckets.length > 0} onCreate={() => setCreateOpen(true)} />
          ) : (
            <UiCard className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 text-xs uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Region</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Created</TableHead>
                      <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((b, i) => (
                      <BucketRowView
                        key={b.Name}
                        bucket={b}
                        region={regionOf(i)}
                        busy={remove.isPending && remove.variables === b.Name}
                        onOpen={() => navigate(`/${profile}/storage/${encodeURIComponent(b.Name)}`)}
                        onDelete={() => setDeleteName(b.Name)}
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
                    <Button variant="outline" size="xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      Previous
                    </Button>
                    <span className="px-2">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </UiCard>
          )}
        </div>

        {createOpen && (
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[30%]">
            <CreateBucketPanel
              defaultRegion={region}
              onClose={() => setCreateOpen(false)}
              onCreated={(name) => {
                invalidate()
                setCreateOpen(false)
                navigate(`/${profile}/storage/${encodeURIComponent(name)}`)
              }}
            />
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={deleteName != null}
        title={`Delete bucket “${deleteName}”?`}
        description="The bucket must be empty. This cannot be undone."
        confirmLabel="Delete bucket"
        pending={remove.isPending}
        onCancel={() => setDeleteName(null)}
        onConfirm={() => deleteName && remove.mutate(deleteName)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function CreateBucketPanel({
  defaultRegion,
  onClose,
  onCreated,
}: {
  defaultRegion: string
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [name, setName] = useState(generateBucketName)
  const [bucketRegion, setBucketRegion] = useState(defaultRegion)
  const [versioning, setVersioning] = useState(false)
  const [blockPublic, setBlockPublic] = useState(true)
  const problem = validateBucketName(name.trim())

  const create = useMutation({
    mutationFn: async () => {
      const bucket = name.trim()
      await runQuery('s3', 'create_bucket', {
        Bucket: bucket,
        // us-east-1 must not send a LocationConstraint.
        ...(bucketRegion !== 'us-east-1'
          ? { CreateBucketConfiguration: { LocationConstraint: bucketRegion } }
          : {}),
      })
      if (blockPublic) {
        await runQuery('s3', 'put_public_access_block', {
          Bucket: bucket,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        })
      }
      if (versioning) {
        await runQuery('s3', 'put_bucket_versioning', {
          Bucket: bucket,
          VersioningConfiguration: { Status: 'Enabled' },
        })
      }
      return bucket
    },
    onSuccess: (bucket) => {
      toast.success(`Bucket “${bucket}” created in ${bucketRegion}`)
      onCreated(bucket)
    },
  })

  return (
    <UiCard className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-4 w-[3px] rounded-full bg-primary" />
          Create a new bucket
        </CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-muted-foreground">
          <X />
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        {create.isError && (
          <div className="mb-3">
            <ErrorAlert error={create.error} />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!problem) create.mutate()
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bucket-name">
              Bucket name <span className="text-destructive">*</span>
            </Label>
            <CodenameInput id="bucket-name" value={name} required onChange={setName} />
            <span className={cn('text-xs', problem ? 'text-destructive' : 'text-muted-foreground')}>
              {problem ?? 'Names are global across AWS: lowercase letters, numbers, dots and hyphens.'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bucket-region">Region</Label>
            <Select value={bucketRegion} onValueChange={setBucketRegion}>
              <SelectTrigger id="bucket-region" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AWS_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="bucket-block-public">Block public access</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Recommended. Keeps files private unless you change it later.</p>
            </div>
            <Switch id="bucket-block-public" checked={blockPublic} onCheckedChange={setBlockPublic} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="bucket-versioning">Versioning</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Keep previous versions of files when they are overwritten or deleted.</p>
            </div>
            <Switch id="bucket-versioning" checked={versioning} onCheckedChange={setVersioning} />
          </div>
          <Button type="submit" disabled={!!problem || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create bucket'}
          </Button>
        </form>
      </CardContent>
    </UiCard>
  )
}

function EmptyState({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
        <Boxes className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{hasAny ? 'No buckets match your search' : 'No buckets yet'}</p>
        <p className="text-xs text-muted-foreground">
          {hasAny ? 'Try a different search term.' : 'Create your first bucket to start storing files.'}
        </p>
      </div>
      {!hasAny && (
        <Button onClick={onCreate}>
          <Plus />
          New bucket
        </Button>
      )}
    </div>
  )
}

function BucketRowView({
  bucket,
  region,
  busy,
  onOpen,
  onDelete,
}: {
  bucket: BucketRow
  region: string
  busy: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  async function copyName(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(bucket.Name)
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
          <FolderOpen className="size-4 shrink-0 text-primary" />
          <span className="font-medium">{bucket.Name}</span>
          <Button variant="ghost" size="icon-xs" onClick={copyName} aria-label="Copy bucket name" className="size-5 text-muted-foreground hover:text-primary">
            {copied ? <Check className="text-green-500" /> : <Copy />}
          </Button>
        </div>
      </TableCell>
      <TableCell>{region}</TableCell>
      <TableCell>{timeAgo(bucket.CreationDate)}</TableCell>
      <TableCell className="px-4">
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="xs" onClick={(e) => { stop(e); onOpen() }}>
            Open
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={(e) => { stop(e); onDelete() }}
                aria-label="Delete bucket"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
              >
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
