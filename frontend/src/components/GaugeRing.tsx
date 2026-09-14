interface GaugeRingProps {
  label: string
  /** 0..1 */
  fraction: number
  centerText: string
  caption?: string
}

/** Dependency-free SVG donut gauge in the 1Panel style. */
export function GaugeRing({ label, fraction, centerText, caption }: GaugeRingProps) {
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, fraction))
  const dash = circ * clamped

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            className="stroke-primary transition-[stroke-dasharray] duration-500"
          />
        )}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="rotate-90 fill-foreground text-base font-semibold"
          style={{ transformOrigin: 'center' }}
        >
          {centerText}
        </text>
      </svg>
      <span className="text-sm font-medium">
        {label}
      </span>
      {caption && (
        <span className="text-xs text-muted-foreground">{caption}</span>
      )}
    </div>
  )
}
