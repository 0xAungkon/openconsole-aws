import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api/auth'
import { ErrorAlert } from '../components/ErrorAlert'
import { useAuthStore } from '../store/authStore'

export function AuthPage({ initialTab = 'login' }: { initialTab?: 'login' | 'register' }) {
  const navigate = useNavigate()
  const setRegister = useAuthStore((s) => s.setRegister)

  const [tab, setTab] = useState<'login' | 'register'>(initialTab)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data =
        tab === 'register'
          ? await register(name, email, password)
          : await login(email, password)
      setRegister(data.access_token, data.user)
      // Onboarding resolves to the first profile, or prompts to create one.
      navigate('/onboarding')
    } catch (err) {
      // surface the backend's detail message when present
      const detail = (err as any)?.response?.data?.detail
      setError(detail ? new Error(detail) : err)
    } finally {
      setBusy(false)
    }
  }

  const input =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950'

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-4 flex gap-2 text-sm">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize transition ${
                tab === t
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {tab === 'register' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              className={input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
        </div>

        {error != null && (
          <div className="mt-3">
            <ErrorAlert error={error} />
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : tab === 'register' ? 'Create account' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to mode selection
        </button>
      </form>
    </div>
  )
}
