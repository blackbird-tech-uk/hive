import {
  CalendarPlus,
  ClipboardPlus,
  Smartphone,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useEffect, useMemo, useState } from 'react'

import { StatCard } from '../components/dashboard/StatCard'
import { TopBar } from '../components/layout/TopBar'
import {
  getDevices,
  getEvents,
  type Device,
  type Event,
} from '../lib/api'

type DashboardError = {
  devices?: string
  events?: string
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function getEventProgress(event: Event): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(event.start_date)
  const endDate = new Date(event.end_date)

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)

  if (today < startDate) {
    return 'Upcoming'
  }

  if (today > endDate) {
    return 'Finished'
  }

  return 'In progress'
}

export function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<DashboardError>({})

  async function loadDashboard() {
    setLoading(true)
    setErrors({})

    const [deviceResult, eventResult] = await Promise.allSettled([
      getDevices(),
      getEvents(),
    ])

    const nextErrors: DashboardError = {}

    if (deviceResult.status === 'fulfilled') {
      setDevices(deviceResult.value)
    } else {
      nextErrors.devices =
        deviceResult.reason instanceof Error
          ? deviceResult.reason.message
          : 'Unable to load devices.'
    }

    if (eventResult.status === 'fulfilled') {
      setEvents(eventResult.value)
    } else {
      nextErrors.events =
        eventResult.reason instanceof Error
          ? eventResult.reason.message
          : 'Unable to load events.'
    }

    setErrors(nextErrors)
    setLoading(false)
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const deviceStats = useMemo(() => {
    const available = devices.filter(
      (device) => device.status === 'available',
    ).length

    const assigned = devices.filter((device) =>
      ['assigned', 'in_use'].includes(device.status),
    ).length

    const repair = devices.filter((device) =>
      ['repair', 'maintenance'].includes(device.status),
    ).length

    const unavailable = devices.filter((device) =>
      ['offline', 'lost', 'retired'].includes(device.status),
    ).length

    return {
      total: devices.length,
      available,
      assigned,
      repair,
      unavailable,
    }
  }, [devices])

  const operationalEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return [...events]
      .filter((event) => {
        const endDate = new Date(event.end_date)
        endDate.setHours(23, 59, 59, 999)

        return (
          endDate >= today &&
          !['cancelled', 'archived'].includes(event.status)
        )
      })
      .sort(
        (firstEvent, secondEvent) =>
          new Date(firstEvent.start_date).getTime() -
          new Date(secondEvent.start_date).getTime(),
      )
      .slice(0, 5)
  }, [events])

  return (
    <>
      <TopBar
        isLoading={loading}
        onRefresh={() => void loadDashboard()}
      />

      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">OPERATIONS OVERVIEW</p>
          <h1>Dashboard</h1>
          <p>
            Monitor scanner availability, assignments and upcoming events.
          </p>
        </div>
      </section>

      <section className="dashboard-quick-actions">
  <Link
    className="dashboard-quick-action"
    to="/devices"
  >
    <span className="dashboard-quick-action-icon">
      <Smartphone size={20} aria-hidden="true" />
    </span>

    <span>
      <strong>Manage Scanners</strong>
      <small>View, search and edit devices</small>
    </span>
  </Link>

  <Link
    className="dashboard-quick-action"
    to="/events"
  >
    <span className="dashboard-quick-action-icon">
      <CalendarPlus size={20} aria-hidden="true" />
    </span>

    <span>
      <strong>Create Event</strong>
      <small>Prepare a new show or event</small>
    </span>
  </Link>

  <Link
    className="dashboard-quick-action"
    to="/assignments"
  >
    <span className="dashboard-quick-action-icon">
      <ClipboardPlus size={20} aria-hidden="true" />
    </span>

    <span>
      <strong>Assign Scanner</strong>
      <small>Allocate kit to an event</small>
    </span>
  </Link>

  <Link
    className="dashboard-quick-action"
    to="/devices"
  >
    <span className="dashboard-quick-action-icon">
      <Wrench size={20} aria-hidden="true" />
    </span>

    <span>
      <strong>Repair Queue</strong>
      <small>Review devices needing attention</small>
    </span>
  </Link>
</section>

      {errors.devices && (
        <div className="dashboard-alert" role="alert">
          <strong>Device data unavailable.</strong>
          <span>{errors.devices}</span>
        </div>
      )}

      <section className="metric-grid">
        <StatCard
          label="Total Devices"
          value={deviceStats.total}
          description="Registered in Hive"
        />

        <StatCard
          label="Available"
          value={deviceStats.available}
          description="Ready to assign"
        />

        <StatCard
          label="Assigned"
          value={deviceStats.assigned}
          description="Currently allocated"
        />

        <StatCard
          label="Repair"
          value={deviceStats.repair}
          description="Needs attention"
        />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <header className="dashboard-panel-header">
            <div>
              <p className="eyebrow">EVENT OPERATIONS</p>
              <h2>Active and upcoming events</h2>
            </div>

            <span className="dashboard-count">
              {operationalEvents.length}
            </span>
          </header>

          {errors.events ? (
            <div className="dashboard-empty-state">
              <h3>Event data is not connected yet</h3>
              <p>
                The dashboard is ready, but the event backend route still
                needs to be implemented.
              </p>
            </div>
          ) : operationalEvents.length === 0 ? (
            <div className="dashboard-empty-state">
              <h3>No upcoming events</h3>
              <p>Create an event to begin assigning scanners.</p>
            </div>
          ) : (
            <div className="dashboard-event-list">
              {operationalEvents.map((event) => (
                <article
                  className="dashboard-event-card"
                  key={event.id}
                >
                  <div className="dashboard-event-main">
                    <div>
                      <h3>{event.name}</h3>
                      <p>{event.venue}</p>
                    </div>

                    <span className="badge subtle-badge">
                      {getEventProgress(event)}
                    </span>
                  </div>

                  <div className="dashboard-event-dates">
                    <span>
                      {formatDate(event.start_date)}
                    </span>

                    <span aria-hidden="true">→</span>

                    <span>
                      {formatDate(event.end_date)}
                    </span>
                  </div>

                  <div className="dashboard-allocation">
                    <div>
                      <span>Scanner allocation</span>
                      <strong>Assignment data pending</strong>
                    </div>

                    <div
                      aria-label="Scanner allocation not yet available"
                      className="dashboard-progress-track"
                    >
                      <span
                        className="dashboard-progress-value"
                        style={{ width: '0%' }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-panel">
          <header className="dashboard-panel-header">
            <div>
              <p className="eyebrow">DEVICE HEALTH</p>
              <h2>Fleet summary</h2>
            </div>
          </header>

          <div className="dashboard-status-list">
            <div className="dashboard-status-row">
              <span>Available</span>
              <strong>{deviceStats.available}</strong>
            </div>

            <div className="dashboard-status-row">
              <span>Assigned or in use</span>
              <strong>{deviceStats.assigned}</strong>
            </div>

            <div className="dashboard-status-row">
              <span>Repair or maintenance</span>
              <strong>{deviceStats.repair}</strong>
            </div>

            <div className="dashboard-status-row">
              <span>Offline, lost or retired</span>
              <strong>{deviceStats.unavailable}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-activity-panel">
          <header className="dashboard-panel-header">
            <div>
              <p className="eyebrow">RECENT ACTIVITY</p>
              <h2>Assignment activity</h2>
            </div>
          </header>

          <div className="dashboard-empty-state">
            <h3>No activity recorded yet</h3>
            <p>
              Assignment and return actions will appear here once the
              assignment API is connected.
            </p>
          </div>
        </article>
      </section>
    </>
  )
}