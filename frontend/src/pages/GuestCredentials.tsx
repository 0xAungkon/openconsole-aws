import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'

export function GuestCredentials() {
  const navigate = useNavigate()
  const setGuest = useAuthStore((s) => s.setGuest)
  const { setRegion, setEndpointUrl } = useSessionStore()

  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [endpointUrl, setEndpoint] = useState('')
  const [region, setRegionLocal] = useState('us-east-1')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setGuest({ accessKeyId, secretAccessKey, sessionToken, endpointUrl, region })
    setRegion(region)
    setEndpointUrl(endpointUrl.trim())
    navigate('/app')
  }

  const input =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950'

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Guest credentials
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Stored only in this browser (localStorage) and sent with each request.
          Never persisted on the server.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Endpoint URL (optional)</span>
            <input
              className={input}
              value={endpointUrl}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:4566 (Floci / LocalStack)"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Access key ID *</span>
            <input
              className={input}
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Secret access key *</span>
            <input
              className={input}
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Session token (optional)</span>
            <input
              className={input}
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Default region</span>
            <select
              className={input}
              value={region}
              onChange={(e) => setRegionLocal(e.target.value)}
            >
              {AWS_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
          <button
            type="submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
