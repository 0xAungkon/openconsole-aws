import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { listProfiles } from '../api/auth'
import { BottomDock } from '../components/BottomDock'
import { MobileNav } from '../components/MobileNav'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { getServiceByRoute } from '../services/catalog'
import { findProfileBySlug } from '../lib/slug'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { GuestCredentials } from './GuestCredentials'
import { NotFound } from './NotFound'

function titleFor(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[1] // ['<profile>', <seg>]
  if (!seg) return 'Overview'
  if (seg === 'settings') return 'Settings'
  return getServiceByRoute(seg)?.label ?? seg
}

export function AppLayout() {
  const { profile: profileParam } = useParams()
  const location = useLocation()
  const mode = useAuthStore((s) => s.mode)
  const guestCreds = useAuthStore((s) => s.guestCreds)
  const setActiveProfileId = useSessionStore((s) => s.setActiveProfileId)
  const setRegion = useSessionStore((s) => s.setRegion)
  // Mobile only: the slide-in nav drawer, driven by the TopBar hamburger.
  const [navOpen, setNavOpen] = useState(false)

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  const matched =
    mode === 'register'
      ? findProfileBySlug(profilesQuery.data ?? [], profileParam)
      : undefined

  // Keep the active profile + region in sync with the profile in the URL.
  useEffect(() => {
    if (matched) {
      setActiveProfileId(matched.id)
      setRegion(matched.default_region)
    }
  }, [matched, setActiveProfileId, setRegion])

  // --- Guest mode ---
  if (mode === 'guest') {
    if (profileParam !== 'guest') return <NotFound />
    if (!guestCreds) return <GuestCredentials />
  }

  // --- Register mode ---
  if (mode === 'register') {
    if (profilesQuery.isLoading) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      )
    }
    if (!matched) return <NotFound />
  }

  return (
    <div className="flex h-full">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titleFor(location.pathname)} onMenu={() => setNavOpen(true)} />

        <main className={`flex-1 overflow-y-auto p-4 ${['compute', 'storage', 'functions', 'databases', 'nosql', 'access'].includes(location.pathname.split('/').filter(Boolean)[1] ?? '') ? 'bg-card sm:p-6' : ''}`}>
          <Outlet />
        </main>

        <BottomDock />
      </div>

      <MobileNav open={navOpen} onOpenChange={setNavOpen} />
    </div>
  )
}
