import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl font-bold text-primary">404</div>
      <p className="text-sm text-muted-foreground">
        This page doesn't exist, or you don't have access to this profile.
      </p>
      <Button onClick={() => navigate('/')}>Go home</Button>
    </div>
  )
}
