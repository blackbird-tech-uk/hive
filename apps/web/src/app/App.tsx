import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import {
  AuthProvider,
  useAuth,
} from './AuthContext'
import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../pages/Dashboard'
import { DeviceDashboardPage } from '../pages/DeviceDashboard'
import { DevicesPage } from '../pages/Devices'
import { FleetMapPage } from '../pages/FleetMap'
import { EnrollmentsPage } from '../pages/Enrollments'
import { LoginPage } from '../pages/Login'


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

function LoadingScreen() {
  return (
    <main className="auth-loading">
      <div className="auth-loading-logo">
        H
      </div>

      <p>Loading Hive…</p>
    </main>
  )
}

function ProtectedApplication() {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        replace
        to="/login"
      />
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              replace
              to="/dashboard"
            />
          }
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/enrollments"
          element={<EnrollmentsPage />}
        />

        <Route
          path="/devices"
          element={<DevicesPage />}
        />

        <Route
          path="/map"
          element={<FleetMapPage />}
        />

<Route
  path="/devices/:deviceId"
  element={<DeviceDashboardPage />}
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
          element={
            <Navigate
              replace
              to="/dashboard"
            />
          }
        />
      </Routes>
    </AppShell>
  )
}

function ApplicationRoutes() {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isLoading ? (
            <LoadingScreen />
          ) : isAuthenticated ? (
            <Navigate
              replace
              to="/dashboard"
            />
          ) : (
            <LoginPage />
          )
        }
      />

      <Route
        path="/*"
        element={
          <ProtectedApplication />
        }
      />
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      <ApplicationRoutes />
    </AuthProvider>
  )
}