import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  Copy,
  Download,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  Info,
  Link2,
  Lock,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { timeAgo } from '../lib/ec2'
import { errorMessage } from '../lib/errors'
import {
  MAX_UPLOAD_BYTES,
  breadcrumbs,
  bytesParam,
  fileIconKind,
  fileToBase64,
  formatBytes,
  parseListing,
  type ObjectEntry,
} from '../lib/s3'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const PAGE = 200

/** Delete every object (all versions + delete markers) under a prefix. */
async function deleteUnderPrefix(bucket: string, prefix: string): Promise<number> {
  let deleted = 0
  let keyMarker: string | undefined
  let versionMarker: string | undefined
  do {
    const page = await runQuery<any>('s3', 'list_object_versions', {
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000,
      ...(keyMarker ? { KeyMarker: keyMarker } : {}),
      ...(versionMarker ? { VersionIdMarker: versionMarker } : {}),
    })
    const objects = [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])].map((v: any) => ({
      Key: v.Key,
      ...(v.VersionId && v.VersionId !== 'null' ? { VersionId: v.VersionId } : {}),
    }))
    if (objects.length) {
      await runQuery('s3', 'delete_objects', { Bucket: bucket, Delete: { Objects: objects, Quiet: true } })
      deleted += objects.length
    }
    keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined
    versionMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined
  } while (keyMarker)
  return deleted
}

export function BucketPage() {
  const { profile, bucket = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const prefix = searchParams.get('prefix') ?? ''
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const queryClient = useQueryClient()

  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/storage`
  const setPrefix = (p: string) => setSearchParams(p ? { prefix: p } : {})

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pages, setPages] = useState<string[]>([]) // continuation tokens of loaded extra pages
  const [confirm, setConfirm] = useState<{ title: string; description: string; label: string; run: () => Promise<unknown> } | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [renaming, setRenaming] = useState<ObjectEntry | null>(null)
  const [inspecting, setInspecting] = useState<ObjectEntry | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const location = useQuery({
    queryKey: ['s3-bucket-location', bucket, activeProfileId],
    queryFn: () => runQuery<{ LocationConstraint?: string | null }>('s3', 'get_bucket_location', { Bucket: bucket }),
    enabled: !needsProfile && !!bucket,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const region = location.data ? location.data.LocationConstraint || 'us-east-1' : '…'

  const listing = useQuery({
    queryKey: ['s3-objects', bucket, prefix, pages, activeProfileId],
    queryFn: async () => {
      // Re-fetch the first page plus any "Load more" pages so the view stays complete.
      const entries: ObjectEntry[] = []
      let token: string | undefined
      let next: string | undefined
      const tokens = [undefined, ...pages]
      for (const t of tokens) {
        token = t
        const page = await runQuery<any>('s3', 'list_objects_v2', {
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: '/',
          MaxKeys: PAGE,
          ...(token ? { ContinuationToken: token } : {}),
        })
        entries.push(...parseListing(page, prefix))
        next = page.IsTruncated ? page.NextContinuationToken : undefined
      }
      return { entries, next }
    },
    enabled: !needsProfile && !!bucket,
  })

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = listing.data?.entries ?? []
    return q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all
  }, [listing.data, search])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['s3-objects', bucket] })
    setSelected(new Set())
  }

  /* ---------------- mutations ---------------- */

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const id = 'upload'
      let done = 0
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`“${file.name}” is larger than ${formatBytes(MAX_UPLOAD_BYTES)} and was skipped`)
          continue
        }
        toast.loading(`Uploading ${file.name} (${done + 1}/${files.length})…`, { id })
        const body = await fileToBase64(file)
        await runQuery('s3', 'put_object', {
          Bucket: bucket,
          Key: prefix + file.name,
          Body: bytesParam(body),
          ...(file.type ? { ContentType: file.type } : {}),
        })
        done++
      }
      toast.dismiss(id)
      return done
    },
    onSuccess: (n) => {
      refresh()
      if (n) toast.success(`Uploaded ${n} file${n === 1 ? '' : 's'} to ${prefix || 'the bucket root'}`)
    },
    onError: () => toast.dismiss('upload'),
  })

  const createFolder = useMutation({
    mutationFn: (name: string) =>
      runQuery('s3', 'put_object', { Bucket: bucket, Key: `${prefix}${name.replace(/\/+$/, '')}/`, Body: bytesParam('') }),
    onSuccess: (_r, name) => {
      refresh()
      setFolderOpen(false)
      toast.success(`Folder “${name}” created`)
    },
  })

  const rename = useMutation({
    mutationFn: async ({ entry, to }: { entry: ObjectEntry; to: string }) => {
      if (entry.kind === 'file') {
        await runQuery('s3', 'copy_object', { Bucket: bucket, CopySource: { Bucket: bucket, Key: entry.key }, Key: to })
        await runQuery('s3', 'delete_object', { Bucket: bucket, Key: entry.key })
        return 1
      }
      // Folder: copy every object under the prefix to the new prefix, then delete the old ones.
      let moved = 0
      let token: string | undefined
      do {
        const page = await runQuery<any>('s3', 'list_objects_v2', { Bucket: bucket, Prefix: entry.key, MaxKeys: 1000, ...(token ? { ContinuationToken: token } : {}) })
        for (const o of page.Contents ?? []) {
          await runQuery('s3', 'copy_object', { Bucket: bucket, CopySource: { Bucket: bucket, Key: o.Key }, Key: to + (o.Key as string).slice(entry.key.length) })
          moved++
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (token)
      await deleteUnderPrefix(bucket, entry.key)
      return moved
    },
    onSuccess: (n, { entry, to }) => {
      refresh()
      setRenaming(null)
      toast.success(entry.kind === 'file' ? `Moved to ${to}` : `Moved ${n} object${n === 1 ? '' : 's'} to ${to}`)
    },
  })

  const deleteEntries = useMutation({
    mutationFn: async (items: ObjectEntry[]) => {
      const files = items.filter((i) => i.kind === 'file').map((i) => ({ Key: i.key }))
      let count = 0
      if (files.length) {
        await runQuery('s3', 'delete_objects', { Bucket: bucket, Delete: { Objects: files, Quiet: true } })
        count += files.length
      }
      for (const folder of items.filter((i) => i.kind === 'folder')) {
        count += await deleteUnderPrefix(bucket, folder.key)
      }
      return count
    },
    onSuccess: (n) => {
      refresh()
      toast.success(`Deleted ${n} object${n === 1 ? '' : 's'}`)
    },
  })

  const download = useMutation({
    mutationFn: async (entry: ObjectEntry) => {
      const url = await runQuery<string>('s3', 'generate_presigned_url', {
        ClientMethod: 'get_object',
        Params: { Bucket: bucket, Key: entry.key },
        ExpiresIn: 300,
      })
      window.open(url, '_blank', 'noopener')
      return entry
    },
    onSuccess: (entry) => toast.success(`Download link opened for ${entry.name}`),
  })

  const emptyBucket = useMutation({
    mutationFn: () => deleteUnderPrefix(bucket, ''),
    onSuccess: (n) => {
      refresh()
      toast.success(`Emptied bucket — ${n} object${n === 1 ? '' : 's'} removed`)
    },
  })

  const deleteBucket = useMutation({
    mutationFn: () => runQuery('s3', 'delete_bucket', { Bucket: bucket }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['s3-buckets'] })
      toast.success(`Bucket “${bucket}” deleted`)
      navigate(backTo)
    },
  })

  /* ---------------- helpers ---------------- */

  function onFiles(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (files.length) upload.mutate(files)
    if (fileInput.current) fileInput.current.value = ''
  }

  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.key))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.key)))
  const toggle = (key: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const selectedEntries = entries.filter((e) => selected.has(e.key))
  const crumbs = breadcrumbs(prefix)

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary">
        <ArrowLeft />
        Back to buckets
      </Button>

      {needsProfile ? (
        <Card title="Bucket">
          <p className="text-sm text-warning">Select an AWS profile from the account menu to view this bucket.</p>
        </Card>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Boxes aria-hidden="true" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">{bucket}</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Region {region} <span className="px-1 opacity-50">/</span> {listing.data ? `${listing.data.entries.length}${listing.data.next ? '+' : ''} items in this folder` : 'Loading…'}
                  <span className="px-1 opacity-50">/</span> <BucketSize bucket={bucket} />
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 border-t pt-4 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={refresh} disabled={listing.isFetching} aria-label="Refresh">
                    <RefreshCw className={cn(listing.isFetching && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Button variant="outline" onClick={() => setFolderOpen(true)}>
                <FolderPlus />
                New folder
              </Button>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
                <Upload />
                {upload.isPending ? 'Uploading…' : 'Upload files'}
              </Button>
            </div>
          </div>

          {/* File browser */}
          <Card
            title={
              <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm font-medium">
                <button type="button" onClick={() => setPrefix('')} className={cn('rounded px-1 hover:text-primary', !prefix && 'text-primary')}>
                  {bucket}
                </button>
                {crumbs.map((c, i) => (
                  <span key={c.prefix} className="flex items-center gap-1">
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setPrefix(c.prefix)}
                      className={cn('rounded px-1 hover:text-primary', i === crumbs.length - 1 && 'text-primary')}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </nav>
            }
            actions={
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setConfirm({
                        title: `Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`,
                        description: 'Folders are deleted with everything inside them. This cannot be undone.',
                        label: 'Delete',
                        run: () => deleteEntries.mutateAsync(selectedEntries),
                      })
                    }
                  >
                    <Trash2 />
                    Delete {selected.size}
                  </Button>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter this folder" aria-label="Filter this folder" className="h-7 w-48 pl-8 text-xs" />
                </div>
              </div>
            }
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}
              className={cn('relative -m-4 rounded-b-xl transition-colors', dragging && 'bg-accent/60 ring-2 ring-primary/50')}
            >
              {dragging && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm font-medium text-primary">
                  Drop files to upload to {prefix || 'the bucket root'}
                </div>
              )}
              {listing.isError ? (
                <div className="p-4"><ErrorAlert error={listing.error} /></div>
              ) : listing.isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <Folder className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">{search ? 'Nothing matches your filter' : 'This folder is empty'}</p>
                  <p className="text-xs text-muted-foreground">
                    {search ? 'Try a different term.' : 'Drag files here or use “Upload files” to add some.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 px-4">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Name</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Size</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Modified</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Class</TableHead>
                        <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => (
                        <ObjectRow
                          key={e.key}
                          entry={e}
                          checked={selected.has(e.key)}
                          onToggle={() => toggle(e.key)}
                          onOpen={() => (e.kind === 'folder' ? setPrefix(e.key) : download.mutate(e))}
                          onDownload={() => download.mutate(e)}
                          onRename={() => setRenaming(e)}
                          onInspect={() => setInspecting(e)}
                          onDelete={() =>
                            setConfirm({
                              title: `Delete ${e.kind} “${e.name}”?`,
                              description: e.kind === 'folder' ? 'Everything inside the folder will be deleted.' : 'This cannot be undone.',
                              label: 'Delete',
                              run: () => deleteEntries.mutateAsync([e]),
                            })
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                  {listing.data?.next && (
                    <div className="flex justify-center border-t p-2">
                      <Button variant="outline" size="sm" onClick={() => setPages((p) => [...p, listing.data!.next!])} disabled={listing.isFetching}>
                        Load more
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <VersioningCard bucket={bucket} />
            <PublicAccessCard bucket={bucket} />
            <EncryptionCard bucket={bucket} />
            <WebsiteCard bucket={bucket} region={region} />
            <TagsCard bucket={bucket} />
            <Card title="Danger zone">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Empty bucket</div>
                    <div className="text-xs text-muted-foreground">Delete every object and version, but keep the bucket.</div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={emptyBucket.isPending}
                    onClick={() =>
                      setConfirm({
                        title: `Empty “${bucket}”?`,
                        description: 'All objects, versions and delete markers will be permanently removed.',
                        label: 'Empty bucket',
                        run: () => emptyBucket.mutateAsync(),
                      })
                    }
                  >
                    {emptyBucket.isPending ? 'Emptying…' : 'Empty'}
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Delete bucket</div>
                    <div className="text-xs text-muted-foreground">The bucket must be empty first.</div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteBucket.isPending}
                    onClick={() =>
                      setConfirm({
                        title: `Delete bucket “${bucket}”?`,
                        description: 'This cannot be undone.',
                        label: 'Delete bucket',
                        run: () => deleteBucket.mutateAsync(),
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.label}
        pending={deleteEntries.isPending || emptyBucket.isPending || deleteBucket.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.run().catch(() => undefined).finally(() => setConfirm(null))}
      />

      <NewFolderDialog open={folderOpen} pending={createFolder.isPending} onClose={() => setFolderOpen(false)} onCreate={(name) => createFolder.mutate(name)} />
      <RenameDialog entry={renaming} pending={rename.isPending} error={rename.isError ? rename.error : undefined} onClose={() => setRenaming(null)} onRename={(to) => renaming && rename.mutate({ entry: renaming, to })} />
      <ObjectInfoDialog bucket={bucket} entry={inspecting} onClose={() => setInspecting(null)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

const ICONS = { image: FileImage, text: FileText, archive: FileArchive, code: FileCode, file: File }

function ObjectRow({
  entry,
  checked,
  onToggle,
  onOpen,
  onDownload,
  onRename,
  onInspect,
  onDelete,
}: {
  entry: ObjectEntry
  checked: boolean
  onToggle: () => void
  onOpen: () => void
  onDownload: () => void
  onRename: () => void
  onInspect: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const Icon = entry.kind === 'folder' ? Folder : ICONS[fileIconKind(entry.name)]
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  async function copyKey(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(entry.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }

  return (
    <TableRow className={cn(checked && 'bg-accent/40')}>
      <TableCell className="px-4" onClick={stop}>
        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${entry.name}`} />
      </TableCell>
      <TableCell>
        <button type="button" onClick={onOpen} className="flex items-center gap-2 text-left hover:text-primary">
          <Icon className={cn('size-4 shrink-0', entry.kind === 'folder' ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn('break-all', entry.kind === 'folder' && 'font-medium')}>{entry.name}</span>
        </button>
      </TableCell>
      <TableCell>{entry.kind === 'folder' ? '—' : formatBytes(entry.size)}</TableCell>
      <TableCell>{entry.kind === 'folder' ? '—' : timeAgo(entry.lastModified)}</TableCell>
      <TableCell>{entry.storageClass ? <Badge variant="outline" className="text-[10px]">{entry.storageClass}</Badge> : '—'}</TableCell>
      <TableCell className="px-4">
        <div className="flex items-center justify-end gap-1">
          {entry.kind === 'file' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={(e) => { stop(e); onDownload() }} aria-label="Download" className="text-muted-foreground hover:text-primary">
                  <Download />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          )}
          {entry.kind === 'file' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={(e) => { stop(e); onInspect() }} aria-label="Properties & share link" className="text-muted-foreground hover:text-primary">
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Properties & share link</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={(e) => { stop(e); onRename() }} aria-label="Rename or move" className="text-muted-foreground hover:text-primary">
                <PencilLine />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rename / move</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={copyKey} aria-label="Copy key" className="text-muted-foreground hover:text-primary">
                {copied ? <Check className="text-green-500" /> : <Copy />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy key</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={(e) => { stop(e); onDelete() }} aria-label="Delete" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40">
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

function NewFolderDialog({ open, pending, onClose, onCreate }: { open: boolean; pending: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const valid = name.trim().length > 0 && !name.includes('/')
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Folders in S3 are just key prefixes — an empty placeholder object is created.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) onCreate(name.trim()) }} className="flex flex-col gap-2">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. backups" autoFocus />
          {name.includes('/') && <span className="text-xs text-destructive">Folder names cannot contain “/”.</span>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || pending}>{pending ? 'Creating…' : 'Create folder'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Bucket size summary ---------------- */

const SIZE_SCAN_CAP = 5000

function BucketSize({ bucket }: { bucket: string }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const q = useQuery({
    queryKey: ['s3-bucket-size', bucket, activeProfileId],
    queryFn: async () => {
      let count = 0
      let bytes = 0
      let token: string | undefined
      let capped = false
      do {
        const page = await runQuery<any>('s3', 'list_objects_v2', { Bucket: bucket, MaxKeys: 1000, ...(token ? { ContinuationToken: token } : {}) })
        for (const o of page.Contents ?? []) {
          count++
          bytes += o.Size ?? 0
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined
        if (count >= SIZE_SCAN_CAP && token) {
          capped = true
          break
        }
      } while (token)
      return { count, bytes, capped }
    },
    enabled: false,
    retry: false,
    meta: { silent: true },
  })
  if (q.data) return <span>{q.data.count.toLocaleString()}{q.data.capped ? '+' : ''} objects · {formatBytes(q.data.bytes)}{q.data.capped ? '+' : ''}</span>
  return (
    <button type="button" onClick={() => q.refetch()} disabled={q.isFetching} className="text-primary hover:underline disabled:opacity-60">
      {q.isFetching ? 'Calculating size…' : q.isError ? 'Size unavailable' : 'Calculate size'}
    </button>
  )
}

/* ---------------- Rename / move ---------------- */

function RenameDialog({ entry, pending, error, onClose, onRename }: { entry: ObjectEntry | null; pending: boolean; error?: unknown; onClose: () => void; onRename: (to: string) => void }) {
  const [to, setTo] = useState('')
  useEffect(() => setTo(entry?.key ?? ''), [entry])
  const isFolder = entry?.kind === 'folder'
  const target = isFolder ? to.trim().replace(/\/*$/, '/') : to.trim()
  const valid = !!target && target !== entry?.key && !target.startsWith('/') && (!isFolder || !target.startsWith(entry!.key))
  return (
    <Dialog open={entry != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isFolder ? 'Rename or move folder' : 'Rename or move file'}</DialogTitle>
          <DialogDescription>Edit the full key. Changing the path before the name moves it to another folder. {isFolder ? 'Every object inside is copied to the new prefix, then the old ones are removed.' : 'The object is copied to the new key and the original is deleted.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) onRename(target) }} className="flex flex-col gap-2">
          <Label htmlFor="rename-key">New key</Label>
          <Input id="rename-key" value={to} onChange={(e) => setTo(e.target.value)} className="font-mono text-xs" autoFocus />
          {error != null && <ErrorAlert error={error} />}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || pending}>{pending ? 'Moving…' : 'Move'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Object properties + share link ---------------- */

const SHARE_EXPIRIES = [
  { label: '15 minutes', seconds: 900 },
  { label: '1 hour', seconds: 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '7 days', seconds: 7 * 86400 },
]

function ObjectInfoDialog({ bucket, entry, onClose }: { bucket: string; entry: ObjectEntry | null; onClose: () => void }) {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [expiry, setExpiry] = useState('3600')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { setLink(''); setCopied(false) }, [entry])
  const head = useQuery({
    queryKey: ['s3-head', bucket, entry?.key, activeProfileId],
    queryFn: () => runQuery<any>('s3', 'head_object', { Bucket: bucket, Key: entry!.key }),
    enabled: !!entry,
    retry: false,
  })
  const share = useMutation({
    mutationFn: () => runQuery<string>('s3', 'generate_presigned_url', { ClientMethod: 'get_object', Params: { Bucket: bucket, Key: entry!.key }, ExpiresIn: Number(expiry) }),
    onSuccess: (url) => {
      setLink(url)
      toast.success('Share link created')
    },
  })
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard is unavailable in this browser')
    }
  }
  const h = head.data
  const meta: Record<string, string> = h?.Metadata ?? {}
  return (
    <Dialog open={entry != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-all">{entry?.name}</DialogTitle>
          <DialogDescription className="break-all font-mono text-xs">{entry?.key}</DialogDescription>
        </DialogHeader>
        {head.isPending ? <Skeleton className="h-32 w-full" /> : head.isError ? <ErrorAlert error={head.error} /> : (
          <dl className="divide-y text-sm">
            {[
              ['Size', formatBytes(h.ContentLength)],
              ['Content type', h.ContentType || '—'],
              ['Last modified', h.LastModified ? new Date(h.LastModified).toLocaleString() : '—'],
              ['ETag', String(h.ETag ?? '—').replace(/"/g, '')],
              ['Storage class', h.StorageClass || 'STANDARD'],
              ['Encryption', h.ServerSideEncryption || 'None'],
              ...(h.VersionId ? [['Version', h.VersionId]] : []),
              ...Object.entries(meta).map(([k, v]) => [`x-amz-meta-${k}`, v]),
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between gap-3 py-1.5">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-all text-right font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Link2 className="size-4 text-primary" />Share link</div>
          <p className="text-xs text-muted-foreground">A signed URL anyone can use to download this file until it expires — no AWS account needed.</p>
          <div className="flex items-center gap-2">
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{SHARE_EXPIRIES.map((e) => <SelectItem key={e.seconds} value={String(e.seconds)}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => share.mutate()} disabled={share.isPending}>{share.isPending ? 'Creating…' : 'Create link'}</Button>
          </div>
          {link && (
            <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md border bg-muted/40 px-2 py-1.5">
              <a href={link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline">{link}</a>
              <Button variant="ghost" size="icon-xs" onClick={copyLink} aria-label="Copy link" className="text-muted-foreground hover:text-primary">{copied ? <Check className="text-green-500" /> : <Copy />}</Button>
            </div>
          )}
          {share.isError && <ErrorAlert error={share.error} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Encryption ---------------- */

function EncryptionCard({ bucket }: { bucket: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const q = useQuery({
    queryKey: ['s3-encryption', bucket, activeProfileId],
    queryFn: async () => {
      try {
        const r = await runQuery<any>('s3', 'get_bucket_encryption', { Bucket: bucket })
        return (r.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm as string | undefined) ?? null
      } catch (err) {
        if (errorMessage(err).includes('ServerSideEncryptionConfigurationNotFoundError')) return null
        throw err
      }
    },
    retry: false,
  })
  const m = useMutation({
    mutationFn: (enable: boolean) =>
      enable
        ? runQuery('s3', 'put_bucket_encryption', { Bucket: bucket, ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }, BucketKeyEnabled: true }] } })
        : runQuery('s3', 'delete_bucket_encryption', { Bucket: bucket }),
    onSuccess: (_r, enable) => {
      qc.invalidateQueries({ queryKey: ['s3-encryption', bucket] })
      toast.success(enable ? 'Default encryption enabled (SSE-S3)' : 'Default encryption removed')
    },
  })
  return (
    <Card title={<span className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Encryption</span>}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="encryption-switch">Encrypt new files at rest</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {q.isPending ? 'Loading…' : q.data ? `Enabled — new objects use ${q.data === 'aws:kms' ? 'SSE-KMS' : 'SSE-S3 (AES-256)'}.` : 'Disabled — objects are stored unencrypted unless the upload asks for it.'}
          </p>
        </div>
        <Switch id="encryption-switch" checked={!!q.data} disabled={q.isPending || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
      </div>
      {q.isError && <div className="mt-3"><ErrorAlert error={q.error} /></div>}
      {m.isError && <div className="mt-3"><ErrorAlert error={m.error} /></div>}
    </Card>
  )
}

/* ---------------- Static website hosting ---------------- */

function WebsiteCard({ bucket, region }: { bucket: string; region: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const endpointOverride = useSessionStore((s) => s.endpointUrl)
  const guestEndpoint = useAuthStore((s) => s.guestCreds?.endpointUrl)
  const [index, setIndex] = useState('index.html')
  const [error, setError] = useState('error.html')
  const q = useQuery({
    queryKey: ['s3-website', bucket, activeProfileId],
    queryFn: async () => {
      try {
        const r = await runQuery<any>('s3', 'get_bucket_website', { Bucket: bucket })
        return { index: r.IndexDocument?.Suffix as string | undefined, error: r.ErrorDocument?.Key as string | undefined }
      } catch (err) {
        if (errorMessage(err).includes('NoSuchWebsiteConfiguration')) return null
        throw err
      }
    },
    retry: false,
  })
  useEffect(() => {
    if (q.data) {
      setIndex(q.data.index ?? 'index.html')
      setError(q.data.error ?? '')
    }
  }, [q.data])
  const m = useMutation({
    mutationFn: (enable: boolean) =>
      enable
        ? runQuery('s3', 'put_bucket_website', { Bucket: bucket, WebsiteConfiguration: { IndexDocument: { Suffix: index.trim() || 'index.html' }, ...(error.trim() ? { ErrorDocument: { Key: error.trim() } } : {}) } })
        : runQuery('s3', 'delete_bucket_website', { Bucket: bucket }),
    onSuccess: (_r, enable) => {
      qc.invalidateQueries({ queryKey: ['s3-website', bucket] })
      toast.success(enable ? 'Static website hosting enabled' : 'Static website hosting disabled')
    },
  })
  const enabled = !!q.data
  const local = endpointOverride || guestEndpoint
  const url = local
    ? `${local.replace(/\/$/, '').replace('://', `://${bucket}.s3-website.`)}`
    : `http://${bucket}.s3-website${region === 'us-east-1' || region.startsWith('us-west') || region.startsWith('eu-west-1') || region.startsWith('ap-southeast') ? '-' : '.'}${region}.amazonaws.com`
  const changed = enabled && ((q.data?.index ?? 'index.html') !== index.trim() || (q.data?.error ?? '') !== error.trim())
  return (
    <Card title={<span className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Static website</span>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="website-switch">Host a static website</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Serve the files in this bucket over HTTP. Requires public read access (turn off “Block public access” and add a bucket policy).</p>
          </div>
          <Switch id="website-switch" checked={enabled} disabled={q.isPending || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
        </div>
        {enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="website-index">Index document</Label>
                <Input id="website-index" value={index} onChange={(e) => setIndex(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="website-error">Error document</Label>
                <Input id="website-error" value={error} onChange={(e) => setError(e.target.value)} placeholder="Optional" className="font-mono text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
              <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline">{url}</a>
            </div>
            {changed && <div><Button size="sm" onClick={() => m.mutate(true)} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save documents'}</Button></div>}
          </>
        )}
        {q.isError && <ErrorAlert error={q.error} />}
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

/* ---------------- settings cards ---------------- */

function VersioningCard({ bucket }: { bucket: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const q = useQuery({
    queryKey: ['s3-versioning', bucket, activeProfileId],
    queryFn: () => runQuery<{ Status?: string }>('s3', 'get_bucket_versioning', { Bucket: bucket }),
    retry: false,
  })
  const enabled = q.data?.Status === 'Enabled'
  const m = useMutation({
    mutationFn: (next: boolean) =>
      runQuery('s3', 'put_bucket_versioning', { Bucket: bucket, VersioningConfiguration: { Status: next ? 'Enabled' : 'Suspended' } }),
    onSuccess: (_r, next) => {
      qc.invalidateQueries({ queryKey: ['s3-versioning', bucket] })
      toast.success(`Versioning ${next ? 'enabled' : 'suspended'}`)
    },
  })
  return (
    <Card title="Versioning">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="versioning-switch">Keep file versions</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {q.isPending ? 'Loading…' : enabled ? 'Enabled — overwritten and deleted files can be recovered.' : q.data?.Status === 'Suspended' ? 'Suspended — existing versions are kept, new ones are not.' : 'Disabled.'}
          </p>
        </div>
        <Switch id="versioning-switch" checked={enabled} disabled={q.isPending || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
      </div>
      {q.isError && <div className="mt-3"><ErrorAlert error={q.error} /></div>}
    </Card>
  )
}

function PublicAccessCard({ bucket }: { bucket: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const q = useQuery({
    queryKey: ['s3-public-access', bucket, activeProfileId],
    queryFn: async () => {
      try {
        const r = await runQuery<any>('s3', 'get_public_access_block', { Bucket: bucket })
        return r.PublicAccessBlockConfiguration as Record<string, boolean>
      } catch (err) {
        // No configuration means nothing is blocked.
        if (errorMessage(err).includes('NoSuchPublicAccessBlockConfiguration')) return null
        throw err
      }
    },
    retry: false,
  })
  const blocked = !!q.data && Object.values(q.data).every(Boolean)
  const m = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? runQuery('s3', 'put_public_access_block', {
            Bucket: bucket,
            PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true },
          })
        : runQuery('s3', 'delete_public_access_block', { Bucket: bucket }),
    onSuccess: (_r, next) => {
      qc.invalidateQueries({ queryKey: ['s3-public-access', bucket] })
      toast.success(next ? 'Public access is now blocked' : 'Public access block removed')
    },
  })
  return (
    <Card title="Public access">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="public-switch">Block all public access</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {q.isPending ? 'Loading…' : blocked ? 'Blocked — files can only be reached with credentials or signed links.' : 'Not fully blocked — bucket policies or ACLs may expose files publicly.'}
          </p>
        </div>
        <Switch id="public-switch" checked={blocked} disabled={q.isPending || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
      </div>
      {!q.isPending && !blocked && <Badge className="mt-3 border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Potentially public</Badge>}
      {q.isError && <div className="mt-3"><ErrorAlert error={q.error} /></div>}
    </Card>
  )
}

function TagsCard({ bucket }: { bucket: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const q = useQuery({
    queryKey: ['s3-tags', bucket, activeProfileId],
    queryFn: async () => {
      try {
        const r = await runQuery<{ TagSet?: { Key: string; Value: string }[] }>('s3', 'get_bucket_tagging', { Bucket: bucket })
        return r.TagSet ?? []
      } catch (err) {
        if (errorMessage(err).includes('NoSuchTagSet')) return []
        throw err
      }
    },
    retry: false,
  })
  const tags = q.data ?? []
  const save = useMutation({
    mutationFn: (next: { Key: string; Value: string }[]) =>
      next.length
        ? runQuery('s3', 'put_bucket_tagging', { Bucket: bucket, Tagging: { TagSet: next } })
        : runQuery('s3', 'delete_bucket_tagging', { Bucket: bucket }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['s3-tags', bucket] }),
  })

  function add() {
    const k = key.trim()
    if (!k) return
    save.mutate([...tags.filter((t) => t.Key !== k), { Key: k, Value: value.trim() }], {
      onSuccess: () => {
        setKey('')
        setValue('')
        toast.success(`Label “${k}” added`)
      },
    })
  }

  return (
    <Card title="Labels">
      <div className="flex flex-col gap-3">
        {q.isPending ? (
          <Skeleton className="h-6 w-40" />
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No labels on this bucket yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t.Key} variant="secondary" className="h-auto gap-1.5 rounded-md py-1 font-normal">
                <span><span className="text-muted-foreground">{t.Key}</span> = {t.Value}</span>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(tags.filter((x) => x.Key !== t.Key), { onSuccess: () => toast.success(`Label “${t.Key}” removed`) })}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={`Remove label ${t.Key}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Separator />
        <div className="flex items-center gap-2">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Label" aria-label="Label key" className="w-28" />
          <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Value" aria-label="Label value" className="flex-1" />
          <Button onClick={add} disabled={!key.trim() || save.isPending}>
            <Plus />
            Add
          </Button>
        </div>
        {q.isError && <ErrorAlert error={q.error} />}
      </div>
    </Card>
  )
}
