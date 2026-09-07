import {
  Hexagon,
  Home,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { CATALOG } from '../services/catalog'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

interface SidebarProps {
  onEndpointClick: () => void
}

export function Sidebar({ onEndpointClick }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, endpointUrl } = useSessionStore()
  const mode = useAuthStore((s) => s.mode)

  const navItems: { key: string; label: string; icon: LucideIcon; end: boolean }[] = [
    { key: '', label: 'Overview', icon: Home, end: true },
    ...CATALOG.map((s) => ({ key: s.key, label: s.label, icon: s.icon, end: false })),
    ...(mode === 'register'
      ? [{ key: 'profiles', label: 'Profiles', icon: Lock, end: false }]
      : []),
  ]

  const linkBase =
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition'

  return (
    <aside
      className={`flex flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      } shrink-0 transition-[width]`}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Hexagon className="h-5 w-5 text-brand-500" />
            <span className="text-sm font-semibold leading-tight text-gray-800 dark:text-gray-100">
              AWS
              <br />
              OpenConsole
            </span>
          </div>
        )}
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
          <NavLink
            key={item.key || 'overview'}
            to={item.key ? `/app/${item.key}` : '/app'}
            end={item.end}
            className={({ isActive }) =>
              `${linkBase} ${
                isActive
                  ? 'bg-brand-50 font-medium text-brand-700 dark:bg-gray-800 dark:text-brand-300'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`
            }
            title={item.label}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={onEndpointClick}
        className="m-2 flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
        title="Configure endpoint"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            endpointUrl ? 'bg-amber-500' : 'bg-green-500'
          }`}
        />
        {!sidebarCollapsed && (
          <span className="truncate">
            {endpointUrl ? endpointUrl : 'AWS (default endpoint)'}
          </span>
        )}
      </button>
    </aside>
  )
}
