import {
  Boxes,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Smartphone,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  NavLink,
  useNavigate,
} from 'react-router-dom'

import { useAuth } from '../../app/AuthContext'

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

function getInitials(
  value: string,
): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'HU'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function formatRole(
  role?: string,
): string {
  if (!role) {
    return 'Hive User'
  }

  return role
    .split('_')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(' ')
}

export function AppShell({
  children,
}: AppShellProps) {
  const navigate = useNavigate()

  const {
    user,
    organizations,
    activeOrganization,
    logout,
    setActiveOrganization,
  } = useAuth()

  const displayName =
    user?.display_name?.trim() ||
    user?.username ||
    'Hive User'

  function handleLogout() {
    logout()
    navigate('/login', {
      replace: true,
    })
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <div className="app-sidebar-logo">
            H
          </div>

          <div>
            <strong>Hive</strong>
            <span>Device Operations</span>
          </div>
        </div>

        {organizations.length > 0 && (
          <div className="app-organization">
            <label htmlFor="active-organization">
              Organisation
            </label>

            <select
              id="active-organization"
              onChange={(event) => {
                const organization =
                  organizations.find(
                    (item) =>
                      item.id ===
                      event.target.value,
                  )

                if (organization) {
                  setActiveOrganization(
                    organization,
                  )
                }
              }}
              value={
                activeOrganization?.id ?? ''
              }
            >
              {organizations.map(
                (organization) => (
                  <option
                    key={organization.id}
                    value={organization.id}
                  >
                    {organization.name}
                  </option>
                ),
              )}
            </select>
          </div>
        )}

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
                <Icon
                  size={18}
                  aria-hidden="true"
                />

                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar">
              {getInitials(displayName)}
            </div>

            <div className="app-sidebar-user-details">
              <strong>{displayName}</strong>

              <span>
                {formatRole(user?.role)}
              </span>
            </div>

            <button
              aria-label="Sign out"
              className="app-sidebar-logout"
              onClick={handleLogout}
              title="Sign out"
              type="button"
            >
              <LogOut
                size={18}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </aside>

      <main className="app-shell-main">
        {children}
      </main>
    </div>
  )
}