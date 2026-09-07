interface StatCounterProps {
  label: string
  value: number | string
  onClick?: () => void
}

export function StatCounter({ label, value, onClick }: StatCounterProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-md px-3 py-2 text-center transition enabled:hover:bg-brand-50 disabled:cursor-default dark:enabled:hover:bg-gray-800"
    >
      <span className="text-2xl font-semibold text-brand-600 dark:text-brand-300">
        {value}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </button>
  )
}
