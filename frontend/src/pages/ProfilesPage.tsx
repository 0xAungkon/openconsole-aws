import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteProfile, listProfiles } from '../api/auth'
import { Card } from '../components/Card'
import { ProfileForm } from '../components/ProfileForm'
import { useSessionStore } from '../store/sessionStore'

export function ProfilesPage() {
  const qc = useQueryClient()
  const setActiveProfileId = useSessionStore((s) => s.setActiveProfileId)

  const profiles = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })

  const remove = useMutation({
    mutationFn: (id: number) => deleteProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

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
        <ProfileForm />
      </Card>
    </div>
  )
}
