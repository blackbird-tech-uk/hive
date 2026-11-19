import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, Search, Package } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { getAssignments, getDevices, getEvents, type Assignment, type Event, type Device } from '../lib/api'

const IDLE_WARNING_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function assetName(device: Device): string {
  return device.asset_id || device.hive_id || device.serial_number
}

function readiness(device: Device, now: number): 'never' | 'idle' | 'recent' {
  if (!device.last_seen_at) return 'never'
  const seen = new Date(device.last_seen_at).getTime()
  if (!Number.isFinite(seen)) return 'never'
  return now - seen > IDLE_WARNING_DAYS * DAY_MS ? 'idle' : 'recent'
}

export function InventoryPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [eventFilter, setEventFilter] = useState('all')
  const [batteryFilter, setBatteryFilter] = useState(false)
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'attention'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [fleet, eventList, assignmentList] = await Promise.all([getDevices(), getEvents(), getAssignments()])
      setDevices(fleet)
      setEvents(eventList)
      setAssignments(assignmentList)
      setNow(Date.now())
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load inventory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => devices.filter((device) =>
    (readinessFilter === 'all' || readiness(device, now) !== 'recent') &&
    (!batteryFilter || (device.battery_level !== null && device.battery_level < 30)) &&
    (eventFilter === 'all' || assignments.some((assignment) => assignment.device_id === device.id && assignment.event_id === eventFilter && assignment.status === 'assigned')) &&
    [device.asset_id, device.hive_id, device.serial_number, device.model, device.condition, device.status]
      .some((value) => value?.toLowerCase().includes(query.toLowerCase().trim())),
  ), [devices, query, readinessFilter, now, batteryFilter, eventFilter, assignments])

  const needingAttention = devices.filter((device) =>
    device.condition !== 'good' || device.status === 'repair' || device.status === 'lost',
  ).length
  const idleCount = devices.filter((device) => readiness(device, now) === 'idle').length
  const neverCount = devices.filter((device) => readiness(device, now) === 'never').length

  return (
    <>
      <TopBar isLoading={loading} onRefresh={() => void refresh()} />
      <section className="page-heading">
        <div>
          <p className="eyebrow">EQUIPMENT CONTROL</p>
          <h1>Inventory</h1>
          <p>Scanner assets already enrolled in HIVE. Other equipment types will be added when the asset registry is ready.</p>
        </div>
      </section>
      {error && <div className="dashboard-alert" role="alert"><strong>Inventory unavailable</strong><span>{error}</span></div>}
      <section className="metric-grid">
        <article className="device-dashboard-summary-card"><Package size={22}/><div><span>Registered scanners</span><strong>{devices.length}</strong></div></article>
        <article className="device-dashboard-summary-card"><Package size={22}/><div><span>Needs inspection</span><strong>{needingAttention}</strong></div></article>
        <article className="device-dashboard-summary-card"><AlertTriangle size={22}/><div><span>Idle over 30 days</span><strong>{idleCount}</strong></div></article>
        <article className="device-dashboard-summary-card"><ClipboardCheck size={22}/><div><span>Never checked in</span><strong>{neverCount}</strong></div></article>
      </section>
      <section className="device-list-section" aria-label="Pre-show scanner readiness">
        <h2><ClipboardCheck size={20} aria-hidden="true"/> Pre-show scanner readiness</h2>
        <p>Use this checklist before scanners leave the office. HIVE heartbeat history does not confirm Google sign-in or app availability.</p>
        <ul>
          <li>Wake the scanner and confirm it connects to HIVE.</li>
          <li>Open Chrome and verify the required event site loads.</li>
          <li>Open Smart Scan and verify it works with a test badge.</li>
          <li>Open Google Play and confirm the account can access app updates without an unresolved sign-in prompt.</li>
          <li>Check battery and charging before packing the scanner.</li>
        </ul>
        <p><CheckCircle2 size={16} aria-hidden="true"/> App installation and Google Play checks require staff confirmation; they are not automatically verified here.</p>
      </section>
      <section className="device-list-section">
        <div className="device-list-toolbar">
          <div className="device-search">
            <Search size={18} aria-hidden="true" />
            <input aria-label="Search inventory" placeholder="Search asset ID, serial, model or condition" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <label>Event <select aria-label="Filter by event" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
            <option value="all">All events</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select></label>
          <label><input type="checkbox" checked={batteryFilter} onChange={(event) => setBatteryFilter(event.target.checked)} /> Battery below 30%</label>
          <button className="secondary-button" type="button" aria-pressed={readinessFilter === 'attention'} onClick={() => setReadinessFilter((current) => current === 'all' ? 'attention' : 'all')}>{readinessFilter === 'attention' ? 'Show all' : 'Show idle / never seen'}</button>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16}/> Refresh</button>
        </div>
        <p>{filtered.length} of {devices.length} scanners shown. Event filter includes currently assigned scanners only. Battery filter excludes devices with no reported battery reading.</p>
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', textAlign: 'left', borderCollapse: 'separate', borderSpacing: '0 12px'}}>
            <thead><tr><th>Asset</th><th>Model</th><th>Serial</th><th>Condition</th><th>Status</th><th>Readiness check</th><th>Last seen</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.map((device) => (
                <tr key={device.id}>
                  <td><strong>{assetName(device)}</strong></td>
                  <td>{device.model || 'Unknown'}</td>
                  <td>{device.serial_number || 'Not recorded'}</td>
                  <td>{device.condition || 'Unknown'}</td>
                  <td>{device.status || 'Unknown'}</td>
                  <td>{readiness(device, now) === 'idle' ? 'Idle > 30 days — inspect' : readiness(device, now) === 'never' ? 'Never checked in — inspect' : 'Recently connected — manual checks still required'}</td>
                  <td>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('en-GB') : 'Never'}</td>
                  <td><Link to={`/devices/${device.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <p>No matching scanners found.</p>}
        </div>
      </section>
    </>
  )
}
