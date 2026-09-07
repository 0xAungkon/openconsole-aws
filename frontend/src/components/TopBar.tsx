import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listProfiles } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'

export function TopBar({ title }: { title: string }) {
  const navigate = useNavigate()
  const { mode, user, reset } = useAuthStore()
  const { region, setRegion, activeProfileId, setActiveProfileId } =
    useSessionStore()

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  function signOut() {
    reset()
    navigate('/')
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {title}
      </h1>

      <div className="flex items-center gap-2">
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

        {mode === 'register' && (
          <select
            value={activeProfileId ?? ''}
            onChange={(e) =>
              setActiveProfileId(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
            title="AWS profile"
          >
            <option value="">Select profile…</option>
            {(profilesQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 dark:bg-gray-800 dark:text-brand-300">
          {mode === 'guest' ? 'Guest' : (user?.name ?? 'Account')}
        </span>

        <button
          type="button"
          onClick={signOut}
          className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
