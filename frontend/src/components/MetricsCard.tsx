import { useQueries } from '@tanstack/react-query'
import { Activity, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { runQuery } from '../api/proxy'
import { useSessionStore } from '../store/sessionStore'
import { Card } from './Card'
import { MetricChart } from './MetricChart'

export interface MetricSpec {
  label: string
  namespace: string
  metricName: string
  dimensions: { Name: string; Value: string }[]
  stat: 'Average' | 'Sum' | 'Maximum' | 'Minimum'
  /** Format the latest value for display. */
  format?: (v: number) => string
}

const RANGES = [
  { key: '1h', label: '1 hour', seconds: 3600, period: 60 },
  { key: '6h', label: '6 hours', seconds: 6 * 3600, period: 300 },
  { key: '24h', label: '24 hours', seconds: 24 * 3600, period: 900 },
  { key: '7d', label: '7 days', seconds: 7 * 24 * 3600, period: 3600 },
] as const
type RangeKey = (typeof RANGES)[number]['key']

interface Point { Timestamp: string; Average?: number; Sum?: number; Maximum?: number; Minimum?: number }

/** CloudWatch metrics for a resource, as small trend charts with the latest value. */
export function MetricsCard({ title = 'Monitoring', metrics, description }: { title?: string; metrics: MetricSpec[]; description?: string }) {
  const [range, setRange] = useState<RangeKey>('6h')
  const r = RANGES.find((x) => x.key === range)!
  const activeProfileId = useSessionStore((s) => s.activeProfileId)
  const region = useSessionStore((s) => s.region)

  const queries = useQueries({
    queries: metrics.map((m) => ({
      queryKey: ['cw-metric', m.namespace, m.metricName, m.dimensions, m.stat, range, region, activeProfileId],
      queryFn: async () => {
        const end = new Date()
        const start = new Date(end.getTime() - r.seconds * 1000)
        const res = await runQuery<{ Datapoints?: Point[] }>('cloudwatch', 'get_metric_statistics', {
          Namespace: m.namespace,
          MetricName: m.metricName,
          Dimensions: m.dimensions,
          StartTime: start.toISOString(),
          EndTime: end.toISOString(),
          Period: r.period,
          Statistics: [m.stat],
        })
        return (res.Datapoints ?? [])
          .map((p) => ({ t: new Date(p.Timestamp).getTime(), v: (p[m.stat] as number | undefined) ?? 0 }))
          .sort((a, b) => a.t - b.t)
      },
      staleTime: 60_000,
      retry: false,
      meta: { silent: true },
    })),
  })
  const anyFetching = queries.some((q) => q.isFetching)

  return (
    <Card
      title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />{title}</span>}
      actions={
        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList className="h-7">
              {RANGES.map((x) => <TabsTrigger key={x.key} value={x.key} className="px-2 text-xs">{x.key}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon-xs" onClick={() => queries.forEach((q) => q.refetch())} disabled={anyFetching} aria-label="Refresh metrics"><RefreshCw className={cn(anyFetching && 'animate-spin')} /></Button>
        </div>
      }
    >
      {description && <p className="mb-3 text-xs text-muted-foreground">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m, i) => {
          const q = queries[i]
          const points = q.data ?? []
          const latest = points.length ? points[points.length - 1].v : undefined
          const fmt = m.format ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2)))
          return (
            <div key={m.metricName + m.stat} className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                <span className="text-lg font-semibold">{q.isPending ? <Skeleton className="inline-block h-5 w-12" /> : q.isError ? '—' : latest == null ? '—' : fmt(latest)}</span>
              </div>
              {q.isError ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Metrics unavailable.</p>
              ) : points.length < 2 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{q.isPending ? 'Loading…' : 'No data in this range yet.'}</p>
              ) : (
                <MetricChart data={points.map((p) => p.v)} height={100} />
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
