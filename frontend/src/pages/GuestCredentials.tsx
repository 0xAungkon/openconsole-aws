import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { testConnection } from '../api/proxy'
import { CredentialForm, type CredentialValues } from '../components/CredentialForm'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

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
      toast.success(`Connected to ${v.endpoint_url.trim() || 'AWS'} in ${v.default_region}`)
      navigate('/guest', { replace: true })
    },
  })

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Guest credentials</CardTitle>
          <CardDescription>
            Stored only in this browser (localStorage) and sent with each request. Never
            persisted on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CredentialForm
            submitLabel="Connect"
            pendingLabel="Testing connection…"
            pending={connect.isPending}
            error={connect.isError ? connect.error : undefined}
            onSubmit={(v) => connect.mutate(v)}
          />
          <Button
            variant="link"
            onClick={() => {
              useAuthStore.getState().reset()
              navigate('/')
            }}
            className="w-full text-muted-foreground"
          >
            ← Back
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
