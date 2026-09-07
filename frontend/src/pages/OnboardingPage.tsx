import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { listProfiles } from '../api/auth'
import { ProfileForm } from '../components/ProfileForm'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'

/**
 * First-run onboarding / post-login resolver for register mode. If the user has
 * profiles, it redirects to the first one's URL; otherwise it shows a dedicated
 * page (same layout as guest/login) to create the first profile.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const { mode, reset } = useAuthStore()

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  if (mode !== 'register') return <Navigate to="/" replace />

  if (profiles.isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  // Already has a profile → go straight to it.
  if (profiles.data && profiles.data.length > 0) {
    return <Navigate to={`/${slugify(profiles.data[0].label)}`} replace />
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Add your first AWS profile
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          To start issuing queries, provide AWS credentials. They are encrypted
          at rest and reused across sessions.
        </p>

        <div className="mt-4">
          <ProfileForm
            submitLabel="Create profile"
            onSuccess={(created) =>
              navigate(`/${slugify(created.label)}`, { replace: true })
            }
          />
        </div>

        <button
          type="button"
          onClick={() => {
            reset()
            navigate('/')
          }}
          className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Sign out
        </button>
      </div>
    </div>
  )
}
