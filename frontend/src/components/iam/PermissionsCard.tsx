import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileJson, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { runQuery } from '../../api/proxy'
import { POLICY_TEMPLATES, isAwsManaged, policyDoc, policySummary, validateJsonPolicy } from '../../lib/iam'
import { useSessionStore } from '../../store/sessionStore'
import { Card } from '../Card'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorAlert } from '../ErrorAlert'
import { PolicyPicker } from './PolicyPicker'

type Entity = 'user' | 'role' | 'group'
const OPS: Record<Entity, { list: string; attach: string; detach: string; listInline: string; getInline: string; putInline: string; deleteInline: string; nameKey: string }> = {
  user: { list: 'list_attached_user_policies', attach: 'attach_user_policy', detach: 'detach_user_policy', listInline: 'list_user_policies', getInline: 'get_user_policy', putInline: 'put_user_policy', deleteInline: 'delete_user_policy', nameKey: 'UserName' },
  role: { list: 'list_attached_role_policies', attach: 'attach_role_policy', detach: 'detach_role_policy', listInline: 'list_role_policies', getInline: 'get_role_policy', putInline: 'put_role_policy', deleteInline: 'delete_role_policy', nameKey: 'RoleName' },
  group: { list: 'list_attached_group_policies', attach: 'attach_group_policy', detach: 'detach_group_policy', listInline: 'list_group_policies', getInline: 'get_group_policy', putInline: 'put_group_policy', deleteInline: 'delete_group_policy', nameKey: 'GroupName' },
}

/** Managed (attached) + inline policies for a user, role or group. */
export function PermissionsCard({ entity, name }: { entity: Entity; name: string }) {
  const qc = useQueryClient()
  const { profile } = useParams()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const ops = OPS[entity]
  const base = { [ops.nameKey]: name }
  const [pickerOpen, setPickerOpen] = useState(false)
  const [inline, setInline] = useState<{ name: string; text: string; isNew: boolean } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; run: () => void } | null>(null)

  const attached = useQuery({
    queryKey: ['iam-attached', entity, name, activeProfileId],
    queryFn: () => runQuery<{ AttachedPolicies?: { PolicyName: string; PolicyArn: string }[] }>('iam', ops.list, { ...base, MaxItems: 200 }),
    retry: false,
  })
  const inlineNames = useQuery({
    queryKey: ['iam-inline', entity, name, activeProfileId],
    queryFn: () => runQuery<{ PolicyNames?: string[] }>('iam', ops.listInline, { ...base, MaxItems: 200 }),
    retry: false,
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['iam-attached', entity, name] })
    qc.invalidateQueries({ queryKey: ['iam-inline', entity, name] })
    qc.invalidateQueries({ queryKey: ['iam-policies'] })
  }
  const attach = useMutation({
    mutationFn: async (arns: string[]) => {
      for (const arn of arns) await runQuery('iam', ops.attach, { ...base, PolicyArn: arn })
      return arns.length
    },
    onSuccess: (n) => { invalidate(); setPickerOpen(false); toast.success(`Attached ${n} polic${n === 1 ? 'y' : 'ies'}`) },
  })
  const detach = useMutation({
    mutationFn: (arn: string) => runQuery('iam', ops.detach, { ...base, PolicyArn: arn }),
    onSuccess: () => { invalidate(); toast.success('Policy detached') },
    onSettled: () => setConfirm(null),
  })
  const saveInline = useMutation({
    mutationFn: ({ policyName, doc }: { policyName: string; doc: any }) => runQuery('iam', ops.putInline, { ...base, PolicyName: policyName, PolicyDocument: JSON.stringify(doc) }),
    onSuccess: (_r, { policyName }) => { invalidate(); setInline(null); toast.success(`Inline policy “${policyName}” saved`) },
  })
  const deleteInline = useMutation({
    mutationFn: (policyName: string) => runQuery('iam', ops.deleteInline, { ...base, PolicyName: policyName }),
    onSuccess: (_r, policyName) => { invalidate(); toast.success(`Inline policy “${policyName}” deleted`) },
    onSettled: () => setConfirm(null),
  })
  async function openInline(policyName: string) {
    const r = await runQuery<{ PolicyDocument: any }>('iam', ops.getInline, { ...base, PolicyName: policyName })
    setInline({ name: policyName, text: JSON.stringify(policyDoc(r.PolicyDocument), null, 2), isNew: false })
  }
  const managed = attached.data?.AttachedPolicies ?? []
  const inlines = inlineNames.data?.PolicyNames ?? []
  const parsed = inline ? validateJsonPolicy(inline.text) : null

  return (
    <Card
      title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Permissions</span>}
      actions={
        <div className="flex items-center gap-1">
          <Button size="xs" variant="outline" onClick={() => setInline({ name: '', text: JSON.stringify(POLICY_TEMPLATES[0].doc, null, 2), isNew: true })}><FileJson />Inline policy</Button>
          <Button size="xs" onClick={() => setPickerOpen(true)}><Plus />Attach policy</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Managed policies</div>
          {attached.isPending ? <Skeleton className="h-8 w-full" /> : attached.isError ? <ErrorAlert error={attached.error} /> : managed.length === 0 ? <p className="text-sm text-muted-foreground">No managed policies attached — this {entity} has no permissions from managed policies.</p> : (
            <ul className="divide-y">
              {managed.map((p) => (
                <li key={p.PolicyArn} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/${profile}/access/policies/${encodeURIComponent(p.PolicyArn)}`} className="text-sm font-medium hover:text-primary hover:underline">{p.PolicyName}</Link>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="truncate font-mono">{p.PolicyArn}</span>{isAwsManaged(p.PolicyArn) && <Badge variant="outline" className="h-4 shrink-0 text-[9px]">AWS managed</Badge>}</div>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Detach policy" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirm({ title: `Detach “${p.PolicyName}”?`, run: () => detach.mutate(p.PolicyArn) })}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inline policies</div>
          {inlineNames.isPending ? <Skeleton className="h-8 w-full" /> : inlines.length === 0 ? <p className="text-sm text-muted-foreground">No inline policies. Inline policies live only on this {entity}.</p> : (
            <ul className="divide-y">
              {inlines.map((n) => (
                <li key={n} className="flex items-center gap-3 py-2">
                  <button type="button" onClick={() => openInline(n)} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary hover:underline">{n}</button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete inline policy" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" onClick={() => setConfirm({ title: `Delete inline policy “${n}”?`, run: () => deleteInline.mutate(n) })}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(attach.isError || detach.isError || deleteInline.isError) && <ErrorAlert error={attach.error || detach.error || deleteInline.error} />}
      </div>

      <PolicyPicker open={pickerOpen} exclude={managed.map((p) => p.PolicyArn)} pending={attach.isPending} onClose={() => setPickerOpen(false)} onAttach={(arns) => attach.mutate(arns)} />

      <Dialog open={inline != null} onOpenChange={(o) => !o && setInline(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{inline?.isNew ? 'Add inline policy' : `Inline policy “${inline?.name}”`}</DialogTitle>
            <DialogDescription>A JSON permissions document embedded directly in this {entity}.</DialogDescription>
          </DialogHeader>
          {inline && (
            <form onSubmit={(e) => { e.preventDefault(); if (parsed && 'doc' in parsed && inline.name.trim()) saveInline.mutate({ policyName: inline.name.trim(), doc: parsed.doc }) }} className="flex flex-col gap-3">
              {inline.isNew && (
                <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <div className="flex flex-col gap-1.5"><Label htmlFor="inline-name">Policy name</Label><Input id="inline-name" value={inline.name} onChange={(e) => setInline({ ...inline, name: e.target.value })} placeholder="allow-s3-read" autoFocus /></div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Template</Label>
                    <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" onChange={(e) => { const t = POLICY_TEMPLATES.find((x) => x.id === e.target.value); if (t) setInline({ ...inline, text: JSON.stringify(t.doc, null, 2) }) }}>
                      {POLICY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <Textarea value={inline.text} onChange={(e) => setInline({ ...inline, text: e.target.value })} rows={16} spellCheck={false} wrap="off" className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre" />
              <span className={parsed && 'error' in parsed ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{parsed ? ('error' in parsed ? parsed.error : policySummary(parsed.doc)) : ''}</span>
              {saveInline.isError && <ErrorAlert error={saveInline.error} />}
              <DialogFooter><Button type="button" variant="ghost" onClick={() => setInline(null)}>Cancel</Button><Button type="submit" disabled={!parsed || 'error' in parsed || !inline.name.trim() || saveInline.isPending}>{saveInline.isPending ? 'Saving…' : 'Save policy'}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirm != null} title={confirm?.title ?? ''} description="Permissions granted by it are removed immediately." confirmLabel="Remove" pending={detach.isPending || deleteInline.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm?.run()} />
    </Card>
  )
}
