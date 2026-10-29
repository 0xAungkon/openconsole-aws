import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './pages/AppLayout'
import { AccessPage } from './pages/AccessPage'
import { AuthPage } from './pages/AuthPage'
import { IamGroupPage } from './pages/IamGroupPage'
import { IamPolicyPage } from './pages/IamPolicyPage'
import { IamRolePage } from './pages/IamRolePage'
import { IamUserPage } from './pages/IamUserPage'
import { BucketPage } from './pages/BucketPage'
import { DatabasePage } from './pages/DatabasePage'
import { DatabasesPage } from './pages/DatabasesPage'
import { Ec2InstancePage } from './pages/Ec2InstancePage'
import { Ec2Page } from './pages/Ec2Page'
import { FunctionPage } from './pages/FunctionPage'
import { FunctionsPage } from './pages/FunctionsPage'
import { ModeChooser } from './pages/ModeChooser'
import { NotFound } from './pages/NotFound'
import { OnboardingPage } from './pages/OnboardingPage'
import { Overview } from './pages/Overview'
import { ServicePage } from './pages/ServicePage'
import { SettingsPage } from './pages/SettingsPage'
import { StoragePage } from './pages/StoragePage'
import { TablePage } from './pages/TablePage'
import { TablesPage } from './pages/TablesPage'
import { useAuthStore } from './store/authStore'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

function RequireAuth({ children }: { children: ReactNode }) {
  const { mode, token } = useAuthStore()
  // Guest mode is allowed even before credentials exist — the layout shows the
  // connect gate. Register mode requires a token.
  if (mode === 'guest') return <>{children}</>
  if (mode === 'register' && token) return <>{children}</>
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
    {/* On phones sonner forces a full-width stack, so `mobileOffset` (not
        `offset`) is what keeps toasts above the bottom dock. */}
    <Toaster
      position="bottom-right"
      offset={{ bottom: 48, right: 16 }}
      mobileOffset={{ bottom: 48, left: 12, right: 12 }}
      closeButton
      richColors
    />
    <Routes>
      <Route path="/" element={<ModeChooser />} />
      <Route path="/login" element={<AuthPage initialTab="login" />} />
      <Route path="/register" element={<AuthPage initialTab="register" />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />

      <Route
        path="/:profile"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="compute" element={<Ec2Page />} />
        <Route path="compute/:instanceId" element={<Ec2InstancePage />} />
        <Route path="storage" element={<StoragePage />} />
        <Route path="storage/:bucket" element={<BucketPage />} />
        <Route path="functions" element={<FunctionsPage />} />
        <Route path="functions/:name" element={<FunctionPage />} />
        <Route path="databases" element={<DatabasesPage />} />
        <Route path="databases/:id" element={<DatabasePage />} />
        <Route path="nosql" element={<TablesPage />} />
        <Route path="nosql/:table" element={<TablePage />} />
        <Route path="access" element={<AccessPage />} />
        <Route path="access/users/:name" element={<IamUserPage />} />
        <Route path="access/roles/:name" element={<IamRolePage />} />
        <Route path="access/groups/:name" element={<IamGroupPage />} />
        <Route path="access/policies/:arn" element={<IamPolicyPage />} />
        <Route path=":service" element={<ServicePage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </TooltipProvider>
  )
}
