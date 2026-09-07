import { useNavigate } from 'react-router-dom'
import { CredentialForm } from '../components/CredentialForm'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

export function GuestCredentials() {
  const navigate = useNavigate()
  const setGuest = useAuthStore((s) => s.setGuest)
  const { setRegion, setEndpointUrl } = useSessionStore()

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
            submitLabel="Continue"
            onSubmit={(v) => {
              setGuest({
                accessKeyId: v.access_key_id,
                secretAccessKey: v.secret_access_key,
                sessionToken: v.session_token,
                endpointUrl: v.endpoint_url,
                region: v.default_region,
              })
              setRegion(v.default_region)
              setEndpointUrl(v.endpoint_url.trim())
              navigate('/app')
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
