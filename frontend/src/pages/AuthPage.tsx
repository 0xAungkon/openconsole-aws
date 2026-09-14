import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { login, register } from '../api/auth'
import { errorMessage } from '../lib/errors'
import { ErrorAlert } from '../components/ErrorAlert'
import { useAuthStore } from '../store/authStore'

type Tab = 'login' | 'register'

export function AuthPage({ initialTab = 'login' }: { initialTab?: Tab }) {
  const navigate = useNavigate()
  const setRegister = useAuthStore((s) => s.setRegister)

  const [tab, setTab] = useState<Tab>(initialTab)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data =
        tab === 'register'
          ? await register(name, email, password)
          : await login(email, password)
      setRegister(data.access_token, data.user)
      toast.success(
        tab === 'register'
          ? `Account created — welcome, ${data.user.name}!`
          : `Signed in as ${data.user.name}`,
      )
      // Onboarding resolves to the first profile, or prompts to create one.
      navigate('/onboarding')
    } catch (err) {
      // Inline alert stays by the form; the toast draws attention to it.
      setError(err)
      toast.error(errorMessage(err), { id: 'auth-error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
          </Tabs>
          <CardTitle className="mt-2">
            {tab === 'register' ? 'Create your account' : 'Welcome back'}
          </CardTitle>
          <CardDescription>
            {tab === 'register'
              ? 'Store AWS profiles securely and reuse them across sessions.'
              : 'Sign in to access your stored AWS profiles.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            {tab === 'register' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="auth-name">Name</Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={8}
              />
            </div>

            {error != null && <ErrorAlert error={error} />}

            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? 'Please wait…' : tab === 'register' ? 'Create account' : 'Sign in'}
            </Button>

            <Button
              type="button"
              variant="link"
              onClick={() => navigate('/')}
              className="w-full text-muted-foreground"
            >
              ← Back to mode selection
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
