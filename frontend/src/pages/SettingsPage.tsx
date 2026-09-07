import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteProfile, listProfiles } from '../api/auth'
import { Card } from '../components/Card'
import { ProfileForm } from '../components/ProfileForm'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'

export function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { profile: profileParam } = useParams()
  const mode = useAuthStore((s) => s.mode)

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  if (mode === 'guest') {
    return (
      <Card title="Settings">
        <p className="text-sm text-gray-500">
          You're in guest mode. Credentials are stored only in this browser. Use
          the endpoint control in the bottom bar to target a local endpoint, or
          log out to switch accounts.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Stored AWS profiles">
        {profiles.isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {(profiles.data ?? []).map((p) => {
              const active = slugify(p.label) === profileParam
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {p.label}
                      {active && (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:bg-gray-800 dark:text-brand-300">
                          active
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-400">
                      {p.access_key_id} · {p.default_region}
                      {p.endpoint_url ? ` · ${p.endpoint_url}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/${slugify(p.label)}`)}
                    className="rounded-md border border-brand-200 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:border-gray-700 dark:text-brand-300"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(p.id)}
                    className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Add profile">
        <ProfileForm onSuccess={(created) => navigate(`/${slugify(created.label)}`)} />
      </Card>
    </div>
  )
}
