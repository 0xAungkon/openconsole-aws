import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl font-bold text-brand-500">404</div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        This page doesn't exist, or you don't have access to this profile.
      </p>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        Go home
      </button>
    </div>
  )
}
