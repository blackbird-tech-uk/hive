import {
  Boxes,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Smartphone,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface AppShellProps {
  children: ReactNode
}

const navigationItems = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Devices',
    to: '/devices',
    icon: Smartphone,
  },
  {
    label: 'Events',
    to: '/events',
    icon: CalendarDays,
  },
  {
    label: 'Assignments',
    to: '/assignments',
    icon: ClipboardList,
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: Boxes,
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: Settings,
  },
]

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <div className="app-sidebar-logo">H</div>

          <div>
            <strong>Hive</strong>
            <span>Device Operations</span>
          </div>
        </div>

        <nav className="app-sidebar-navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? 'app-sidebar-link app-sidebar-link-active'
                    : 'app-sidebar-link'
                }
                key={item.to}
                to={item.to}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">DG</div>

            <div>
              <strong>Derek</strong>
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-shell-main">{children}</main>
    </div>
  )
}