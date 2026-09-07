import { useNavigate } from 'react-router-dom'
import { CredentialForm } from '../components/CredentialForm'
import { testConnection } from '../api/proxy'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { useMutation } from '@tanstack/react-query'
import type { CredentialValues } from '../components/CredentialForm'

/**
 * Guest connect gate: entering credentials validates the connection, then stores
 * them in the browser and enters the guest workspace at /guest.
 */
export function GuestCredentials() {
  const navigate = useNavigate()
  const setGuest = useAuthStore((s) => s.setGuest)
  const { setRegion, setEndpointUrl } = useSessionStore()

  const connect = useMutation({
    mutationFn: async (v: CredentialValues) => {
      await testConnection({
        access_key_id: v.access_key_id,
        secret_access_key: v.secret_access_key,
        session_token: v.session_token || undefined,
        region: v.default_region,
        endpoint_url: v.endpoint_url || undefined,
      })
      return v
    },
    onSuccess: (v) => {
      setGuest({
        accessKeyId: v.access_key_id,
        secretAccessKey: v.secret_access_key,
        sessionToken: v.session_token,
        endpointUrl: v.endpoint_url,
        region: v.default_region,
      })
      setRegion(v.default_region)
      setEndpointUrl(v.endpoint_url.trim())
      navigate('/guest', { replace: true })
    },
  })

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Guest credentials
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Stored only in this browser (localStorage) and sent with each request.
          Never persisted on the server.
        </p>

        <div className="mt-4">
          <CredentialForm
            submitLabel="Connect"
            pendingLabel="Testing connection…"
            pending={connect.isPending}
            error={connect.isError ? connect.error : undefined}
            onSubmit={(v) => connect.mutate(v)}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            useAuthStore.getState().reset()
            navigate('/')
          }}
          className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
