import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { GaugeRing } from '../components/GaugeRing'
import { MetricChart } from '../components/MetricChart'
import { ResourceList } from '../components/ResourceList'
import { StatCounter } from '../components/StatCounter'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

function useCount(
  key: string,
  service: string,
  operation: string,
  extract: (r: any) => number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['count', key, useSessionStore.getState().region],
    queryFn: async () => extract(await runQuery(service, operation)),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}

export function Dashboard() {
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const region = useSessionStore((s) => s.region)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)

  const enabled = mode === 'guest' || activeProfileId != null

  const buckets = useCount('s3', 's3', 'list_buckets', (r) => r.Buckets?.length ?? 0, enabled)
  const functions = useCount('lambda', 'lambda', 'list_functions', (r) => r.Functions?.length ?? 0, enabled)
  const users = useCount('iam', 'iam', 'list_users', (r) => r.Users?.length ?? 0, enabled)
  const dbs = useCount('rds', 'rds', 'describe_db_instances', (r) => r.DBInstances?.length ?? 0, enabled)

  const instances = useQuery({
    queryKey: ['count', 'ec2', region],
    queryFn: () => runQuery<any>('ec2', 'describe_instances'),
    enabled,
    retry: false,
    staleTime: 30_000,
  })

  const allInstances =
    instances.data?.Reservations?.flatMap((r: any) => r.Instances ?? []) ?? []
  const running = allInstances.filter((i: any) => i.State?.Name === 'running').length
  const totalInst = allInstances.length

  const val = (q: { data?: number; isError: boolean; isLoading: boolean }) =>
    q.isLoading ? '…' : q.isError ? '—' : (q.data ?? 0)

  // Placeholder monitoring series (real CloudWatch wiring is a follow-up).
  const [series] = useState(() =>
    Array.from({ length: 24 }, (_, i) => 40 + Math.sin(i / 2) * 20 + Math.random() * 10),
  )

  const [memo, setMemo] = useState('')
  useEffect(() => {
    setMemo(localStorage.getItem('aws-openconsole-memo') ?? '')
  }, [])

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        <Card title="Account summary">
          <div className="flex flex-wrap justify-between gap-2">
            <StatCounter
              label="EC2 instances"
              value={instances.isLoading ? '…' : instances.isError ? '—' : totalInst}
              onClick={() => navigate('/app/ec2')}
            />
            <StatCounter label="S3 buckets" value={val(buckets)} onClick={() => navigate('/app/s3')} />
            <StatCounter label="Lambda fns" value={val(functions)} onClick={() => navigate('/app/lambda')} />
            <StatCounter label="IAM users" value={val(users)} onClick={() => navigate('/app/iam')} />
            <StatCounter label="RDS instances" value={val(dbs)} onClick={() => navigate('/app/rds')} />
          </div>
          {!enabled && (
            <p className="mt-2 text-xs text-amber-600">
              Select an AWS profile in the top bar to load live counts.
            </p>
          )}
        </Card>

        <Card title="Status">
          <div className="flex flex-wrap items-center justify-around gap-4">
            <GaugeRing
              label="EC2 running"
              fraction={totalInst ? running / totalInst : 0}
              centerText={`${running}/${totalInst}`}
              caption="running / total"
            />
            <GaugeRing
              label="S3 buckets"
              fraction={Math.min(1, (buckets.data ?? 0) / 20)}
              centerText={String(buckets.data ?? 0)}
              caption="of 20 shown"
            />
            <GaugeRing
              label="Lambda"
              fraction={Math.min(1, (functions.data ?? 0) / 20)}
              centerText={String(functions.data ?? 0)}
              caption="functions"
            />
          </div>
        </Card>

        <Card title="Monitoring" actions={<span className="text-xs text-gray-400">CPU (sample)</span>}>
          <MetricChart data={series} />
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card title="Memo">
          <textarea
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value)
              localStorage.setItem('aws-openconsole-memo', e.target.value)
            }}
            placeholder="Scratch notes (saved in this browser)…"
            rows={4}
            className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950"
          />
        </Card>

        <Card title="Services">
          <ResourceList />
        </Card>
      </div>
    </div>
  )
}
