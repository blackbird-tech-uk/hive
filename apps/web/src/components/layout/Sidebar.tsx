import {
  Box,
  CalendarDays,
  LayoutDashboard,
  Radio,
  Settings,
  Wrench,
} from 'lucide-react'

const navigationItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Devices', icon: Radio, active: true },
  { label: 'Events', icon: CalendarDays },
  { label: 'Inventory', icon: Box },
  { label: 'Repairs', icon: Wrench },
  { label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          H
        </div>

        <div>
          <p className="eyebrow">BLACKBIRD</p>
          <h1>Hive</h1>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigationItems.map(({ label, icon: Icon, active }) => (
          <button
            className={`nav-item${active ? ' nav-item-active' : ''}`}
            key={label}
            type="button"
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" />

        <div>
          <strong>Hive API</strong>
          <p>Connected locally</p>
        </div>
      </div>
    </aside>
  )
}