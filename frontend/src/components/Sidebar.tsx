import { useState } from 'react'
import { cn } from 'cn'
import { flushHistory } from '../store/historySync'
import {
  Hexagon,
  Home,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandLogo } from './BrandLogo'
import { CATALOG } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const linkBase =
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-ring'
const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(linkBase, isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground')

/** Wraps a nav item in a tooltip only while the sidebar is collapsed. */
function NavTip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactElement }) {
  if (!collapsed) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar } = useSessionStore()
  const [loggingOut, setLoggingOut] = useState(false)
  const reset = useAuthStore((s) => s.reset)

  const base = `/${profile ?? ''}`
  const navItems: {
    to: string
    label: string
    code?: string
    icon: LucideIcon
    end: boolean
  }[] = [
    { to: base, label: 'Overview', icon: Home, end: true },
    ...CATALOG.map((s) => ({
      to: `${base}/${s.route}`,
      label: s.label,
      code: s.code,
      icon: s.icon,
      end: false,
    })),
  ]

  async function logout() {
    setLoggingOut(true)
    if (await flushHistory()) {
      reset()
      navigate('/')
    }
    setLoggingOut(false)
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width]',
        sidebarCollapsed ? 'w-16' : 'w-56',
      )}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!sidebarCollapsed ? <BrandLogo /> : <Hexagon className="h-5 w-5 text-primary" />}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="text-muted-foreground"
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {navItems.map((item) => (
          <NavTip key={item.to} label={item.label} collapsed={sidebarCollapsed}>
            <NavLink to={item.to} end={item.end} className={linkClass} aria-label={item.label}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  {item.code && (
                    <Badge variant="outline" className="h-4 rounded px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.code}
                    </Badge>
                  )}
                </span>
              )}
            </NavLink>
          </NavTip>
        ))}
      </nav>

      <Separator />
      <div className="space-y-1 px-2 py-2">
        <NavTip label="Settings" collapsed={sidebarCollapsed}>
          <NavLink to={`${base}/settings`} className={linkClass} aria-label="Settings">
            <Settings className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </NavLink>
        </NavTip>
        <NavTip label="Log out" collapsed={sidebarCollapsed}>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className={cn(linkBase, 'w-full disabled:opacity-50')}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Log out</span>}
          </button>
        </NavTip>
      </div>
    </aside>
  )
}
