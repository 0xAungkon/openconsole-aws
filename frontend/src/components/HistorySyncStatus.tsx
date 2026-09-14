import { useHistorySync } from '../store/historySync'

export function HistorySyncStatus() {
  const status = useHistorySync((s) => s.status)
  return status ? <p role="status" className="px-3 py-1 text-xs text-warning">{status}</p> : null
}
