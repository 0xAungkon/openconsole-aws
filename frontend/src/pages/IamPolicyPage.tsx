import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileJson, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { IamTagsCard } from '../components/iam/IamTagsCard'
import { timeAgo } from '../lib/ec2'
import { deletePolicyCompletely, isAwsManaged, policyDoc, policySummary, validateJsonPolicy, type IamPolicy } from '../lib/iam'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { CopyText, Detail, IamHeader } from './IamDetailShared'

export function IamPolicyPage() {
  const { profile, arn = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmVersion, setConfirmVersion] = useState<string | null>(null)
  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/access?tab=policies`
  const aws = isAwsManaged(arn)

  const q = useQuery({ queryKey: ['iam-policy', arn, activeProfileId], queryFn: () => runQuery<{ Policy: IamPolicy }>('iam', 'get_policy', { PolicyArn: arn }), enabled: !needsProfile && !!arn })
  const policy = q.data?.Policy
  const versions = useQuery({ queryKey: ['iam-policy-versions', arn, activeProfileId], queryFn: () => runQuery<{ Versions?: { VersionId: string; IsDefaultVersion: boolean; CreateDate: string }[] }>('iam', 'list_policy_versions', { PolicyArn: arn }), enabled: !!policy, retry: false })
  const doc = useQuery({ queryKey: ['iam-policy-doc', arn, policy?.DefaultVersionId, activeProfileId], queryFn: () => runQuery<{ PolicyVersion: { Document: any } }>('iam', 'get_policy_version', { PolicyArn: arn, VersionId: policy!.DefaultVersionId }), enabled: !!policy?.DefaultVersionId })
  const entities = useQuery({ queryKey: ['iam-policy-entities', arn, activeProfileId], queryFn: () => runQuery<{ PolicyUsers?: { UserName: string }[]; PolicyRoles?: { RoleName: string }[]; PolicyGroups?: { GroupName: string }[] }>('iam', 'list_entities_for_policy', { PolicyArn: arn, MaxItems: 1000 }), enabled: !!policy, retry: false })

  const current = doc.data ? JSON.stringify(policyDoc(doc.data.PolicyVersion.Document), null, 2) : ''
  const [text, setText] = useState('')
  useEffect(() => setText(current), [current])
  const parsed = text ? validateJsonPolicy(text) : null

  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('iam-') })
  const save = useMutation({
    mutationFn: async () => {
      // IAM keeps at most 5 versions — drop the oldest non-default one if we're full.
      const list = versions.data?.Versions ?? []
      if (list.length >= 5) {
        const oldest = [...list].filter((v) => !v.IsDefaultVersion).sort((a, b) => a.CreateDate.localeCompare(b.CreateDate))[0]
        if (oldest) await runQuery('iam', 'delete_policy_version', { PolicyArn: arn, VersionId: oldest.VersionId })
      }
      return runQuery('iam', 'create_policy_version', { PolicyArn: arn, PolicyDocument: JSON.stringify((parsed as any).doc), SetAsDefault: true })
    },
    onSuccess: () => { refresh(); toast.success('New policy version saved and set as default') },
  })
  const setDefault = useMutation({ mutationFn: (v: string) => runQuery('iam', 'set_default_policy_version', { PolicyArn: arn, VersionId: v }), onSuccess: (_r, v) => { refresh(); toast.success(`${v} is now the default version`) } })
  const deleteVersion = useMutation({ mutationFn: (v: string) => runQuery('iam', 'delete_policy_version', { PolicyArn: arn, VersionId: v }), onSuccess: (_r, v) => { refresh(); toast.success(`Version ${v} deleted`) }, onSettled: () => setConfirmVersion(null) })
  const detach = useMutation({
    mutationFn: ({ kind, name }: { kind: 'user' | 'role' | 'group'; name: string }) => runQuery('iam', `detach_${kind}_policy`, { [kind === 'user' ? 'UserName' : kind === 'role' ? 'RoleName' : 'GroupName']: name, PolicyArn: arn }),
    onSuccess: (_r, { name }) => { refresh(); toast.success(`Detached from ${name}`) },
  })
  const remove = useMutation({ mutationFn: () => deletePolicyCompletely(arn), onSuccess: () => { refresh(); toast.success('Policy deleted'); navigate(backTo) }, onSettled: () => setConfirmDelete(false) })

  const ents = entities.data
  const attachedList = [
    ...(ents?.PolicyUsers ?? []).map((u) => ({ kind: 'user' as const, name: u.UserName, href: `/${profile}/access/users/${encodeURIComponent(u.UserName)}` })),
    ...(ents?.PolicyRoles ?? []).map((r) => ({ kind: 'role' as const, name: r.RoleName, href: `/${profile}/access/roles/${encodeURIComponent(r.RoleName)}` })),
    ...(ents?.PolicyGroups ?? []).map((g) => ({ kind: 'group' as const, name: g.GroupName, href: `/${profile}/access/groups/${encodeURIComponent(g.GroupName)}` })),
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary"><ArrowLeft />Back to policies</Button>
      {needsProfile ? <Card title="Policy"><p className="text-sm text-warning">Select an AWS profile from the account menu.</p></Card> : q.isError ? <ErrorAlert error={q.error} /> : !policy ? <Skeleton className="h-24 w-full" /> : (
        <>
          <IamHeader icon={<FileJson className="h-6 w-6" />} title={policy.PolicyName} badge={aws ? <Badge variant="outline">AWS managed</Badge> : <Badge variant="secondary">Customer managed</Badge>}
            subtitle={<>{policy.Description || 'No description'} <span className="px-1 opacity-50">/</span> attached to {policy.AttachmentCount ?? 0} <span className="px-1 opacity-50">/</span> updated {timeAgo(policy.UpdateDate ?? policy.CreateDate)}</>}
            actions={<>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={refresh} disabled={q.isFetching} aria-label="Refresh"><RefreshCw className={cn(q.isFetching && 'animate-spin')} /></Button></TooltipTrigger><TooltipContent>Refresh</TooltipContent></Tooltip>
              <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" disabled={aws} onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button>
            </>} />

          <Card title="Policy document" actions={<span className="text-xs text-muted-foreground">Default version {policy.DefaultVersionId}</span>}>
            <div className="flex flex-col gap-2">
              {doc.isPending ? <Skeleton className="h-48 w-full" /> : doc.isError ? <ErrorAlert error={doc.error} /> : (
                <>
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={aws} rows={18} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" />
                  <span className={parsed && 'error' in parsed ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{parsed ? ('error' in parsed ? parsed.error : policySummary(parsed.doc)) : ''}</span>
                  {!aws && <div><Button size="sm" disabled={!parsed || 'error' in parsed || text === current || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save as new default version'}</Button></div>}
                  {aws && <p className="text-xs text-muted-foreground">AWS managed policies are read-only. Copy this document into a new customer managed policy to customise it.</p>}
                </>
              )}
              {save.isError && <ErrorAlert error={save.error} />}
            </div>
          </Card>

          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y"><Detail label="ARN" value={<CopyText text={policy.Arn} />} mono /><Detail label="Policy ID" value={policy.PolicyId} mono /><Detail label="Created" value={new Date(policy.CreateDate).toLocaleString()} /><Detail label="Path" value={policy.Path} mono /></dl>
            </Card>
            <Card title="Attached to">
              {entities.isPending ? <Skeleton className="h-10 w-full" /> : entities.isError ? <ErrorAlert error={entities.error} /> : attachedList.length === 0 ? <p className="text-sm text-muted-foreground">Not attached to any user, role or group.</p> : (
                <ul className="divide-y">
                  {attachedList.map((e) => (
                    <li key={e.kind + e.name} className="flex items-center gap-3 py-2">
                      <Badge variant="outline" className="w-14 justify-center capitalize">{e.kind}</Badge>
                      <Link to={e.href} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline">{e.name}</Link>
                      <Button variant="ghost" size="icon-sm" aria-label="Detach" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" disabled={detach.isPending} onClick={() => detach.mutate({ kind: e.kind, name: e.name })}><Trash2 /></Button>
                    </li>
                  ))}
                </ul>
              )}
              {detach.isError && <div className="mt-2"><ErrorAlert error={detach.error} /></div>}
            </Card>
            {!aws && (
              <Card title="Versions">
                {versions.isPending ? <Skeleton className="h-10 w-full" /> : (
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-xs uppercase tracking-wide">Version</TableHead><TableHead className="text-xs uppercase tracking-wide">Created</TableHead><TableHead className="text-right text-xs uppercase tracking-wide">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(versions.data?.Versions ?? []).sort((a, b) => b.CreateDate.localeCompare(a.CreateDate)).map((v) => (
                        <TableRow key={v.VersionId}>
                          <TableCell className="font-mono text-xs">{v.VersionId}{v.IsDefaultVersion && <Badge variant="secondary" className="ml-2">default</Badge>}</TableCell>
                          <TableCell>{timeAgo(v.CreateDate)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {!v.IsDefaultVersion && <Button variant="outline" size="xs" disabled={setDefault.isPending} onClick={() => setDefault.mutate(v.VersionId)}>Make default</Button>}
                              {!v.IsDefaultVersion && <Button variant="ghost" size="icon-sm" aria-label="Delete version" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirmVersion(v.VersionId)}><Trash2 /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <p className="mt-2 text-xs text-muted-foreground">IAM keeps up to 5 versions; saving when full removes the oldest non-default one.</p>
              </Card>
            )}
            {!aws && <IamTagsCard entity="policy" id={arn} />}
            {!aws && (
              <Card title="Danger zone">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-sm font-medium">Delete policy</div><div className="text-xs text-muted-foreground">Detached from everything and all versions removed first.</div></div>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
                </div>
              </Card>
            )}
          </div>
          <ConfirmDialog open={confirmDelete} title={`Delete policy “${policy.PolicyName}”?`} description={`It is attached to ${attachedList.length} entit${attachedList.length === 1 ? 'y' : 'ies'}; they lose these permissions.`} confirmLabel="Delete policy" pending={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} />
          <ConfirmDialog open={confirmVersion != null} title={`Delete version ${confirmVersion}?`} description="This cannot be undone." confirmLabel="Delete version" pending={deleteVersion.isPending} onCancel={() => setConfirmVersion(null)} onConfirm={() => confirmVersion && deleteVersion.mutate(confirmVersion)} />
        </>
      )}
    </div>
  )
}
