import {
  OctagonX,
  Play,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type {
  InstalledApplication,
} from '../../lib/api'

type ApplicationCommand =
  | 'LAUNCH_APP'
  | 'FORCE_STOP_APP'
  | 'UNINSTALL_APP'

type ApplicationFilter =
  | 'all'
  | 'user'
  | 'system'
  | 'enabled'
  | 'disabled'

type Props = {
  applications: InstalledApplication[]
  loading: boolean
  error: string | null
  sendingCommand: string | null
  onReload: () => void
  onRefreshInventory: () => Promise<void>
  onCommand: (
    command: ApplicationCommand,
    application: InstalledApplication,
  ) => Promise<void>
}

export function ApplicationInventoryPanel({
  applications,
  loading,
  error,
  sendingCommand,
  onReload,
  onRefreshInventory,
  onCommand,
}: Props) {
  const [searchQuery, setSearchQuery] =
    useState('')
  const [filter, setFilter] =
    useState<ApplicationFilter>('all')

  const filteredApplications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return applications.filter((application) => {
      const name =
        application.app_name ??
        application.package_name

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        application.package_name
          .toLowerCase()
          .includes(query) ||
        (application.version_name ?? '')
          .toLowerCase()
          .includes(query)

      if (!matchesSearch) {
        return false
      }

      switch (filter) {
        case 'user':
          return !application.is_system_app
        case 'system':
          return application.is_system_app
        case 'enabled':
          return application.is_enabled
        case 'disabled':
          return !application.is_enabled
        default:
          return true
      }
    })
  }, [applications, filter, searchQuery])

  async function handleCommand(
    command: ApplicationCommand,
    application: InstalledApplication,
  ) {
    const name =
      application.app_name ??
      application.package_name

    if (
      command === 'FORCE_STOP_APP' &&
      !window.confirm(
        `Request force stop for ${name}? Standard Android agents may reject this action.`,
      )
    ) {
      return
    }

    if (
      command === 'UNINSTALL_APP' &&
      !window.confirm(
        `Request uninstall for ${name}? Android will require confirmation on the device.`,
      )
    ) {
      return
    }

    await onCommand(command, application)
  }

  return (
    <section className="device-dashboard-panel">
      <div className="device-dashboard-panel-header">
        <div>
          <p className="eyebrow">
            APPLICATION MANAGEMENT
          </p>
          <h2>Installed applications</h2>
        </div>

        <button
          aria-label="Reload application inventory"
          className="icon-button"
          disabled={loading}
          onClick={onReload}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? 'spin' : ''}
            size={17}
          />
        </button>
      </div>

      <div className="device-applications-toolbar">
        <label className="device-app-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search installed applications"
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search app, package or version..."
            type="search"
            value={searchQuery}
          />
        </label>

        <select
          aria-label="Filter installed applications"
          className="device-app-filter"
          onChange={(event) =>
            setFilter(
              event.target.value as ApplicationFilter,
            )
          }
          value={filter}
        >
          <option value="all">All apps</option>
          <option value="user">User apps</option>
          <option value="system">System apps</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        <button
          className="secondary-button"
          disabled={sendingCommand !== null || loading}
          onClick={() =>
            void onRefreshInventory()
          }
          type="button"
        >
          Refresh from device
        </button>
      </div>

      <div className="device-applications-summary">
        <strong>{filteredApplications.length}</strong>
        <span>
          shown of {applications.length} reported
        </span>
      </div>

      <p className="device-app-management-note">
        Launch works for apps with a launchable activity.
        Force stop requires privileged Android/OEM management.
        Uninstall opens Android confirmation on this non-device-owner device.
      </p>

      {loading && applications.length === 0 ? (
        <div className="device-dashboard-empty">
          <p>Loading installed applications...</p>
        </div>
      ) : error ? (
        <p
          className="device-dashboard-command-error"
          role="alert"
        >
          {error}
        </p>
      ) : applications.length === 0 ? (
        <div className="device-dashboard-empty">
          <p>No application inventory has been reported yet.</p>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="device-dashboard-empty">
          <p>No applications match the current search or filter.</p>
        </div>
      ) : (
        <div className="device-applications-table-wrapper">
          <table className="device-applications-table device-applications-management-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Package</th>
                <th>Version</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredApplications.map((application) => {
                const name =
                  application.app_name ??
                  application.package_name

                return (
                  <tr key={application.id}>
                    <td><strong>{name}</strong></td>
                    <td><code>{application.package_name}</code></td>
                    <td>
                      {application.version_name ??
                        'Not reported'}
                    </td>
                    <td>
                      <span
                        className={`device-app-type ${
                          application.is_system_app
                            ? 'device-app-type-system'
                            : 'device-app-type-user'
                        }`}
                      >
                        {application.is_system_app
                          ? 'System'
                          : 'User'}
                      </span>
                    </td>
                    <td>
                      {application.is_enabled
                        ? 'Enabled'
                        : 'Disabled'}
                    </td>
                    <td>
                      <div className="device-app-actions">
                        <button
                          className="device-app-action"
                          disabled={sendingCommand !== null}
                          onClick={() =>
                            void handleCommand(
                              'LAUNCH_APP',
                              application,
                            )
                          }
                          type="button"
                        >
                          <Play aria-hidden="true" size={15} />
                          Launch
                        </button>

                        <button
                          className="device-app-action"
                          disabled={sendingCommand !== null}
                          onClick={() =>
                            void handleCommand(
                              'FORCE_STOP_APP',
                              application,
                            )
                          }
                          title="Requires privileged Android/OEM management"
                          type="button"
                        >
                          <OctagonX aria-hidden="true" size={15} />
                          Stop
                        </button>

                        <button
                          className="device-app-action device-app-action-danger"
                          disabled={
                            sendingCommand !== null ||
                            application.is_system_app
                          }
                          onClick={() =>
                            void handleCommand(
                              'UNINSTALL_APP',
                              application,
                            )
                          }
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                          Uninstall
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
