import { useMemo } from 'react'

interface MetricChartProps {
  /** Series of y-values; x is implicit (evenly spaced). */
  data: number[]
  height?: number
}

/** Lightweight dependency-free SVG line chart (placeholder for CloudWatch). */
export function MetricChart({ data, height = 160 }: MetricChartProps) {
  const width = 640
  const pad = 8
  const path = useMemo(() => {
    if (data.length < 2) return ''
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const span = max - min || 1
    const stepX = (width - pad * 2) / (data.length - 1)
    return data
      .map((v, i) => {
        const x = pad + i * stepX
        const y = pad + (1 - (v - min) / span) * (height - pad * 2)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [data, height])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full min-w-0"
      style={{ height: height / 1.6 }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={pad}
          x2={width - pad}
          y1={pad + f * (height - pad * 2)}
          y2={pad + f * (height - pad * 2)}
          className="stroke-border"
          strokeWidth={1}
        />
      ))}
      <path
        d={path}
        fill="none"
        className="stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  )
}
