import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { runQuery } from '../api/proxy'
import { ActionForm } from '../components/ActionForm'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { ErrorAlert } from '../components/ErrorAlert'
import { JsonInspector } from '../components/JsonInspector'
import { getService } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

export function ServicePage() {
  const { service } = useParams()
  const def = getService(service)
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
        title={`${def.icon} ${def.label}`}
        actions={
          <div className="flex flex-wrap gap-1">
            {def.actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActionId(a.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  a.id === actionId
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        }
      >
        {needsProfile ? (
          <p className="text-sm text-amber-600">
            Select an AWS profile in the top bar (or add one under Profiles) to
            run queries.
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
          ) : (
            <>
              {action?.kind === 'list' && action.getRows && action.columns ? (
                <DataTable
                  columns={action.columns}
                  rows={action.getRows(run.data)}
                />
              ) : (
                <p className="text-sm text-green-600">Request succeeded.</p>
              )}
              <JsonInspector value={run.data} defaultOpen={action?.kind !== 'list'} />
            </>
          )}
        </Card>
      )}
    </div>
  )
}
