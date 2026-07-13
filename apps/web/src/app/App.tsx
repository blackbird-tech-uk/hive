import { Activity, Box, Radio, ShieldCheck } from 'lucide-react'

const foundations = [
  { label: 'Device fleet', detail: 'EA660 identity and health', icon: Radio },
  { label: 'Event operations', detail: 'Assignments, picks and returns', icon: Activity },
  { label: 'Inventory state', detail: 'Condition and availability', icon: Box },
  { label: 'Secure foundation', detail: 'Commercial-grade architecture', icon: ShieldCheck },
]

export function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">H</div>
        <div>
          <p className="eyebrow">BLACKBIRD</p>
          <h1>Hive</h1>
        </div>
        <span className="status-pill">Sprint 1 foundation</span>
      </header>

      <section className="hero">
        <p className="eyebrow">DEVICE OPERATIONS, BUILT PROPERLY</p>
        <h2>The operating layer for event devices.</h2>
        <p className="hero-copy">
          Hive is being built to give event teams a clear, live view of every scanner,
          assignment and operational risk.
        </p>
      </section>

      <section className="foundation-grid" aria-label="Hive foundations">
        {foundations.map(({ label, detail, icon: Icon }) => (
          <article className="foundation-card" key={label}>
            <Icon size={20} aria-hidden="true" />
            <h3>{label}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
