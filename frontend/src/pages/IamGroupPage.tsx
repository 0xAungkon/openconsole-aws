import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { PermissionsCard } from '../components/iam/PermissionsCard'
import { timeAgo } from '../lib/ec2'
import { deleteGroupCompletely, type IamGroup, type IamUser } from '../lib/iam'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { CopyText, Detail, IamHeader } from './IamDetailShared'

export function IamGroupPage() {
  const { profile, name = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pick, setPick] = useState('')
  const needsProfile = mode === 'register' && activeProfileId == null
  const backTo = `/${profile}/access?tab=groups`

  const q = useQuery({ queryKey: ['iam-group', name, activeProfileId], queryFn: () => runQuery<{ Group: IamGroup; Users?: IamUser[] }>('iam', 'get_group', { GroupName: name, MaxItems: 1000 }), enabled: !needsProfile && !!name })
  const allUsers = useQuery({ queryKey: ['iam-users', activeProfileId], queryFn: () => runQuery<{ Users?: IamUser[] }>('iam', 'list_users', { MaxItems: 1000 }).then((r) => r.Users ?? []), retry: false })
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('iam-') })
  const add = useMutation({ mutationFn: (u: string) => runQuery('iam', 'add_user_to_group', { GroupName: name, UserName: u }), onSuccess: (_r, u) => { qc.invalidateQueries({ queryKey: ['iam-group', name] }); setPick(''); toast.success(`Added “${u}”`) } })
  const removeUser = useMutation({ mutationFn: (u: string) => runQuery('iam', 'remove_user_from_group', { GroupName: name, UserName: u }), onSuccess: (_r, u) => { qc.invalidateQueries({ queryKey: ['iam-group', name] }); toast.success(`Removed “${u}”`) } })
  const remove = useMutation({ mutationFn: () => deleteGroupCompletely(name), onSuccess: () => { refresh(); toast.success(`Group “${name}” deleted`); navigate(backTo) }, onSettled: () => setConfirmDelete(false) })
  const group = q.data?.Group
  const members = q.data?.Users ?? []
  const available = (allUsers.data ?? []).filter((u) => !members.some((m) => m.UserName === u.UserName))

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Button variant="link" onClick={() => navigate(backTo)} className="w-fit px-0 text-muted-foreground hover:text-primary"><ArrowLeft />Back to groups</Button>
      {needsProfile ? <Card title="Group"><p className="text-sm text-warning">Select an AWS profile from the account menu.</p></Card> : q.isError ? <ErrorAlert error={q.error} /> : !group ? <Skeleton className="h-24 w-full" /> : (
        <>
          <IamHeader icon={<Users className="h-6 w-6" />} title={group.GroupName} subtitle={<>{members.length} member{members.length === 1 ? '' : 's'} <span className="px-1 opacity-50">/</span> created {timeAgo(group.CreateDate)}</>}
            actions={<>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={refresh} disabled={q.isFetching} aria-label="Refresh"><RefreshCw className={cn(q.isFetching && 'animate-spin')} /></Button></TooltipTrigger><TooltipContent>Refresh</TooltipContent></Tooltip>
              <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button>
            </>} />
          <div className="columns-1 gap-5 lg:columns-2 [&>div]:mb-5 [&>div]:break-inside-avoid">
            <Card title="Overview">
              <dl className="divide-y"><Detail label="ARN" value={<CopyText text={group.Arn} />} mono /><Detail label="Group ID" value={group.GroupId} mono /><Detail label="Created" value={new Date(group.CreateDate).toLocaleString()} /></dl>
            </Card>
            <Card title="Members">
              <div className="flex flex-col gap-3">
                {members.length === 0 ? <p className="text-sm text-muted-foreground">No members yet. Users in this group inherit its permissions.</p> : (
                  <ul className="divide-y">
                    {members.map((u) => (
                      <li key={u.UserName} className="flex items-center gap-3 py-2">
                        <Link to={`/${profile}/access/users/${encodeURIComponent(u.UserName)}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline">{u.UserName}</Link>
                        <Button variant="ghost" size="icon-sm" aria-label="Remove member" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" disabled={removeUser.isPending} onClick={() => removeUser.mutate(u.UserName)}><Trash2 /></Button>
                      </li>
                    ))}
                  </ul>
                )}
                {available.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={pick} onValueChange={setPick}><SelectTrigger className="flex-1"><SelectValue placeholder="Add a user…" /></SelectTrigger><SelectContent>{available.map((u) => <SelectItem key={u.UserName} value={u.UserName}>{u.UserName}</SelectItem>)}</SelectContent></Select>
                    <Button size="sm" disabled={!pick || add.isPending} onClick={() => add.mutate(pick)}><Plus />Add</Button>
                  </div>
                )}
                {(add.isError || removeUser.isError) && <ErrorAlert error={add.error || removeUser.error} />}
              </div>
            </Card>
            <PermissionsCard entity="group" name={name} />
            <Card title="Danger zone">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-medium">Delete group</div><div className="text-xs text-muted-foreground">Members lose the group's permissions; the users themselves are kept.</div></div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
              </div>
            </Card>
          </div>
          <ConfirmDialog open={confirmDelete} title={`Delete group “${name}”?`} description="This cannot be undone." confirmLabel="Delete group" pending={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} />
        </>
      )}
    </div>
  )
}
