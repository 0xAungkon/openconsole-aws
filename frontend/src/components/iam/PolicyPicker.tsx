import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { runQuery } from '../../api/proxy'
import { isAwsManaged, type IamPolicy } from '../../lib/iam'
import { useSessionStore } from '../../store/sessionStore'

/** Load every managed policy (Local = customer managed, All = incl. AWS managed). */
export function useManagedPolicies(scope: 'Local' | 'All') {
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  return useQuery({
    queryKey: ['iam-policies', scope, activeProfileId],
    queryFn: async () => {
      const all: IamPolicy[] = []
      let marker: string | undefined
      do {
        const p = await runQuery<{ Policies?: IamPolicy[]; Marker?: string; IsTruncated?: boolean }>('iam', 'list_policies', { Scope: scope, OnlyAttachable: true, MaxItems: 1000, ...(marker ? { Marker: marker } : {}) })
        all.push(...(p.Policies ?? []))
        marker = p.IsTruncated ? p.Marker : undefined
      } while (marker)
      return all.sort((a, b) => a.PolicyName.localeCompare(b.PolicyName))
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

/** Multi-select dialog of managed policies to attach. */
export function PolicyPicker({ open, exclude, pending, onClose, onAttach }: { open: boolean; exclude: string[]; pending: boolean; onClose: () => void; onAttach: (arns: string[]) => void }) {
  const [scope, setScope] = useState<'All' | 'Local'>('All')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const q = useManagedPolicies(scope)
  const list = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (q.data ?? []).filter((p) => !exclude.includes(p.Arn) && (!s || p.PolicyName.toLowerCase().includes(s) || (p.Description ?? '').toLowerCase().includes(s))).slice(0, 200)
  }, [q.data, search, exclude])
  const toggle = (arn: string) => setPicked((cur) => { const n = new Set(cur); if (n.has(arn)) n.delete(arn); else n.add(arn); return n })
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setPicked(new Set()) } }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Attach policies</DialogTitle>
          <DialogDescription>Managed policies grant permissions. AWS managed ones are maintained by AWS; customer managed ones are yours.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search policies (e.g. S3ReadOnly)" className="pl-8" autoFocus />
          </div>
          <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <TabsList><TabsTrigger value="All">All</TabsTrigger><TabsTrigger value="Local">Customer managed</TabsTrigger></TabsList>
          </Tabs>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          {q.isPending ? <div className="flex flex-col gap-2 p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : q.isError ? <p className="p-3 text-sm text-destructive">Could not list policies.</p> : list.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No matching policies.</p> : (
            <ul className="divide-y">
              {list.map((p) => (
                <li key={p.Arn}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                    <Checkbox checked={picked.has(p.Arn)} onCheckedChange={() => toggle(p.Arn)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate font-medium">{p.PolicyName}</span>{isAwsManaged(p.Arn) ? <Badge variant="outline" className="text-[10px]">AWS managed</Badge> : <Badge variant="secondary" className="text-[10px]">Customer managed</Badge>}</span>
                      {p.Description && <span className="block truncate text-xs text-muted-foreground">{p.Description}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={picked.size === 0 || pending} onClick={() => onAttach([...picked])}>{pending ? 'Attaching…' : `Attach ${picked.size || ''}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
