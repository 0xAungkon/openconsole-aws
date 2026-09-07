import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createProfile, deleteProfile, listProfiles } from '../api/auth'
import { Card } from '../components/Card'
import { ErrorAlert } from '../components/ErrorAlert'
import { AWS_REGIONS, useSessionStore } from '../store/sessionStore'

export function ProfilesPage() {
  const qc = useQueryClient()
  const setActiveProfileId = useSessionStore((s) => s.setActiveProfileId)

  const profiles = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })

  const [form, setForm] = useState({
    label: '',
    access_key_id: '',
    secret_access_key: '',
    session_token: '',
    default_region: 'us-east-1',
    endpoint_url: '',
  })

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
      setForm({
        label: '',
        access_key_id: '',
        secret_access_key: '',
        session_token: '',
        default_region: 'us-east-1',
        endpoint_url: '',
      })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const input =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Stored AWS profiles">
        {profiles.isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (profiles.data ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">
            No profiles yet — add one to start issuing queries.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {profiles.data!.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {p.label}
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {p.access_key_id} · {p.default_region}
                    {p.endpoint_url ? ` · ${p.endpoint_url}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProfileId(p.id)}
                  className="rounded-md border border-brand-200 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:border-gray-700 dark:text-brand-300"
                >
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(p.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add profile">
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
            onChange={(e) =>
              setForm({ ...form, secret_access_key: e.target.value })
            }
            required
          />
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
          <select
            className={input}
            value={form.default_region}
            onChange={(e) =>
              setForm({ ...form, default_region: e.target.value })
            }
          >
            {AWS_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {create.isError && <ErrorAlert error={create.error} />}
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {create.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </Card>
    </div>
  )
}
