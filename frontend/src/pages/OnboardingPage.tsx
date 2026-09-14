import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '../components/BrandLogo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listProfiles } from '../api/auth'
import { ProfileForm } from '../components/ProfileForm'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'

/**
 * First-run onboarding / post-login resolver for register mode. If the user has
 * profiles, it redirects to the first one's URL; otherwise it shows a dedicated
 * page (same layout as guest/login) to create the first profile.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const { mode, reset } = useAuthStore()

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: mode === 'register',
  })

  if (mode !== 'register') return <Navigate to="/" replace />

  if (profiles.isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  // Already has a profile → go straight to it.
  if (profiles.data && profiles.data.length > 0) {
    return <Navigate to={`/${slugify(profiles.data[0].label)}`} replace />
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="relative">
          <ThemeToggle className="absolute top-0 right-4" />
          <div className="mb-3 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <CardTitle>Add your first AWS profile</CardTitle>
          <CardDescription>
            To start issuing queries, provide AWS credentials. They are encrypted at rest
            and reused across sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ProfileForm
            submitLabel="Create profile"
            onSuccess={(created) => navigate(`/${slugify(created.label)}`, { replace: true })}
          />
          <Button
            variant="link"
            onClick={() => {
              reset()
              navigate('/')
            }}
            className="w-full text-muted-foreground"
          >
            ← Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
