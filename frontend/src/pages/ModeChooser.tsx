import { Lock, Rocket } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandLogo } from '../components/BrandLogo'
import { useAuthStore } from '../store/authStore'

function ModeCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Rocket
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="group text-left focus-visible:outline-none">
      <Card className="h-full transition-all group-hover:ring-primary/40 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader>
          <Icon className="mb-2 h-6 w-6 text-primary" />
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </button>
  )
}

export function ModeChooser() {
  const navigate = useNavigate()
  const { mode, token, guestCreds, enterGuestMode } = useAuthStore()

  // Already signed in? Skip the chooser and go to the workspace.
  if (mode === 'register' && token) return <Navigate to="/onboarding" replace />
  if (mode === 'guest' && guestCreds) return <Navigate to="/guest" replace />

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1>
            <BrandLogo size="lg" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage AWS services through a friendly interface.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            icon={Rocket}
            title="Guest mode"
            description="No account. Your AWS credentials stay in this browser and are sent per request. Fastest way to start."
            onClick={() => {
              enterGuestMode()
              navigate('/guest')
            }}
          />
          <ModeCard
            icon={Lock}
            title="Register mode"
            description="Create an account and store AWS profiles securely (encrypted at rest) for reuse across sessions."
            onClick={() => navigate('/login')}
          />
        </div>
      </div>
    </div>
  )
}
