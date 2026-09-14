import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Handshake, RefreshCw, ShieldEllipsis, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { IamTagsCard } from '../components/iam/IamTagsCard'
import { PermissionsCard } from '../components/iam/PermissionsCard'
import { timeAgo } from '../lib/ec2'
import { deleteRoleCompletely, policyDoc, trustSummary, validateJsonPolicy, type IamRole } from '../lib/iam'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { CopyText, Detail, IamHeader } from './IamDetailShared'

export function IamRolePage() {
  const { profile, name = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/access?tab=roles`

  const q = useQuery({ queryKey: ['iam-role', name, activeProfileId], queryFn: () => runQuery<{ Role: IamRole }>('iam', 'get_role', { RoleName: name }), enabled: !needsProfile && !!name })
  const role = q.data?.Role
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('iam-') })
  const remove = useMutation({ mutationFn: () => deleteRoleCompletely(name), onSuccess: () => { refresh(); toast.success(`Role “${name}” deleted`); navigate(backTo) }, onSettled: () => setConfirmDelete(false) })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary"><ArrowLeft />Back to roles</Button>
      {needsProfile ? <Card title="Role"><p className="text-sm text-warning">Select an AWS profile from the account menu.</p></Card> : q.isError ? <ErrorAlert error={q.error} /> : !role ? <Skeleton className="h-24 w-full" /> : (
        <>
          <IamHeader
            icon={<ShieldEllipsis className="h-6 w-6" />}
            title={role.RoleName}
            subtitle={<>Trusted by {trustSummary(policyDoc(role.AssumeRolePolicyDocument))} <span className="px-1 opacity-50">/</span> last used {role.RoleLastUsed?.LastUsedDate ? `${timeAgo(role.RoleLastUsed.LastUsedDate)} in ${role.RoleLastUsed.Region}` : 'never'}</>}
            actions={
              <>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={refresh} disabled={q.isFetching} aria-label="Refresh"><RefreshCw className={cn(q.isFetching && 'animate-spin')} /></Button></TooltipTrigger><TooltipContent>Refresh</TooltipContent></Tooltip>
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button>
              </>
            }
          />
          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y">
                <Detail label="ARN" value={<CopyText text={role.Arn} />} mono />
                <Detail label="Role ID" value={role.RoleId} mono />
                <Detail label="Created" value={new Date(role.CreateDate).toLocaleString()} />
                <Detail label="Description" value={role.Description || '—'} />
              </dl>
            </Card>
            <PermissionsCard entity="role" name={name} />
            <TrustCard role={role} />
            <SettingsCard role={role} />
            <IamTagsCard entity="role" id={name} />
            <Card title="Danger zone">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-medium">Delete role</div><div className="text-xs text-muted-foreground">Policies are detached first; anything assuming the role will fail.</div></div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
              </div>
            </Card>
          </div>
          <ConfirmDialog open={confirmDelete} title={`Delete role “${name}”?`} description="This cannot be undone." confirmLabel="Delete role" pending={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} />
        </>
      )}
    </div>
  )
}

function TrustCard({ role }: { role: IamRole }) {
  const qc = useQueryClient()
  const current = JSON.stringify(policyDoc(role.AssumeRolePolicyDocument), null, 2)
  const [text, setText] = useState(current)
  useEffect(() => setText(current), [current])
  const parsed = validateJsonPolicy(text)
  const m = useMutation({
    mutationFn: () => runQuery('iam', 'update_assume_role_policy', { RoleName: role.RoleName, PolicyDocument: JSON.stringify((parsed as any).doc) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iam-role', role.RoleName] }); toast.success('Trust policy updated') },
  })
  return (
    <Card title={<span className="flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" />Trust policy</span>}>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Defines who is allowed to assume this role — currently: <span className="font-medium text-foreground">{trustSummary(policyDoc(role.AssumeRolePolicyDocument))}</span>.</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" />
        {'error' in parsed && <span className="text-xs text-destructive">{parsed.error}</span>}
        <div><Button size="sm" disabled={'error' in parsed || text === current || m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Saving…' : 'Save trust policy'}</Button></div>
        {m.isError && <ErrorAlert error={m.error} />}
      </div>
    </Card>
  )
}

function SettingsCard({ role }: { role: IamRole }) {
  const qc = useQueryClient()
  const [description, setDescription] = useState(role.Description ?? '')
  const [hours, setHours] = useState(String((role.MaxSessionDuration ?? 3600) / 3600))
  useEffect(() => { setDescription(role.Description ?? ''); setHours(String((role.MaxSessionDuration ?? 3600) / 3600)) }, [role.Description, role.MaxSessionDuration])
  const changed = description !== (role.Description ?? '') || Number(hours) * 3600 !== (role.MaxSessionDuration ?? 3600)
  const m = useMutation({
    mutationFn: () => runQuery('iam', 'update_role', { RoleName: role.RoleName, Description: description, MaxSessionDuration: Math.round(Number(hours) * 3600) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iam-role', role.RoleName] }); toast.success('Role settings saved') },
  })
  return (
    <Card title="Settings">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate() }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="role-desc">Description</Label><Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="role-session">Maximum session duration (hours)</Label><Input id="role-session" type="number" min={1} max={12} step={1} value={hours} onChange={(e) => setHours(e.target.value)} className="w-32" /><span className="text-xs text-muted-foreground">How long credentials from assuming this role stay valid (1–12 h).</span></div>
        <div><Button type="submit" size="sm" disabled={!changed || m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</Button></div>
        {m.isError && <ErrorAlert error={m.error} />}
      </form>
    </Card>
  )
}
