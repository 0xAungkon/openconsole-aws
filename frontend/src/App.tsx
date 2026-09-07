import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './pages/AppLayout'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { GuestCredentials } from './pages/GuestCredentials'
import { ModeChooser } from './pages/ModeChooser'
import { ProfilesPage } from './pages/ProfilesPage'
import { ServicePage } from './pages/ServicePage'
import { useAuthStore } from './store/authStore'

function RequireAuth({ children }: { children: ReactNode }) {
  const { mode, token, guestCreds } = useAuthStore()
  if (mode === 'guest' && guestCreds) return <>{children}</>
  if (mode === 'register' && token) return <>{children}</>
  if (mode === 'guest') return <Navigate to="/guest" replace />
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ModeChooser />} />
      <Route path="/guest" element={<GuestCredentials />} />
      <Route path="/login" element={<AuthPage initialTab="login" />} />
      <Route path="/register" element={<AuthPage initialTab="register" />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profiles" element={<ProfilesPage />} />
        <Route path=":service" element={<ServicePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
