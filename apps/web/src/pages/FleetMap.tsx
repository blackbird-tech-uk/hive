import { Battery, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { getAssignments, getDevices } from '../lib/api'
import { getLatestDeviceLocations } from '../lib/api/locations'
import type { Assignment, Device, DeviceLocation } from '../lib/api/types'
import { isDeviceOnline } from '../lib/fleet'

function scannerIcon(label: string, online: boolean) {
  return divIcon({
    className: 'hive-scanner-marker-wrap',
    html: `<div class="hive-scanner-marker ${online ? 'is-online' : 'is-offline'}"><span class="hive-scanner-marker-dot"></span><strong>${label.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] ?? char))}</strong></div>`,
    iconSize: [86, 34],
    iconAnchor: [43, 34],
    popupAnchor: [0, -36],
  })
}

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
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextDevices, nextLocations, nextAssignments] = await Promise.all([
        getDevices(),
        getLatestDeviceLocations(),
        getAssignments(),
      ])
      setDevices(nextDevices)
      setLocations(nextLocations)
      setAssignments(nextAssignments)
      setError(null)
      setCurrentTime(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load fleet locations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const clock = window.setInterval(() => setCurrentTime(Date.now()), 1_000)
    return () => window.clearInterval(clock)
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const rows = useMemo(() => locations.map((location) => {
    const device = devices.find((candidate) => candidate.id === location.device_id)
    const assignment = assignments.find((candidate) => candidate.device_id === location.device_id && candidate.status === 'assigned')
    return { location, device, assignment }
  }).filter((row) => row.device), [assignments, devices, locations])

  const onlineCount = rows.filter(({ device }) => device && isDeviceOnline(device, currentTime)).length
  const lowBatteryCount = rows.filter(({ device }) => device?.battery_level != null && device.battery_level <= 20).length
  const assignedCount = rows.filter(({ assignment }) => Boolean(assignment?.assigned_location)).length

  return <>
    <TopBar isLoading={loading} onRefresh={() => void load()} />
    <section className="page-heading">
      <div><p className="eyebrow">FIELD TELEMETRY</p><h1>Fleet Map</h1><p>Latest reported scanner positions. Locations are timestamped and may not be live.</p></div>
    </section>
    {error && <div className="dashboard-alert" role="alert"><strong>Map data unavailable</strong><span>{error}</span></div>}
    <section className="fleet-map-kpis" aria-label="Fleet map summary"><div><span>Reporting</span><strong>{rows.length}</strong></div><div><span>Online</span><strong>{onlineCount}</strong></div><div><span>Assigned</span><strong>{assignedCount}</strong></div><div><span>Low battery</span><strong>{lowBatteryCount}</strong></div></section>
    <section className="fleet-map-panel">
      {rows.length > 0 && <div className="fleet-map-live" aria-label="Latest scanner locations">
        <MapContainer center={[rows[0].location.latitude, rows[0].location.longitude]} zoom={17} scrollWheelZoom={false}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {rows.map(({ device, location, assignment }) => device ? <Marker key={device.id} position={[location.latitude, location.longitude]} icon={scannerIcon(device.asset_id || device.hive_id, isDeviceOnline(device, currentTime))}><Popup><div className="fleet-map-popup"><div className="fleet-map-popup-title"><span className={isDeviceOnline(device, currentTime) ? 'fleet-map-popup-dot is-online' : 'fleet-map-popup-dot is-offline'} /><strong>{device.asset_id || device.hive_id}</strong></div>{assignment?.assigned_location && <div className="fleet-map-popup-area"><MapPin size={13}/>{assignment.assigned_location}</div>}<div className="fleet-map-popup-meta"><span>{isDeviceOnline(device, currentTime) ? 'Online' : 'Offline'}</span><span>{device.battery_level == null ? 'Battery unknown' : `${device.battery_level}% battery`}</span><span>Updated {ageLabel(location.recorded_at)}</span></div></div></Popup></Marker> : null)}
        </MapContainer>
      </div>}
      <div className="fleet-map-summary"><MapPin size={18}/><strong>{rows.length}</strong><span>scanners reporting location</span><button className="secondary-button" onClick={() => void load()} type="button"><RefreshCw size={15}/>Refresh</button></div>
      <div className="fleet-map-grid">
        {rows.map(({ device, location, assignment }) => {
          if (!device) return null
          const online = isDeviceOnline(device, currentTime)
          const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
          return <article className="fleet-map-card" key={device.id}>
            <div className="fleet-map-card-head"><div><p className="eyebrow">SCANNER</p><h2>{device.asset_id || device.hive_id}</h2></div><span className={online ? 'fleet-map-online' : 'fleet-map-offline'}>{online ? <Wifi size={15}/> : <WifiOff size={15}/>} {online ? 'Online' : 'Offline'}</span></div>
            {assignment?.assigned_location && <div className="fleet-map-assignment"><MapPin size={15}/><div><span>Assigned area</span><strong>{assignment.assigned_location}</strong></div></div>}
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
