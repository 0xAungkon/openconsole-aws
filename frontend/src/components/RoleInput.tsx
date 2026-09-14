import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { runQuery } from '../api/proxy'
import { BASIC_EXECUTION_POLICY_ARN, LAMBDA_TRUST_POLICY } from '../lib/lambda'
import { useSessionStore } from '../store/sessionStore'

const BASIC_ROLE_NAME = 'openconsole-lambda-basic'

/** Execution-role picker: choose an existing IAM role, paste an ARN, or create a basic one. */
export function RoleInput({ id, value, onChange }: { id: string; value: string; onChange: (arn: string) => void }) {
  const qc = useQueryClient()
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const roles = useQuery({
    queryKey: ['iam-roles', activeProfileId],
    queryFn: () => runQuery<{ Roles?: { RoleName: string; Arn: string }[] }>('iam', 'list_roles', { MaxItems: 200 }),
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
  })
  const list = roles.data?.Roles ?? []

  const createBasic = useMutation({
    mutationFn: async () => {
      const existing = list.find((r) => r.RoleName === BASIC_ROLE_NAME)
      if (existing) return existing.Arn
      const created = await runQuery<{ Role: { Arn: string } }>('iam', 'create_role', {
        RoleName: BASIC_ROLE_NAME,
        AssumeRolePolicyDocument: LAMBDA_TRUST_POLICY,
        Description: 'Basic Lambda execution role created by OpenConsole (CloudWatch Logs only).',
      })
      await runQuery('iam', 'attach_role_policy', { RoleName: BASIC_ROLE_NAME, PolicyArn: BASIC_EXECUTION_POLICY_ARN })
      return created.Role.Arn
    },
    onSuccess: (arn) => {
      qc.invalidateQueries({ queryKey: ['iam-roles'] })
      onChange(arn)
      toast.success(`Using role ${BASIC_ROLE_NAME}`)
    },
  })

  return (
    <div className="flex flex-col gap-2">
      {list.length > 0 && (
        <Select value={list.some((r) => r.Arn === value) ? value : ''} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose an existing role…" />
          </SelectTrigger>
          <SelectContent>
            {list.map((r) => (
              <SelectItem key={r.Arn} value={r.Arn}>
                {r.RoleName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="arn:aws:iam::123456789012:role/…" required className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={() => createBasic.mutate()} disabled={createBasic.isPending} title="Create a basic execution role (logs only)">
          <Wand2 />
          {createBasic.isPending ? 'Creating…' : 'Basic role'}
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">
        {roles.isError ? 'Could not list IAM roles — paste a role ARN.' : 'The IAM role the function runs as. “Basic role” creates one that can only write logs.'}
      </span>
    </div>
  )
}
