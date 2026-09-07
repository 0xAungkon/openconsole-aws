import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { createProfile } from '../api/auth'
import type { StoredProfile } from '../types'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'
import { ErrorAlert } from './ErrorAlert'

const EMPTY = {
  label: '',
  access_key_id: '',
  secret_access_key: '',
  session_token: '',
  default_region: 'us-east-1',
  endpoint_url: '',
}

interface ProfileFormProps {
  submitLabel?: string
  onSuccess?: (profile: StoredProfile) => void
}

/** Create an AWS profile. Session token + endpoint URL live under "Advanced". */
export function ProfileForm({ submitLabel = 'Save profile', onSuccess }: ProfileFormProps) {
  const qc = useQueryClient()
  const setActiveProfileId = useSessionStore((s) => s.setActiveProfileId)

  const [form, setForm] = useState(EMPTY)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const create = useMutation({
    mutationFn: () =>
      createProfile({
        label: form.label,
        access_key_id: form.access_key_id,
        secret_access_key: form.secret_access_key,
        session_token: form.session_token || undefined,
        default_region: form.default_region,
        endpoint_url: form.endpoint_url || undefined,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      setActiveProfileId(created.id)
      setForm(EMPTY)
      onSuccess?.(created)
    },
  })

  const input =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate()
      }}
      className="flex flex-col gap-3"
    >
      <input
        className={input}
        placeholder="Label (e.g. dev)"
        value={form.label}
        onChange={(e) => setForm({ ...form, label: e.target.value })}
        required
      />
      <input
        className={input}
        placeholder="Access key ID"
        value={form.access_key_id}
        onChange={(e) => setForm({ ...form, access_key_id: e.target.value })}
        required
      />
      <input
        className={input}
        type="password"
        placeholder="Secret access key"
        value={form.secret_access_key}
        onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })}
        required
      />
      <select
        className={input}
        value={form.default_region}
        onChange={(e) => setForm({ ...form, default_region: e.target.value })}
      >
        {AWS_REGIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition ${advancedOpen ? 'rotate-90' : ''}`}
          />
          Advanced
        </button>
        {advancedOpen && (
          <div className="mt-2 flex flex-col gap-3">
            <input
              className={input}
              placeholder="Session token (optional)"
              value={form.session_token}
              onChange={(e) => setForm({ ...form, session_token: e.target.value })}
            />
            <input
              className={input}
              placeholder="Endpoint URL (optional, Floci/LocalStack)"
              value={form.endpoint_url}
              onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
            />
          </div>
        )}
      </div>

      {create.isError && <ErrorAlert error={create.error} />}
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {create.isPending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
