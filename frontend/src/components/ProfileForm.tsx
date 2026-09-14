import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createProfile } from '../api/auth'
import { testConnection } from '../api/proxy'
import type { StoredProfile } from '../types'
import { useSessionStore } from '../store/sessionStore'
import { CredentialForm, type CredentialValues } from './CredentialForm'

interface ProfileFormProps {
  submitLabel?: string
  onSuccess?: (profile: StoredProfile) => void
}

/**
 * Register-mode profile creation. Validates the credentials/endpoint with a
 * connection test (sts:GetCallerIdentity) before persisting, so a wrong AWS URL
 * or bad key surfaces an error instead of saving a broken profile.
 */
export function ProfileForm({ submitLabel = 'Save profile', onSuccess }: ProfileFormProps) {
  const qc = useQueryClient()
  const setActiveProfileId = useSessionStore((s) => s.setActiveProfileId)

  const create = useMutation({
    mutationFn: async (v: CredentialValues) => {
      // 1) Verify the endpoint + credentials actually work.
      await testConnection({
        access_key_id: v.access_key_id,
        secret_access_key: v.secret_access_key,
        session_token: v.session_token || undefined,
        region: v.default_region,
        endpoint_url: v.endpoint_url || undefined,
      })
      // 2) Only then persist the profile.
      return createProfile({
        label: v.label,
        access_key_id: v.access_key_id,
        secret_access_key: v.secret_access_key,
        session_token: v.session_token || undefined,
        default_region: v.default_region,
        endpoint_url: v.endpoint_url || undefined,
      })
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      setActiveProfileId(created.id)
      toast.success(`Profile “${created.label}” saved`)
      onSuccess?.(created)
    },
  })

  return (
    <CredentialForm
      withLabel
      submitLabel={submitLabel}
      pendingLabel="Testing connection…"
      pending={create.isPending}
      error={create.isError ? create.error : undefined}
      onSubmit={(v) => create.mutate(v)}
    />
  )
}
