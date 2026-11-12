import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search, Package } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { getDevices, type Device } from '../lib/api'

function assetName(device: Device): string {
  return device.asset_id || device.hive_id || device.serial_number
}

export function InventoryPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setDevices(await getDevices())
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load inventory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => devices.filter((device) =>
    [device.asset_id, device.hive_id, device.serial_number, device.model, device.condition, device.status]
      .some((value) => value?.toLowerCase().includes(query.toLowerCase().trim())),
  ), [devices, query])

  const needingAttention = devices.filter((device) =>
    device.condition !== 'good' || device.status === 'repair' || device.status === 'lost',
  ).length

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
      </section>
      <section className="device-list-section">
        <div className="device-list-toolbar">
          <div className="device-search">
            <Search size={18} aria-hidden="true" />
            <input aria-label="Search inventory" placeholder="Search asset ID, serial, model or condition" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16}/> Refresh</button>
        </div>
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', textAlign: 'left', borderCollapse: 'separate', borderSpacing: '0 12px'}}>
            <thead><tr><th>Asset</th><th>Model</th><th>Serial</th><th>Condition</th><th>Status</th><th>Last seen</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.map((device) => (
                <tr key={device.id}>
                  <td><strong>{assetName(device)}</strong></td>
                  <td>{device.model || 'Unknown'}</td>
                  <td>{device.serial_number || 'Not recorded'}</td>
                  <td>{device.condition || 'Unknown'}</td>
                  <td>{device.status || 'Unknown'}</td>
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
