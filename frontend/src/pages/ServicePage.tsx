import { useMutation } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { runQuery } from '../api/proxy'
import { ActionForm } from '../components/ActionForm'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { ErrorAlert } from '../components/ErrorAlert'
import { getServiceByRoute } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

export function ServicePage() {
  const { service } = useParams()
  const def = getServiceByRoute(service)
  const [actionId, setActionId] = useState(def?.actions[0]?.id ?? '')

  const mode = useAuthStore((s) => s.mode)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)

  // Reset to the first action whenever the service changes.
  useEffect(() => {
    setActionId(def?.actions[0]?.id ?? '')
  }, [service, def])

  const action = def?.actions.find((a) => a.id === actionId)

  const run = useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      runQuery(def!.key, action!.id, params),
    onSuccess: (data) => {
      if (!action) return
      if (action.kind === 'list' && action.getRows) {
        const n = action.getRows(data).length
        toast.success(`${action.label}: ${n} result${n === 1 ? '' : 's'}`)
      } else {
        toast.success(`${action.label} completed`)
      }
    },
  })

  // Re-run list actions automatically when region changes if we already have data.
  useEffect(() => {
    run.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId, region])

  if (!def) {
    return <Card title="Unknown service">No such service.</Card>
  }

  const needsProfile = mode === 'register' && activeProfileId == null

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <def.icon className="h-4 w-4 text-primary" />
            {def.label}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-1">
            {def.actions.map((a) => (
              <Button
                key={a.id}
                size="xs"
                variant={a.id === actionId ? 'default' : 'secondary'}
                aria-pressed={a.id === actionId}
                onClick={() => setActionId(a.id)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        }
      >
        {needsProfile ? (
          <p className="text-sm text-warning">
            Select an AWS profile from the account menu to run queries.
          </p>
        ) : (
          action && (
            <ActionForm
              action={action}
              running={run.isPending}
              onRun={(params) => run.mutate(params)}
            />
          )
        )}
      </Card>

      {(run.isError || run.data !== undefined) && (
        <Card title="Results">
          {run.isError ? (
            <ErrorAlert error={run.error} />
          ) : action?.kind === 'list' && action.getRows && action.columns ? (
            <DataTable columns={action.columns} rows={action.getRows(run.data)} />
          ) : (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              <CircleCheck />
              <AlertTitle>Request completed successfully</AlertTitle>
              <AlertDescription className="text-current/80">
                Open the Inspector below for full details.
              </AlertDescription>
            </Alert>
          )}
        </Card>
      )}
    </div>
  )
}
