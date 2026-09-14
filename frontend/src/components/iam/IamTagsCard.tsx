import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { runQuery } from '../../api/proxy'
import { useSessionStore } from '../../store/sessionStore'
import { Card } from '../Card'
import { ErrorAlert } from '../ErrorAlert'

const OPS = {
  user: { list: 'list_user_tags', tag: 'tag_user', untag: 'untag_user', key: 'UserName' },
  role: { list: 'list_role_tags', tag: 'tag_role', untag: 'untag_role', key: 'RoleName' },
  policy: { list: 'list_policy_tags', tag: 'tag_policy', untag: 'untag_policy', key: 'PolicyArn' },
} as const

export function IamTagsCard({ entity, id }: { entity: keyof typeof OPS; id: string }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const ops = OPS[entity]
  const base = { [ops.key]: id }
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const q = useQuery({
    queryKey: ['iam-tags', entity, id, activeProfileId],
    queryFn: () => runQuery<{ Tags?: { Key: string; Value: string }[] }>('iam', ops.list, { ...base }),
    retry: false,
  })
  const tags = (q.data?.Tags ?? []).filter((t) => t.Key !== 'Name')
  const add = useMutation({
    mutationFn: () => runQuery('iam', ops.tag, { ...base, Tags: [{ Key: key.trim(), Value: value.trim() }] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iam-tags', entity, id] }); toast.success(`Label “${key.trim()}” added`); setKey(''); setValue('') },
  })
  const remove = useMutation({
    mutationFn: (k: string) => runQuery('iam', ops.untag, { ...base, TagKeys: [k] }),
    onSuccess: (_r, k) => { qc.invalidateQueries({ queryKey: ['iam-tags', entity, id] }); toast.success(`Label “${k}” removed`) },
  })
  return (
    <Card title="Labels">
      <div className="flex flex-col gap-3">
        {q.isPending ? <Skeleton className="h-6 w-40" /> : q.isError ? <ErrorAlert error={q.error} /> : tags.length === 0 ? <p className="text-sm text-muted-foreground">No labels yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t.Key} variant="secondary" className="h-auto gap-1.5 rounded-md py-1 font-normal">
                <span><span className="text-muted-foreground">{t.Key}</span> = {t.Value}</span>
                <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(t.Key)} className="text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label={`Remove label ${t.Key}`}><X className="size-3" /></button>
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
      </div>
    </Card>
  )
}
