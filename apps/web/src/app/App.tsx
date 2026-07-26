import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../pages/Dashboard'
import { DevicesPage } from '../pages/Devices'

function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <section className="placeholder-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route
          path="/"
          element={<Navigate replace to="/dashboard" />}
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/devices"
          element={<DevicesPage />}
        />

        <Route
          path="/events"
          element={
            <PlaceholderPage
              eyebrow="EVENT OPERATIONS"
              title="Events"
              description="Create events and manage scanner allocations."
            />
          }
        />

        <Route
          path="/assignments"
          element={
            <PlaceholderPage
              eyebrow="DEVICE ASSIGNMENTS"
              title="Assignments"
              description="Track scanners assigned to events and staff."
            />
          }
        />

        <Route
          path="/reports"
          element={
            <PlaceholderPage
              eyebrow="REPORTING"
              title="Reports"
              description="Export fleet, event and assignment reports."
            />
          }
        />

        <Route
          path="/settings"
          element={
            <PlaceholderPage
              eyebrow="HIVE CONFIGURATION"
              title="Settings"
              description="Manage users, defaults and platform settings."
            />
          }
        />

        <Route
          path="*"
          element={<Navigate replace to="/dashboard" />}
        />
      </Routes>
    </AppShell>
  )
}