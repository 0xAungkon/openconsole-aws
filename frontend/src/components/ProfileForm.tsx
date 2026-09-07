import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProfile } from '../api/auth'
import type { StoredProfile } from '../types'
import { useSessionStore } from '../store/sessionStore'
import { CredentialForm } from './CredentialForm'

interface ProfileFormProps {
  submitLabel?: string
  onSuccess?: (profile: StoredProfile) => void
}

/** Register-mode profile creation: shared credential form wired to the API. */
export function ProfileForm({ submitLabel = 'Save profile', onSuccess }: ProfileFormProps) {
  const qc = useQueryClient()
  const setActiveProfileId = useSessionStore((s) => s.setActiveProfileId)

  const create = useMutation({
    mutationFn: createProfile,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      setActiveProfileId(created.id)
      onSuccess?.(created)
    },
  })

  return (
    <CredentialForm
      withLabel
      submitLabel={submitLabel}
      pending={create.isPending}
      error={create.isError ? create.error : undefined}
      onSubmit={(v) =>
        create.mutate({
          label: v.label,
          access_key_id: v.access_key_id,
          secret_access_key: v.secret_access_key,
          session_token: v.session_token || undefined,
          default_region: v.default_region,
          endpoint_url: v.endpoint_url || undefined,
        })
      }
    />
  )
}
