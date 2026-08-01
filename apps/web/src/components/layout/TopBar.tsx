import {
  Bell,
  RefreshCw,
} from 'lucide-react'

interface TopBarProps {
  isLoading?: boolean
  onRefresh?: () => void
}

export function TopBar({
  isLoading = false,
  onRefresh,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-actions">
        <button
          aria-label="Notifications"
          className="icon-button"
          type="button"
        >
          <Bell
            aria-hidden="true"
            size={17}
          />
        </button>

        <button
          className="secondary-button"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={
              isLoading ? 'spin' : ''
            }
            size={16}
          />

          Refresh
        </button>
      </div>
    </div>
  )
}