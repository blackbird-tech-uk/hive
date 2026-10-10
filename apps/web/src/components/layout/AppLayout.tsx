import type { ReactNode } from 'react'

import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="application-shell">
      <Sidebar />

      <main className="dashboard-content">
        {children}
      </main>
    </div>
  )
}