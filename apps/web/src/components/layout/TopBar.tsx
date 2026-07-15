import { Bell, RefreshCw } from 'lucide-react'

interface TopBarProps {
  isLoading?: boolean
  onRefresh?: () => void
}

export function TopBar({
  isLoading = false,
  onRefresh,
}: TopBarProps) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">DEVICE OPERATIONS</p>
        <h2>Devices</h2>
        <p className="page-description">
          Monitor and manage every scanner registered with Hive.
        </p>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-button"
          aria-label="Notifications"
          type="button"
        >
          <Bell size={17} aria-hidden="true" />
        </button>

        <button
          className="secondary-button"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>
    </header>
  )
}