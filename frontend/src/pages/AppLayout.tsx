import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { listProfiles } from '../api/auth'
import { EndpointDialog } from '../components/EndpointDialog'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { getService } from '../services/catalog'
import { useAuthStore } from '../store/authStore'

function titleFor(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean) // ['app', ...]
  const seg = parts[1]
  if (!seg) return 'Overview'
  if (seg === 'profiles') return 'Profiles'
  return getService(seg)?.label ?? seg
}

export function AppLayout() {
  const location = useLocation()
  const [endpointOpen, setEndpointOpen] = useState(false)
  const mode = useAuthStore((s) => s.mode)

  // Register-mode onboarding: prompt for a first profile when none exist.
  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })
  const needsOnboarding =
    mode === 'register' && profiles.isSuccess && profiles.data.length === 0

  // Register users without a profile are sent to the dedicated onboarding page.
  if (needsOnboarding) return <Navigate to="/onboarding" replace />

  return (
    <div className="flex h-full">
      <Sidebar onEndpointClick={() => setEndpointOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titleFor(location.pathname)} />

        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>

        <footer className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
          <span>© {new Date().getFullYear()} AWS OpenConsole</span>
          <span>v0.1.0</span>
        </footer>
      </div>

      {endpointOpen && <EndpointDialog onClose={() => setEndpointOpen(false)} />}
    </div>
  )
}
