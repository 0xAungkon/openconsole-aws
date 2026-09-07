import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { listProfiles } from '../api/auth'
import { ProfileForm } from '../components/ProfileForm'
import { useAuthStore } from '../store/authStore'

/**
 * First-run onboarding for register-mode users with no stored profile.
 * A dedicated centered page (same layout as guest/login), not a modal.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const { mode, reset } = useAuthStore()

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  // Guests never onboard; users who already have a profile skip straight in.
  if (mode !== 'register') return <Navigate to="/app" replace />
  if (profiles.isSuccess && profiles.data.length > 0)
    return <Navigate to="/app" replace />

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
            onSuccess={() => navigate('/app', { replace: true })}
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
