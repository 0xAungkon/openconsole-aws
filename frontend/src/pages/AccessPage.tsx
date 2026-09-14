import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { CodenameInput } from '../components/CodenameInput'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorAlert } from '../components/ErrorAlert'
import { PolicyPicker } from '../components/iam/PolicyPicker'
import { useManagedPolicies } from '../components/iam/useManagedPolicies'
import { SecretDialog } from '../components/iam/SecretDialog'
import { generateCodename } from '../lib/codename'
import { timeAgo } from '../lib/ec2'
import { POLICY_TEMPLATES, SERVICE_PRINCIPALS, deleteGroupCompletely, deletePolicyCompletely, deleteRoleCompletely, deleteUserCompletely, generatePassword, isAwsManaged, listAll, policyDoc, policySummary, trustPolicyForAccount, trustPolicyForService, trustSummary, validateIamName, validateJsonPolicy, type IamGroup, type IamPolicy, type IamRole, type IamUser } from '../lib/iam'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

type Tab = 'users' | 'roles' | 'groups' | 'policies'
const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'groups', label: 'Groups' },
  { id: 'policies', label: 'Policies' },
]
const PAGE_SIZE = 30
const SINGULAR: Record<Tab, string> = { users: 'user', roles: 'role', groups: 'group', policies: 'policy' }

export function AccessPage() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'users'
  const setTab = (t: Tab) => setParams(t === 'users' ? {} : { tab: t })
  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [policyScope, setPolicyScope] = useState<'Local' | 'All'>('Local')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<{ kind: Tab; id: string; label: string } | null>(null)
  const needsProfile = mode === 'register' && activeProfileId == null

  const summary = useQuery({
    queryKey: ['iam-summary', activeProfileId],
    queryFn: () => runQuery<{ SummaryMap?: Record<string, number> }>('iam', 'get_account_summary', {}),
    enabled: !needsProfile,
    retry: false,
    meta: { silent: true },
  })
  const users = useQuery({ queryKey: ['iam-users', activeProfileId], queryFn: () => listAll<IamUser>('list_users', 'Users'), enabled: !needsProfile && tab === 'users' })
  const roles = useQuery({ queryKey: ['iam-roles-full', activeProfileId], queryFn: () => listAll<IamRole>('list_roles', 'Roles'), enabled: !needsProfile && tab === 'roles' })
  const groups = useQuery({ queryKey: ['iam-groups', activeProfileId], queryFn: () => listAll<IamGroup>('list_groups', 'Groups'), enabled: !needsProfile && tab === 'groups' })
  const policies = useManagedPolicies(policyScope)

  const active = tab === 'users' ? users : tab === 'roles' ? roles : tab === 'groups' ? groups : policies
  const rows: any[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list: any[] = (active.data as any[]) ?? []
    const nameOf = (r: any) => r.UserName ?? r.RoleName ?? r.GroupName ?? r.PolicyName ?? ''
    return list.filter((r) => !q || nameOf(r).toLowerCase().includes(q) || (r.Description ?? '').toLowerCase().includes(q))
  }, [active.data, search])
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  useEffect(() => setPage(1), [search, tab])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['iam-users'] })
    queryClient.invalidateQueries({ queryKey: ['iam-roles-full'] })
    queryClient.invalidateQueries({ queryKey: ['iam-roles'] })
    queryClient.invalidateQueries({ queryKey: ['iam-groups'] })
    queryClient.invalidateQueries({ queryKey: ['iam-policies'] })
    queryClient.invalidateQueries({ queryKey: ['iam-summary'] })
  }

  const remove = useMutation({
    mutationFn: async ({ kind, id }: { kind: Tab; id: string; label: string }) => {
      if (kind === 'users') await deleteUserCompletely(id)
      else if (kind === 'roles') await deleteRoleCompletely(id)
      else if (kind === 'groups') await deleteGroupCompletely(id)
      else await deletePolicyCompletely(id)
    },
    onSuccess: (_r, { label }) => { invalidate(); toast.success(`Deleted ${label}`) },
    onSettled: () => setDeleting(null),
  })

  const s = summary.data?.SummaryMap
  const openRow = (r: any) => {
    if (tab === 'users') navigate(`/${profile}/access/users/${encodeURIComponent(r.UserName)}`)
    else if (tab === 'roles') navigate(`/${profile}/access/roles/${encodeURIComponent(r.RoleName)}`)
    else if (tab === 'groups') navigate(`/${profile}/access/groups/${encodeURIComponent(r.GroupName)}`)
    else navigate(`/${profile}/access/policies/${encodeURIComponent(r.Arn)}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-5 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><KeyRound aria-hidden="true" className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Access management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {s ? `${s.Users ?? 0} users · ${s.Roles ?? 0} roles · ${s.Groups ?? 0} groups · ${s.Policies ?? 0} customer policies` : 'Users, roles, groups and the policies that grant them permissions'}
              {s && s.AccountMFAEnabled === 0 && <Badge className="ml-2 border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Root MFA off</Badge>}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab}`} aria-label={`Search ${tab}`} className="pl-8 sm:w-56" />
          </div>
          {tab === 'policies' && (
            <Select value={policyScope} onValueChange={(v) => setPolicyScope(v as typeof policyScope)}>
              <SelectTrigger className="w-44" aria-label="Policy scope"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Local">Customer managed</SelectItem><SelectItem value="All">All incl. AWS managed</SelectItem></SelectContent>
            </Select>
          )}
          <Tooltip>
            <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={invalidate} disabled={active.isFetching} aria-label="Refresh"><RefreshCw className={cn(active.isFetching && 'animate-spin')} /></Button></TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Button onClick={() => setCreateOpen(true)}><Plus />New {SINGULAR[tab]}</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setCreateOpen(false) }}>
        <TabsList variant="line">{TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="px-3">{t.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 flex-1', createOpen && 'lg:w-[62%]')}>
          {needsProfile ? (
            <Card title="Access"><p className="text-sm text-warning">Select an AWS profile from the account menu to manage access.</p></Card>
          ) : active.isError ? <ErrorAlert error={active.error} /> : active.isPending ? (
            <div className="flex flex-col gap-2 py-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary"><KeyRound className="h-6 w-6" /></div>
              <p className="text-sm font-medium">{search ? `No ${tab} match your search` : `No ${tab} yet`}</p>
              {!search && <Button onClick={() => setCreateOpen(true)}><Plus />New {SINGULAR[tab]}</Button>}
            </div>
          ) : (
            <UiCard className="gap-0 py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 text-xs uppercase tracking-wide">Name</TableHead>
                      {tab === 'users' && <><TableHead className="text-xs uppercase tracking-wide">Last sign-in</TableHead><TableHead className="text-xs uppercase tracking-wide">Created</TableHead></>}
                      {tab === 'roles' && <><TableHead className="text-xs uppercase tracking-wide">Trusted by</TableHead><TableHead className="text-xs uppercase tracking-wide">Last used</TableHead><TableHead className="text-xs uppercase tracking-wide">Created</TableHead></>}
                      {tab === 'groups' && <TableHead className="text-xs uppercase tracking-wide">Created</TableHead>}
                      {tab === 'policies' && <><TableHead className="text-xs uppercase tracking-wide">Type</TableHead><TableHead className="text-xs uppercase tracking-wide">Attached to</TableHead><TableHead className="text-xs uppercase tracking-wide">Updated</TableHead></>}
                      <TableHead className="px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((r: any) => {
                      const name = r.UserName ?? r.RoleName ?? r.GroupName ?? r.PolicyName
                      const id = tab === 'policies' ? r.Arn : name
                      const aws = tab === 'policies' && isAwsManaged(r.Arn)
                      return (
                        <TableRow key={id} onClick={() => openRow(r)} className="cursor-pointer">
                          <TableCell className="px-4">
                            <div className="font-medium">{name}</div>
                            <div className="max-w-md truncate font-mono text-[11px] text-muted-foreground">{r.Description || r.Arn}</div>
                          </TableCell>
                          {tab === 'users' && <><TableCell>{r.PasswordLastUsed ? timeAgo(r.PasswordLastUsed) : <span className="text-muted-foreground">never</span>}</TableCell><TableCell>{timeAgo(r.CreateDate)}</TableCell></>}
                          {tab === 'roles' && <><TableCell className="text-xs">{trustSummary(policyDoc(r.AssumeRolePolicyDocument))}</TableCell><TableCell>{r.RoleLastUsed?.LastUsedDate ? timeAgo(r.RoleLastUsed.LastUsedDate) : <span className="text-muted-foreground">never</span>}</TableCell><TableCell>{timeAgo(r.CreateDate)}</TableCell></>}
                          {tab === 'groups' && <TableCell>{timeAgo(r.CreateDate)}</TableCell>}
                          {tab === 'policies' && <><TableCell>{aws ? <Badge variant="outline">AWS managed</Badge> : <Badge variant="secondary">Customer managed</Badge>}</TableCell><TableCell>{r.AttachmentCount ?? 0} entit{(r.AttachmentCount ?? 0) === 1 ? 'y' : 'ies'}</TableCell><TableCell>{timeAgo(r.UpdateDate ?? r.CreateDate)}</TableCell></>}
                          <TableCell className="px-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); openRow(r) }}>Open</Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" disabled={aws || (remove.isPending && remove.variables?.id === id)} onClick={(e) => { e.stopPropagation(); setDeleting({ kind: tab, id, label: name }) }} aria-label="Delete" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"><Trash2 /></Button>
                                </TooltipTrigger>
                                <TooltipContent>{aws ? 'AWS managed policies cannot be deleted' : 'Delete'}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
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
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[38%]">
            {tab === 'users' && <CreateUserPanel onClose={() => setCreateOpen(false)} onCreated={(n) => { invalidate(); setCreateOpen(false); navigate(`/${profile}/access/users/${encodeURIComponent(n)}`) }} />}
            {tab === 'roles' && <CreateRolePanel onClose={() => setCreateOpen(false)} onCreated={(n) => { invalidate(); setCreateOpen(false); navigate(`/${profile}/access/roles/${encodeURIComponent(n)}`) }} />}
            {tab === 'groups' && <CreateGroupPanel onClose={() => setCreateOpen(false)} onCreated={(n) => { invalidate(); setCreateOpen(false); navigate(`/${profile}/access/groups/${encodeURIComponent(n)}`) }} />}
            {tab === 'policies' && <CreatePolicyPanel onClose={() => setCreateOpen(false)} onCreated={(arn) => { invalidate(); setCreateOpen(false); navigate(`/${profile}/access/policies/${encodeURIComponent(arn)}`) }} />}
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={deleting != null}
        title={`Delete ${deleting ? SINGULAR[deleting.kind] : ''} “${deleting?.label}”?`}
        description={deleting?.kind === 'users' ? 'Access keys, console password, group memberships and policies are removed first.' : deleting?.kind === 'roles' ? 'Attached and inline policies are removed first. Anything assuming this role will stop working.' : deleting?.kind === 'groups' ? 'Members are removed from the group and its policies detached first.' : 'All versions are deleted and it is detached from every user, role and group first.'}
        confirmLabel="Delete"
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

/* ---------------- create panels ---------------- */

function PanelShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <UiCard className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><span className="inline-block h-4 w-[3px] rounded-full bg-primary" />{title}</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-muted-foreground"><X /></Button>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </UiCard>
  )
}

function PoliciesToAttach({ value, onChange }: { value: string[]; onChange: (arns: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const all = useManagedPolicies('All')
  const nameOf = (arn: string) => all.data?.find((p) => p.Arn === arn)?.PolicyName ?? arn.split('/').pop()
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Permissions</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((arn) => (
          <Badge key={arn} variant="secondary" className="h-auto gap-1 rounded-md py-1 font-normal">{nameOf(arn)}<button type="button" onClick={() => onChange(value.filter((a) => a !== arn))} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button></Badge>
        ))}
        <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)}><Plus />Attach policy</Button>
      </div>
      <span className="text-xs text-muted-foreground">{value.length ? '' : 'No permissions yet — you can also add them later.'}</span>
      <PolicyPicker open={open} exclude={value} pending={false} onClose={() => setOpen(false)} onAttach={(arns) => { onChange([...value, ...arns]); setOpen(false) }} />
    </div>
  )
}

function CreateUserPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState(generateCodename)
  const [consoleAccess, setConsoleAccess] = useState(false)
  const [password, setPassword] = useState(generatePassword)
  const [showPw, setShowPw] = useState(false)
  const [mustReset, setMustReset] = useState(true)
  const [accessKey, setAccessKey] = useState(false)
  const [policies, setPolicies] = useState<string[]>([])
  const [secret, setSecret] = useState<{ fields: { label: string; value: string }[]; user: string } | null>(null)
  const problem = validateIamName(name.trim())
  const create = useMutation({
    mutationFn: async () => {
      const UserName = name.trim()
      await runQuery('iam', 'create_user', { UserName, Tags: [{ Key: 'Name', Value: UserName }] })
      for (const arn of policies) await runQuery('iam', 'attach_user_policy', { UserName, PolicyArn: arn })
      const fields: { label: string; value: string }[] = []
      if (consoleAccess) {
        await runQuery('iam', 'create_login_profile', { UserName, Password: password, PasswordResetRequired: mustReset })
        fields.push({ label: 'Username', value: UserName }, { label: 'Console password', value: password })
      }
      if (accessKey) {
        const k = await runQuery<{ AccessKey: { AccessKeyId: string; SecretAccessKey: string } }>('iam', 'create_access_key', { UserName })
        fields.push({ label: 'Access key ID', value: k.AccessKey.AccessKeyId }, { label: 'Secret access key', value: k.AccessKey.SecretAccessKey })
      }
      return { UserName, fields }
    },
    onSuccess: ({ UserName, fields }) => {
      toast.success(`User “${UserName}” created`)
      if (fields.length) setSecret({ fields, user: UserName })
      else onCreated(UserName)
    },
  })
  return (
    <PanelShell title="Create a new user" onClose={onClose}>
      {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
      <form onSubmit={(e) => { e.preventDefault(); if (!problem) create.mutate() }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="user-name">User name <span className="text-destructive">*</span></Label><CodenameInput id="user-name" value={name} required onChange={setName} />{name && problem && <span className="text-xs text-destructive">{problem}</span>}</div>
        <PoliciesToAttach value={policies} onChange={setPolicies} />
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div><Label htmlFor="user-console">Console sign-in</Label><p className="mt-0.5 text-xs text-muted-foreground">Let this user sign in to the AWS web console with a password.</p></div>
          <Switch id="user-console" checked={consoleAccess} onCheckedChange={setConsoleAccess} />
        </div>
        {consoleAccess && (
          <div className="flex flex-col gap-2 pl-1">
            <Label htmlFor="user-password">Password</Label>
            <div className="flex items-center gap-2">
              <Input id="user-password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff /> : <Eye />}</Button>
              <Button type="button" variant="outline" size="icon" onClick={() => { setPassword(generatePassword()); setShowPw(true) }} aria-label="Generate password"><RefreshCw /></Button>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={mustReset} onCheckedChange={(v) => setMustReset(!!v)} />Require a new password at first sign-in</label>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div><Label htmlFor="user-key">Programmatic access</Label><p className="mt-0.5 text-xs text-muted-foreground">Create an access key pair for the CLI/SDKs. Shown once after creation.</p></div>
          <Switch id="user-key" checked={accessKey} onCheckedChange={setAccessKey} />
        </div>
        <Button type="submit" disabled={!!problem || create.isPending}>{create.isPending ? 'Creating…' : 'Create user'}</Button>
      </form>
      <SecretDialog open={secret != null} title="Save these credentials" description={`Credentials for user “${secret?.user}”.`} fields={secret?.fields ?? []} filename={`${secret?.user}-credentials.txt`} onClose={() => { const u = secret!.user; setSecret(null); onCreated(u) }} />
    </PanelShell>
  )
}

function CreateRolePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState(generateCodename)
  const [trust, setTrust] = useState<'service' | 'account' | 'custom'>('service')
  const [service, setService] = useState(SERVICE_PRINCIPALS[0].id)
  const [account, setAccount] = useState('')
  const [custom, setCustom] = useState(JSON.stringify(trustPolicyForService('lambda.amazonaws.com'), null, 2))
  const [description, setDescription] = useState('')
  const [policies, setPolicies] = useState<string[]>([])
  const problem = validateIamName(name.trim())
  const trustDoc = trust === 'service' ? { doc: trustPolicyForService(service) } : trust === 'account' ? (/^\d{12}$/.test(account.trim()) ? { doc: trustPolicyForAccount(account.trim()) } : { error: 'Account ID must be 12 digits.' }) : validateJsonPolicy(custom)
  const create = useMutation({
    mutationFn: async () => {
      const RoleName = name.trim()
      await runQuery('iam', 'create_role', { RoleName, AssumeRolePolicyDocument: JSON.stringify((trustDoc as any).doc), ...(description.trim() ? { Description: description.trim() } : {}), Tags: [{ Key: 'Name', Value: RoleName }] })
      for (const arn of policies) await runQuery('iam', 'attach_role_policy', { RoleName, PolicyArn: arn })
      if (trust === 'service' && service === 'ec2.amazonaws.com') {
        // EC2 needs an instance profile to actually use the role.
        try {
          await runQuery('iam', 'create_instance_profile', { InstanceProfileName: RoleName })
          await runQuery('iam', 'add_role_to_instance_profile', { InstanceProfileName: RoleName, RoleName })
        } catch { /* best effort */ }
      }
      return RoleName
    },
    onSuccess: (n) => { toast.success(`Role “${n}” created`); onCreated(n) },
  })
  return (
    <PanelShell title="Create a new role" onClose={onClose}>
      {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
      <form onSubmit={(e) => { e.preventDefault(); if (!problem && 'doc' in trustDoc) create.mutate() }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="role-name">Role name <span className="text-destructive">*</span></Label><CodenameInput id="role-name" value={name} required onChange={setName} />{name && problem && <span className="text-xs text-destructive">{problem}</span>}</div>
        <div className="flex flex-col gap-1.5">
          <Label>Who can use this role</Label>
          <Tabs value={trust} onValueChange={(v) => setTrust(v as typeof trust)}><TabsList className="w-full"><TabsTrigger value="service">AWS service</TabsTrigger><TabsTrigger value="account">Another account</TabsTrigger><TabsTrigger value="custom">Custom JSON</TabsTrigger></TabsList></Tabs>
        </div>
        {trust === 'service' && (
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{SERVICE_PRINCIPALS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} <span className="text-muted-foreground">({s.id})</span></SelectItem>)}</SelectContent>
          </Select>
        )}
        {trust === 'account' && <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="123456789012" className="font-mono text-xs" />}
        {trust === 'custom' && <Textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={10} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs whitespace-pre" />}
        {'error' in trustDoc && <span className="text-xs text-destructive">{trustDoc.error}</span>}
        <PoliciesToAttach value={policies} onChange={setPolicies} />
        <div className="flex flex-col gap-1.5"><Label htmlFor="role-desc">Description</Label><Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></div>
        <Button type="submit" disabled={!!problem || 'error' in trustDoc || create.isPending}>{create.isPending ? 'Creating…' : 'Create role'}</Button>
      </form>
    </PanelShell>
  )
}

function CreateGroupPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState(generateCodename)
  const [policies, setPolicies] = useState<string[]>([])
  const problem = validateIamName(name.trim())
  const create = useMutation({
    mutationFn: async () => {
      const GroupName = name.trim()
      await runQuery('iam', 'create_group', { GroupName })
      for (const arn of policies) await runQuery('iam', 'attach_group_policy', { GroupName, PolicyArn: arn })
      return GroupName
    },
    onSuccess: (n) => { toast.success(`Group “${n}” created`); onCreated(n) },
  })
  return (
    <PanelShell title="Create a new group" onClose={onClose}>
      {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
      <form onSubmit={(e) => { e.preventDefault(); if (!problem) create.mutate() }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="group-name">Group name <span className="text-destructive">*</span></Label><CodenameInput id="group-name" value={name} required onChange={setName} />{name && problem && <span className="text-xs text-destructive">{problem}</span>}</div>
        <p className="text-xs text-muted-foreground">Groups bundle permissions: every user you add inherits the group's policies.</p>
        <PoliciesToAttach value={policies} onChange={setPolicies} />
        <Button type="submit" disabled={!!problem || create.isPending}>{create.isPending ? 'Creating…' : 'Create group'}</Button>
      </form>
    </PanelShell>
  )
}

function CreatePolicyPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (arn: string) => void }) {
  const [name, setName] = useState(generateCodename)
  const [description, setDescription] = useState('')
  const [text, setText] = useState(JSON.stringify(POLICY_TEMPLATES[0].doc, null, 2))
  const problem = validateIamName(name.trim())
  const parsed = validateJsonPolicy(text)
  const create = useMutation({
    mutationFn: async () => {
      const r = await runQuery<{ Policy: IamPolicy }>('iam', 'create_policy', { PolicyName: name.trim(), PolicyDocument: JSON.stringify((parsed as any).doc), ...(description.trim() ? { Description: description.trim() } : {}) })
      return r.Policy
    },
    onSuccess: (p) => { toast.success(`Policy “${p.PolicyName}” created`); onCreated(p.Arn) },
  })
  return (
    <PanelShell title="Create a new policy" onClose={onClose}>
      {create.isError && <div className="mb-3"><ErrorAlert error={create.error} /></div>}
      <form onSubmit={(e) => { e.preventDefault(); if (!problem && 'doc' in parsed) create.mutate() }} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="policy-name">Policy name <span className="text-destructive">*</span></Label><CodenameInput id="policy-name" value={name} required onChange={setName} />{name && problem && <span className="text-xs text-destructive">{problem}</span>}</div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="policy-desc">Description</Label><Input id="policy-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between"><Label htmlFor="policy-doc">Policy document (JSON)</Label>
            <select className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs" onChange={(e) => { const t = POLICY_TEMPLATES.find((x) => x.id === e.target.value); if (t) setText(JSON.stringify(t.doc, null, 2)) }} aria-label="Template">
              {POLICY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <Textarea id="policy-doc" value={text} onChange={(e) => setText(e.target.value)} rows={14} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" />
          <span className={'error' in parsed ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{'error' in parsed ? parsed.error : policySummary(parsed.doc)}</span>
        </div>
        <Button type="submit" disabled={!!problem || 'error' in parsed || create.isPending}>{create.isPending ? 'Creating…' : 'Create policy'}</Button>
      </form>
    </PanelShell>
  )
}
