import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { runQuery } from '../api/proxy'
import { Card } from '../components/Card'
import { GaugeRing } from '../components/GaugeRing'
import { MetricChart } from '../components/MetricChart'
import { ResourceList } from '../components/ResourceList'
import { StatCounter } from '../components/StatCounter'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

export function Overview() {
  const navigate = useNavigate()
  const { profile } = useParams()
  const mode = useAuthStore((s) => s.mode)
  const guestCreds = useAuthStore((s) => s.guestCreds)
  const region = useSessionStore((s) => s.region)
  const activeProfileId = useSessionStore((s) => s.activeProfileId)

  const enabled = mode === 'guest' ? !!guestCreds : activeProfileId != null

  const count = (key: string, service: string, op: string, extract: (r: any) => number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['count', key, profile, region],
      queryFn: async () => extract(await runQuery<any>(service, op)),
      enabled,
      retry: false,
      staleTime: 30_000,
    })

  const instances = count('ec2', 'ec2', 'describe_instances', (r) =>
    (r.Reservations ?? []).reduce((n: number, x: any) => n + (x.Instances?.length ?? 0), 0),
  )
  const buckets = count('s3', 's3', 'list_buckets', (r) => r.Buckets?.length ?? 0)
  const functions = count('lambda', 'lambda', 'list_functions', (r) => r.Functions?.length ?? 0)
  const users = count('iam', 'iam', 'list_users', (r) => r.Users?.length ?? 0)
  const dbs = count('rds', 'rds', 'describe_db_instances', (r) => r.DBInstances?.length ?? 0)
  const tables = count('dynamodb', 'dynamodb', 'list_tables', (r) => r.TableNames?.length ?? 0)

  const runningQuery = useQuery({
    queryKey: ['ec2-running', profile, region],
    queryFn: async () => {
      const r = await runQuery<any>('ec2', 'describe_instances')
      const all = (r.Reservations ?? []).flatMap((x: any) => x.Instances ?? [])
      return {
        total: all.length,
        running: all.filter((i: any) => i.State?.Name === 'running').length,
      }
    },
    enabled,
    retry: false,
    staleTime: 30_000,
  })

  const val = (q: { data?: number; isError: boolean; isLoading: boolean }) =>
    !enabled ? '—' : q.isLoading ? '…' : q.isError ? '—' : (q.data ?? 0)

  const [series] = useState(() =>
    Array.from({ length: 24 }, (_, i) => 40 + Math.sin(i / 2) * 18 + Math.random() * 8),
  )

  const [memo, setMemo] = useState('')
  useEffect(() => {
    setMemo(localStorage.getItem('aws-openconsole-memo') ?? '')
  }, [])

  const running = runningQuery.data?.running ?? 0
  const totalInst = runningQuery.data?.total ?? 0
  const stopped = Math.max(0, totalInst - running)

  // Secondary detail line for each summary card (only when live data is loaded).
  const computeDetail =
    enabled && runningQuery.data ? `${running} running · ${stopped} stopped` : undefined
  const unit = (q: { data?: number; isError: boolean }, noun: string) =>
    enabled && !q.isError && q.data != null ? noun : undefined

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        <Card title="Account summary">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <StatCounter label="Compute" value={val(instances)} detail={computeDetail} onClick={() => navigate(`/${profile}/compute`)} />
            <StatCounter label="Storage" value={val(buckets)} detail={unit(buckets, 'buckets')} onClick={() => navigate(`/${profile}/storage`)} />
            <StatCounter label="Functions" value={val(functions)} detail={unit(functions, 'functions')} onClick={() => navigate(`/${profile}/functions`)} />
            <StatCounter label="Access" value={val(users)} detail={unit(users, 'users')} onClick={() => navigate(`/${profile}/access`)} />
            <StatCounter label="Databases" value={val(dbs)} detail={unit(dbs, 'DB instances')} onClick={() => navigate(`/${profile}/databases`)} />
            <StatCounter label="NoSQL" value={val(tables)} detail={unit(tables, 'tables')} onClick={() => navigate(`/${profile}/nosql`)} />
          </div>
          {!enabled && (
            <p className="mt-2 text-xs text-amber-600">
              Connect a profile to load live counts.
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
              caption="buckets"
            />
            <GaugeRing
              label="Lambda"
              fraction={Math.min(1, (functions.data ?? 0) / 20)}
              centerText={String(functions.data ?? 0)}
              caption="functions"
            />
            <GaugeRing
              label="DynamoDB"
              fraction={Math.min(1, (tables.data ?? 0) / 20)}
              centerText={String(tables.data ?? 0)}
              caption="tables"
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
