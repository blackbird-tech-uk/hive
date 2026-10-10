import { Battery, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { getDevices } from '../lib/api'
import { getLatestDeviceLocations } from '../lib/api/locations'
import type { Device, DeviceLocation } from '../lib/api/types'
import { isDeviceOnline } from '../lib/fleet'

function ageLabel(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

export function FleetMapPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [locations, setLocations] = useState<DeviceLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextDevices, nextLocations] = await Promise.all([
        getDevices(),
        getLatestDeviceLocations(),
      ])
      setDevices(nextDevices)
      setLocations(nextLocations)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load fleet locations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const rows = useMemo(() => locations.map((location) => ({
    location,
    device: devices.find((device) => device.id === location.device_id),
  })).filter((row) => row.device), [devices, locations])

  return <>
    <TopBar isLoading={loading} onRefresh={() => void load()} />
    <section className="page-heading">
      <div><p className="eyebrow">FIELD TELEMETRY</p><h1>Fleet Map</h1><p>Latest reported scanner positions. Locations are timestamped and may not be live.</p></div>
    </section>
    {error && <div className="dashboard-alert" role="alert"><strong>Map data unavailable</strong><span>{error}</span></div>}
    <section className="fleet-map-panel">
      <div className="fleet-map-summary"><MapPin size={18}/><strong>{rows.length}</strong><span>scanners reporting location</span><button className="secondary-button" onClick={() => void load()} type="button"><RefreshCw size={15}/>Refresh</button></div>
      <div className="fleet-map-grid">
        {rows.map(({ device, location }) => {
          if (!device) return null
          const online = isDeviceOnline(device, Date.now())
          const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
          return <article className="fleet-map-card" key={device.id}>
            <div className="fleet-map-card-head"><div><p className="eyebrow">SCANNER</p><h2>{device.hive_id || device.asset_id}</h2></div><span className={online ? 'fleet-map-online' : 'fleet-map-offline'}>{online ? <Wifi size={15}/> : <WifiOff size={15}/>} {online ? 'Online' : 'Offline'}</span></div>
            <div className="fleet-map-meta"><span><Battery size={15}/>{device.battery_level == null ? 'Battery unknown' : `${device.battery_level}%${device.is_charging ? ' · charging' : ''}`}</span><span><MapPin size={15}/>Updated {ageLabel(location.recorded_at)}</span></div>
            <p className="fleet-map-coordinates">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}{location.accuracy != null ? ` · ±${Math.round(location.accuracy)}m` : ''}</p>
            <a className="primary-button fleet-map-open" href={mapsUrl} rel="noreferrer" target="_blank">Open last known location</a>
          </article>
        })}
        {!loading && rows.length === 0 && <div className="device-search-empty"><MapPin size={28}/><h2>No scanner locations yet</h2><p>Locations will appear after an enrolled Hive Agent reports its first fix.</p></div>}
      </div>
    </section>
  </>
}
