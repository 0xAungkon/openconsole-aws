import { Hexagon, Lock, Rocket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BRAND_BADGE, BRAND_NAME } from '../brand'
import { useAuthStore } from '../store/authStore'

export function ModeChooser() {
  const navigate = useNavigate()
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode)
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Hexagon className="mx-auto h-10 w-10 text-brand-500" />
          <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {BRAND_BADGE} {BRAND_NAME}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage AWS services through a friendly interface.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              enterGuestMode()
              navigate('/guest')
            }}
            className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <Rocket className="h-6 w-6 text-brand-500" />
            <h2 className="mt-3 font-semibold text-gray-800 dark:text-gray-100">
              Guest mode
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              No account. Your AWS credentials stay in this browser and are sent
              per request. Fastest way to start.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <Lock className="h-6 w-6 text-brand-500" />
            <h2 className="mt-3 font-semibold text-gray-800 dark:text-gray-100">
              Register mode
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Create an account and store AWS profiles securely (encrypted at
              rest) for reuse across sessions.
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
