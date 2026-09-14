import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, Plus, RefreshCw, Trash2, UserRound, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { IamTagsCard } from '../components/iam/IamTagsCard'
import { PermissionsCard } from '../components/iam/PermissionsCard'
import { SecretDialog } from '../components/iam/SecretDialog'
import { timeAgo } from '../lib/ec2'
import { errorMessage } from '../lib/errors'
import { deleteUserCompletely, generatePassword, type IamGroup, type IamUser } from '../lib/iam'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { CopyText, Detail, IamHeader } from './IamDetailShared'

export function IamUserPage() {
  const { profile, name = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/access`

  const q = useQuery({
    queryKey: ['iam-user', name, activeProfileId],
    queryFn: () => runQuery<{ User: IamUser }>('iam', 'get_user', { UserName: name }),
    enabled: !needsProfile && !!name,
  })
  const user = q.data?.User
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('iam-') })
  const remove = useMutation({
    mutationFn: () => deleteUserCompletely(name),
    onSuccess: () => { refresh(); toast.success(`User “${name}” deleted`); navigate(backTo) },
    onSettled: () => setConfirmDelete(false),
  })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary"><ArrowLeft />Back to access</Button>
      {needsProfile ? <Card title="User"><p className="text-sm text-warning">Select an AWS profile from the account menu.</p></Card> : q.isError ? <ErrorAlert error={q.error} /> : !user ? <Skeleton className="h-24 w-full" /> : (
        <>
          <IamHeader
            icon={<UserRound className="h-6 w-6" />}
            title={user.UserName}
            subtitle={<>Created {timeAgo(user.CreateDate)} <span className="px-1 opacity-50">/</span> last console sign-in {user.PasswordLastUsed ? timeAgo(user.PasswordLastUsed) : 'never'}</>}
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
                <Detail label="ARN" value={<CopyText text={user.Arn} />} mono />
                <Detail label="User ID" value={user.UserId} mono />
                <Detail label="Path" value={user.Path} mono />
                <Detail label="Created" value={new Date(user.CreateDate).toLocaleString()} />
              </dl>
            </Card>
            <PermissionsCard entity="user" name={name} />
            <GroupsCard name={name} />
            <AccessKeysCard name={name} />
            <ConsoleAccessCard name={name} />
            <IamTagsCard entity="user" id={name} />
            <Card title="Danger zone">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-medium">Delete user</div><div className="text-xs text-muted-foreground">Removes keys, password, group memberships and policies, then the user.</div></div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
              </div>
            </Card>
          </div>
          <ConfirmDialog open={confirmDelete} title={`Delete user “${name}”?`} description="All access keys and the console password stop working immediately." confirmLabel="Delete user" pending={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} />
        </>
      )}
    </div>
  )
}

function GroupsCard({ name }: { name: string }) {
  const qc = useQueryClient()
  const { profile } = useParams()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [pick, setPick] = useState('')
  const mine = useQuery({ queryKey: ['iam-user-groups', name, activeProfileId], queryFn: () => runQuery<{ Groups?: IamGroup[] }>('iam', 'list_groups_for_user', { UserName: name }), retry: false })
  const all = useQuery({ queryKey: ['iam-groups', activeProfileId], queryFn: () => runQuery<{ Groups?: IamGroup[] }>('iam', 'list_groups', { MaxItems: 1000 }).then((r) => r.Groups ?? []), retry: false })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['iam-user-groups', name] })
  const add = useMutation({ mutationFn: (g: string) => runQuery('iam', 'add_user_to_group', { UserName: name, GroupName: g }), onSuccess: (_r, g) => { invalidate(); setPick(''); toast.success(`Added to group “${g}”`) } })
  const remove = useMutation({ mutationFn: (g: string) => runQuery('iam', 'remove_user_from_group', { UserName: name, GroupName: g }), onSuccess: (_r, g) => { invalidate(); toast.success(`Removed from group “${g}”`) } })
  const groups = mine.data?.Groups ?? []
  const available = (all.data ?? []).filter((g) => !groups.some((x) => x.GroupName === g.GroupName))
  return (
    <Card title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Groups</span>}>
      <div className="flex flex-col gap-3">
        {mine.isPending ? <Skeleton className="h-8 w-full" /> : groups.length === 0 ? <p className="text-sm text-muted-foreground">Not a member of any group. Group policies also apply to members.</p> : (
          <ul className="divide-y">
            {groups.map((g) => (
              <li key={g.GroupName} className="flex items-center gap-3 py-2">
                <Link to={`/${profile}/access/groups/${encodeURIComponent(g.GroupName)}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline">{g.GroupName}</Link>
                <Button variant="ghost" size="icon-sm" aria-label="Remove from group" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" disabled={remove.isPending} onClick={() => remove.mutate(g.GroupName)}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}
        {available.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Add to a group…" /></SelectTrigger>
              <SelectContent>{available.map((g) => <SelectItem key={g.GroupName} value={g.GroupName}>{g.GroupName}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" disabled={!pick || add.isPending} onClick={() => add.mutate(pick)}><Plus />Add</Button>
          </div>
        )}
        {(add.isError || remove.isError) && <ErrorAlert error={add.error || remove.error} />}
      </div>
    </Card>
  )
}

function AccessKeysCard({ name }: { name: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [secret, setSecret] = useState<{ id: string; secret: string } | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['iam-keys', name, activeProfileId],
    queryFn: async () => {
      const r = await runQuery<{ AccessKeyMetadata?: { AccessKeyId: string; Status: string; CreateDate: string }[] }>('iam', 'list_access_keys', { UserName: name })
      const keys = r.AccessKeyMetadata ?? []
      const used = await Promise.all(keys.map((k) => runQuery<{ AccessKeyLastUsed?: { LastUsedDate?: string; ServiceName?: string } }>('iam', 'get_access_key_last_used', { AccessKeyId: k.AccessKeyId }).then((u) => u.AccessKeyLastUsed).catch(() => undefined)))
      return keys.map((k, i) => ({ ...k, lastUsed: used[i] }))
    },
    retry: false,
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['iam-keys', name] })
  const create = useMutation({
    mutationFn: () => runQuery<{ AccessKey: { AccessKeyId: string; SecretAccessKey: string } }>('iam', 'create_access_key', { UserName: name }),
    onSuccess: (r) => { invalidate(); setSecret({ id: r.AccessKey.AccessKeyId, secret: r.AccessKey.SecretAccessKey }) },
  })
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Active' | 'Inactive' }) => runQuery('iam', 'update_access_key', { UserName: name, AccessKeyId: id, Status: status }),
    onSuccess: (_r, { id, status }) => { invalidate(); toast.success(`${id} is now ${status.toLowerCase()}`) },
  })
  const remove = useMutation({
    mutationFn: (id: string) => runQuery('iam', 'delete_access_key', { UserName: name, AccessKeyId: id }),
    onSuccess: (_r, id) => { invalidate(); toast.success(`Access key ${id} deleted`) },
    onSettled: () => setConfirm(null),
  })
  const keys = q.data ?? []
  return (
    <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />Access keys</span>} actions={<Button size="xs" disabled={keys.length >= 2 || create.isPending} onClick={() => create.mutate()}><Plus />{create.isPending ? 'Creating…' : 'Create key'}</Button>}>
      <p className="mb-3 text-xs text-muted-foreground">Long-term credentials for the CLI and SDKs. A user can have at most two — rotate by creating a new one, then deleting the old.</p>
      {q.isPending ? <Skeleton className="h-10 w-full" /> : q.isError ? <ErrorAlert error={q.error} /> : keys.length === 0 ? <p className="text-sm text-muted-foreground">No access keys.</p> : (
        <ul className="divide-y">
          {keys.map((k) => (
            <li key={k.AccessKeyId} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-mono text-xs">{k.AccessKeyId}<Badge variant="secondary" className={cn('border-transparent', k.Status === 'Active' ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300' : 'bg-muted text-muted-foreground')}>{k.Status}</Badge></div>
                <div className="text-[11px] text-muted-foreground">created {timeAgo(k.CreateDate)} · last used {k.lastUsed?.LastUsedDate ? `${timeAgo(k.lastUsed.LastUsedDate)}${k.lastUsed.ServiceName && k.lastUsed.ServiceName !== 'N/A' ? ` (${k.lastUsed.ServiceName})` : ''}` : 'never'}</div>
              </div>
              <Switch checked={k.Status === 'Active'} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: k.AccessKeyId, status: v ? 'Active' : 'Inactive' })} aria-label="Key active" />
              <Button variant="ghost" size="icon-sm" aria-label="Delete key" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirm(k.AccessKeyId)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      {(create.isError || toggle.isError) && <div className="mt-2"><ErrorAlert error={create.error || toggle.error} /></div>}
      <SecretDialog open={secret != null} title="New access key" description={`Access key for user “${name}”.`} fields={secret ? [{ label: 'Access key ID', value: secret.id }, { label: 'Secret access key', value: secret.secret }] : []} filename={`${name}-access-key.txt`} onClose={() => setSecret(null)} />
      <ConfirmDialog open={confirm != null} title={`Delete access key ${confirm}?`} description="Anything using this key stops working immediately. Deactivate it first if you're not sure." confirmLabel="Delete key" pending={remove.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm && remove.mutate(confirm)} />
    </Card>
  )
}

function ConsoleAccessCard({ name }: { name: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [pwOpen, setPwOpen] = useState(false)
  const [reset, setReset] = useState(true)
  const [secret, setSecret] = useState<string | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const q = useQuery({
    queryKey: ['iam-login', name, activeProfileId],
    queryFn: async () => {
      try {
        const r = await runQuery<{ LoginProfile: { CreateDate: string; PasswordResetRequired?: boolean } }>('iam', 'get_login_profile', { UserName: name })
        return r.LoginProfile
      } catch (err) {
        if (errorMessage(err).includes('NoSuchEntity')) return null
        throw err
      }
    },
    retry: false,
  })
  const mfa = useQuery({ queryKey: ['iam-mfa', name, activeProfileId], queryFn: () => runQuery<{ MFADevices?: { SerialNumber: string; EnableDate: string }[] }>('iam', 'list_mfa_devices', { UserName: name }), retry: false, meta: { silent: true } })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['iam-login', name] })
  const setPassword = useMutation({
    mutationFn: async () => {
      const Password = generatePassword()
      await runQuery('iam', q.data ? 'update_login_profile' : 'create_login_profile', { UserName: name, Password, PasswordResetRequired: reset })
      return Password
    },
    onSuccess: (pw) => { invalidate(); setPwOpen(false); setSecret(pw) },
  })
  const disable = useMutation({
    mutationFn: () => runQuery('iam', 'delete_login_profile', { UserName: name }),
    onSuccess: () => { invalidate(); toast.success('Console sign-in disabled') },
    onSettled: () => setConfirmOff(false),
  })
  const enabled = !!q.data
  const devices = mfa.data?.MFADevices ?? []
  return (
    <Card title="Console sign-in">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{q.isPending ? 'Loading…' : enabled ? 'Enabled' : 'Disabled'}</div>
            <p className="text-xs text-muted-foreground">{enabled ? `Password set ${timeAgo(q.data!.CreateDate)}${q.data!.PasswordResetRequired ? ' · reset required at next sign-in' : ''}` : 'This user cannot sign in to the AWS web console.'}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={enabled ? 'outline' : 'default'} onClick={() => setPwOpen(true)}>{enabled ? 'Reset password' : 'Enable'}</Button>
            {enabled && <Button size="sm" variant="ghost" onClick={() => setConfirmOff(true)}>Disable</Button>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">MFA: {mfa.isPending ? '…' : devices.length ? `${devices.length} device${devices.length === 1 ? '' : 's'} (${devices.map((d) => d.SerialNumber.split('/').pop()).join(', ')})` : <span className="text-warning">not enabled</span>}</div>
        {q.isError && <ErrorAlert error={q.error} />}
        {(setPassword.isError || disable.isError) && <ErrorAlert error={setPassword.error || disable.error} />}
      </div>
      <Dialog open={pwOpen} onOpenChange={(o) => !o && setPwOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{enabled ? 'Reset console password' : 'Enable console sign-in'}</DialogTitle><DialogDescription>A strong password is generated and shown once.</DialogDescription></DialogHeader>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span><Label htmlFor="pw-reset">Require a new password at next sign-in</Label></span><Switch id="pw-reset" checked={reset} onCheckedChange={setReset} /></label>
          <DialogFooter><Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button><Button onClick={() => setPassword.mutate()} disabled={setPassword.isPending}>{setPassword.isPending ? 'Saving…' : 'Generate password'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <SecretDialog open={secret != null} title="Console password" description={`Sign-in password for “${name}”.`} fields={secret ? [{ label: 'Username', value: name }, { label: 'Password', value: secret }] : []} filename={`${name}-console-password.txt`} onClose={() => setSecret(null)} />
      <ConfirmDialog open={confirmOff} title="Disable console sign-in?" description="The password is deleted. Access keys are not affected." confirmLabel="Disable" pending={disable.isPending} onCancel={() => setConfirmOff(false)} onConfirm={() => disable.mutate()} />
    </Card>
  )
}
