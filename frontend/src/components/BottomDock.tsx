import { useQuery } from '@tanstack/react-query'
import { ScrollText, TerminalSquare, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { listProfiles } from '../api/auth'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { CliPanel } from './CliPanel'
import { EndpointDialog } from './EndpointDialog'
import { InspectorPanel } from './InspectorPanel'

type Panel = 'cli' | 'inspector' | null

export function BottomDock() {
  const { profile: profileParam } = useParams()
  const mode = useAuthStore((s) => s.mode)
  const guestCreds = useAuthStore((s) => s.guestCreds)
  const endpointOverride = useSessionStore((s) => s.endpointUrl)

  const [panel, setPanel] = useState<Panel>(null)
  const [height, setHeight] = useState(260)
  const [endpointOpen, setEndpointOpen] = useState(false)
  const dragging = useRef(false)

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })
  const currentProfile = (profilesQuery.data ?? []).find(
    (p) => slugify(p.label) === profileParam,
  )

  const effectiveEndpoint =
    endpointOverride ||
    (mode === 'guest' ? guestCreds?.endpointUrl : currentProfile?.endpoint_url) ||
    ''

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return
    const next = window.innerHeight - e.clientY - 32 // 32 = bar height
    setHeight(Math.max(120, Math.min(next, window.innerHeight * 0.8)))
  }, [])

  const stopDrag = useCallback(() => {
    dragging.current = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopDrag)
  }, [onPointerMove])

  const startDrag = () => {
    dragging.current = true
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDrag)
  }

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p))

  const tab = (active: boolean) =>
    cn(
      'flex h-full items-center gap-1.5 rounded-none px-2.5 text-xs font-medium',
      active
        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
        : 'text-muted-foreground',
    )

  return (
    <div className="shrink-0">
      {panel && (
        <div style={{ height }} className="relative border-t">
          {/* resize handle */}
          <div
            onPointerDown={startDrag}
            className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize"
            title="Drag to resize"
          />
          <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1 text-xs font-medium">
            <span>{panel === 'cli' ? 'CLI' : 'Inspector'}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPanel(null)}
              aria-label="Close panel"
              className="text-muted-foreground"
            >
              <X />
            </Button>
          </div>
          <div className="h-[calc(100%-1.75rem)]">
            {panel === 'cli' ? <CliPanel /> : <InspectorPanel />}
          </div>
        </div>
      )}

      {/* bar */}
      <div className="flex h-8 items-center justify-between border-t bg-card">
        <div className="flex h-full items-stretch">
          <Button variant="ghost" onClick={() => toggle('cli')} className={tab(panel === 'cli')} aria-pressed={panel === 'cli'}>
            <TerminalSquare className="size-3.5" />
            CLI
          </Button>
          <Button
            variant="ghost"
            onClick={() => toggle('inspector')}
            className={tab(panel === 'inspector')}
            aria-pressed={panel === 'inspector'}
          >
            <ScrollText className="size-3.5" />
            Inspector
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEndpointOpen(true)}
          className="h-full rounded-none px-3 text-xs font-normal text-muted-foreground hover:text-primary"
          title="Configure endpoint"
        >
          <span className={cn('h-2 w-2 rounded-full', effectiveEndpoint ? 'bg-amber-500' : 'bg-green-500')} />
          {effectiveEndpoint || 'AWS default endpoint'}
        </Button>
      </div>

      {endpointOpen && <EndpointDialog open={endpointOpen} onClose={() => setEndpointOpen(false)} />}
    </div>
  )
}
