import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteProfile, listProfiles } from '../api/auth'
import { Card } from '../components/Card'
import { ProfileForm } from '../components/ProfileForm'
import { ThemeSettingsCard } from '../components/ThemeSettingsCard'
import { slugify } from '../lib/slug'
import type { StoredProfile } from '../types'
import { useAuthStore } from '../store/authStore'

export function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { profile: profileParam } = useParams()
  const mode = useAuthStore((s) => s.mode)
  const [pendingDelete, setPendingDelete] = useState<StoredProfile | null>(null)

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  const remove = useMutation({
    mutationFn: (p: StoredProfile) => deleteProfile(p.id),
    onSuccess: (_result, p) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success(`Profile “${p.label}” deleted`)
      setPendingDelete(null)
    },
  })

  if (mode === 'guest') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Settings">
          <p className="text-sm text-muted-foreground">
            You're in guest mode. Credentials are stored only in this browser. Use
            the endpoint control in the bottom bar to target a local endpoint, or
            log out to switch accounts.
          </p>
        </Card>
        <ThemeSettingsCard />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ThemeSettingsCard />
      <Card title="Stored AWS profiles">
        {profiles.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ul className="divide-y">
            {(profiles.data ?? []).map((p) => {
              const active = slugify(p.label) === profileParam
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {p.label}
                      {active && <Badge variant="secondary">active</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.access_key_id} · {p.default_region}
                      {p.endpoint_url ? ` · ${p.endpoint_url}` : ''}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/${slugify(p.label)}`)}>
                    Open
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setPendingDelete(p)}>
                    Delete
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Add profile">
        <ProfileForm onSuccess={(created) => navigate(`/${slugify(created.label)}`)} />
      </Card>

      <Dialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete profile?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.label}” and its stored credentials will be removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && remove.mutate(pendingDelete)}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
