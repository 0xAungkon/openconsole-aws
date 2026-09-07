import { useQuery } from '@tanstack/react-query'
import { ScrollText, TerminalSquare, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
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

  const btn = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition ${
      active
        ? 'bg-brand-500 text-white'
        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
    }`

  return (
    <div className="shrink-0">
      {panel && (
        <div
          style={{ height }}
          className="relative border-t border-gray-200 dark:border-gray-800"
        >
          {/* resize handle */}
          <div
            onPointerDown={startDrag}
            className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize"
            title="Drag to resize"
          />
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <span>{panel === 'cli' ? 'CLI' : 'Inspector'}</span>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-800"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-1.75rem)]">
            {panel === 'cli' ? <CliPanel /> : <InspectorPanel />}
          </div>
        </div>
      )}

      {/* bar */}
      <div className="flex h-8 items-center justify-between border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-full items-stretch">
          <button type="button" onClick={() => toggle('cli')} className={btn(panel === 'cli')}>
            <TerminalSquare className="h-3.5 w-3.5" />
            CLI
          </button>
          <button
            type="button"
            onClick={() => toggle('inspector')}
            className={btn(panel === 'inspector')}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Inspector
          </button>
        </div>

        <button
          type="button"
          onClick={() => setEndpointOpen(true)}
          className="flex items-center gap-1.5 px-3 text-xs text-gray-500 hover:text-brand-600"
          title="Configure endpoint"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              effectiveEndpoint ? 'bg-amber-500' : 'bg-green-500'
            }`}
          />
          {effectiveEndpoint || 'AWS default endpoint'}
        </button>
      </div>

      {endpointOpen && <EndpointDialog onClose={() => setEndpointOpen(false)} />}
    </div>
  )
}
