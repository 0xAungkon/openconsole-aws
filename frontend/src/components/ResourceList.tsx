import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CATALOG } from '../services/catalog'

/** 1Panel "Application"-list style: scrollable service rows with a primary action. */
export function ResourceList() {
  const navigate = useNavigate()
  const { profile } = useParams()
  return (
    <ul className="flex flex-col divide-y">
      {CATALOG.map((s) => (
        <li key={s.key} className="flex items-center gap-3 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <s.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{s.label}</div>
            <div className="truncate text-xs text-muted-foreground">{s.summary}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/${profile}/${s.route}`)}>
            Open
          </Button>
        </li>
      ))}
    </ul>
  )
}
