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
import { BRAND_BADGE, BRAND_NAME } from '../brand'
import { CATALOG } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

export function Sidebar() {
  const { profile } = useParams()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar } = useSessionStore()
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

  const linkBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition'
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${linkBase} ${
      isActive
        ? 'bg-brand-50 font-medium text-brand-700 dark:bg-gray-800 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`

  function logout() {
    reset()
    navigate('/')
  }

  return (
    <aside
      className={`flex flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      } shrink-0 transition-[width]`}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Hexagon className="h-5 w-5 shrink-0 text-brand-500" />
            <span className="text-sm font-semibold leading-tight text-gray-800 dark:text-gray-100">
              {BRAND_NAME}
              <sup className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-brand-500">
                {BRAND_BADGE}
              </sup>
            </span>
          </div>
        )}
        {sidebarCollapsed && <Hexagon className="h-5 w-5 text-brand-500" />}
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} title={item.label}>
            <item.icon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{item.label}</span>
                {item.code && (
                  <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    {item.code}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-gray-100 px-2 py-2 dark:border-gray-800">
        <NavLink to={`${base}/settings`} className={linkClass} title="Settings">
          <Settings className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </NavLink>
        <button
          type="button"
          onClick={logout}
          className={`${linkBase} w-full text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800`}
          title="Log out"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  )
}
