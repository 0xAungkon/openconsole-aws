import { useQuery } from '@tanstack/react-query'
import { Check, Plus, UserCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listProfiles } from '../api/auth'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'

export function TopBar({ title }: { title: string }) {
  const navigate = useNavigate()
  const { profile: profileParam } = useParams()
  const { mode, user } = useAuthStore()
  const { region, setRegion } = useSessionStore()
  const [open, setOpen] = useState(false)

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })
  const profiles = profilesQuery.data ?? []
  const current = profiles.find((p) => slugify(p.label) === profileParam)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</h1>

      <div className="flex items-center gap-3">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
          title="Region"
        >
          {AWS_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {mode === 'guest' && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            Guest Mode
          </span>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center rounded-full text-gray-500 hover:text-brand-600"
            title="Account"
          >
            <UserCircle2 className="h-7 w-7" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                {mode === 'register' ? (
                  <>
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {user?.name ?? 'Account'}
                      </div>
                      <div className="truncate text-xs text-gray-400">
                        {user?.email}
                      </div>
                    </div>
                    <div className="border-t border-gray-100 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800">
                      Profiles
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {profiles.map((p) => {
                        const active = slugify(p.label) === profileParam
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setOpen(false)
                              navigate(`/${slugify(p.label)}`)
                            }}
                            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <span className="truncate">
                              {p.label}
                              <span className="ml-1 text-xs text-gray-400">
                                {p.default_region}
                              </span>
                            </span>
                            {active && (
                              <Check className="h-4 w-4 shrink-0 text-brand-500" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        navigate('/onboarding')
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-gray-100 px-3 py-2 text-left text-sm text-brand-600 hover:bg-brand-50 dark:border-gray-800 dark:text-brand-300 dark:hover:bg-gray-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add profile
                    </button>
                  </>
                ) : (
                  <div className="px-3 py-2">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      Guest session
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      Credentials are stored only in this browser.
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
