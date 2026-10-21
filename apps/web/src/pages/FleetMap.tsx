import { Battery, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { FleetMapFeatures } from '../components/FleetMapFeatures'
import type { MapArea } from '../lib/api/mapAreas'
import { createAssignment, getAssignments, getDevices, getEvents } from '../lib/api'
import { getLatestDeviceLocations } from '../lib/api/locations'
import type { Assignment, Device, DeviceLocation, Event } from '../lib/api/types'
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
  const [events, setEvents] = useState<Event[]>([])
  const [assigningDeviceId, setAssigningDeviceId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextDevices, nextLocations, nextAssignments, nextEvents] = await Promise.all([
        getDevices(),
        getLatestDeviceLocations(),
        getAssignments(),
        getEvents(),
      ])
      setDevices(nextDevices)
      setLocations(nextLocations)
      setAssignments(nextAssignments)
      setEvents(nextEvents)
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

  const assignArea = useCallback(async (device: Device, mapArea?: MapArea) => {
    const activeEvents = events.filter((event) => event.status === 'active' || event.status === 'planned')
    if (activeEvents.length === 0) {
      setError('Create or activate an event before assigning a scanner area.')
      return
    }
    const event = (selectedEventId && activeEvents.find((candidate) => candidate.id === selectedEventId)) || (activeEvents.length === 1 ? activeEvents[0] : activeEvents.find((candidate) => window.confirm(`Assign ${device.asset_id || device.hive_id} to ${candidate.name}?`)))
    if (!event) return
    const area = mapArea?.name || window.prompt(`Assigned area for ${device.asset_id || device.hive_id} at ${event.name}`, 'Entrance 1')?.trim()
    if (!area) return
    setAssigningDeviceId(device.id)
    try {
      if (mapArea && mapArea.event_id !== event.id) throw new Error('Area belongs to a different event.')
      const created = await createAssignment({ device_id: device.id, event_id: event.id, map_area_id: mapArea?.id, assigned_location: area })
      setAssignments((current) => [created, ...current.filter((item) => item.device_id !== device.id || item.status !== 'assigned')])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to assign scanner area.')
      throw e
    } finally {
      setAssigningDeviceId(null)
    }
  }, [events, selectedEventId])

  const activeEvents = events.filter((event) => event.status === 'active' || event.status === 'planned')
  const activeEventId = selectedEventId || activeEvents[0]?.id || null
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId)
  const selectedAssignment = assignments.find((item) => item.device_id === selectedDeviceId && item.status === 'assigned')

  return <>
    <TopBar isLoading={loading} onRefresh={() => void load()} />
    <section className="page-heading">
      <div><p className="eyebrow">FIELD TELEMETRY</p><h1>Fleet Map</h1><p>Latest reported scanner positions. Locations are timestamped and may not be live.</p></div>
    </section>
    {error && <div className="dashboard-alert" role="alert"><strong>Map data unavailable</strong><span>{error}</span></div>}
    <section className="fleet-map-panel">
      <div className="fleet-area-event-select"><label htmlFor="fleet-map-event">Event for map areas</label><select id="fleet-map-event" value={activeEventId || ''} onChange={(event) => setSelectedEventId(event.target.value)}><option value="">Select event</option>{activeEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><label htmlFor="fleet-map-device">Scanner to assign</label><select id="fleet-map-device" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}><option value="">Select scanner</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.asset_id || device.hive_id}</option>)}</select></div>
      {rows.length > 0 && <div className="fleet-map-live" aria-label="Latest scanner locations">
        <MapContainer center={[rows[0].location.latitude, rows[0].location.longitude]} zoom={17} scrollWheelZoom={false}>
          <FleetMapFeatures eventId={activeEventId} deviceName={selectedDevice?.asset_id || selectedDevice?.hive_id} assignedArea={selectedAssignment?.assigned_location} onAssign={async (area) => { if (selectedDevice) await assignArea(selectedDevice, area) }} />
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {rows.map(({ device, location, assignment }) => device ? <Marker key={device.id} position={[location.latitude, location.longitude]} icon={scannerIcon(device.asset_id || device.hive_id, isDeviceOnline(device, currentTime))}><Popup><strong>{device.asset_id || device.hive_id}</strong>{assignment?.assigned_location && <><br/><span className="fleet-map-area">{assignment.assigned_location}</span></>}<br/>{isDeviceOnline(device, currentTime) ? 'Online' : 'Offline'} · {device.battery_level == null ? 'Battery unknown' : `${device.battery_level}% battery`}<br/>Updated {ageLabel(location.recorded_at)}</Popup></Marker> : null)}
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
            <div className="fleet-map-actions"><button className="secondary-button" disabled={assigningDeviceId === device.id || Boolean(assignment)} onClick={() => void assignArea(device)} type="button">{assignment ? 'Area assigned' : assigningDeviceId === device.id ? 'Assigning…' : 'Assign area'}</button><a className="primary-button fleet-map-open" href={mapsUrl} rel="noreferrer" target="_blank">Open last known location</a></div>
          </article>
        })}
        {!loading && rows.length === 0 && <div className="device-search-empty"><MapPin size={28}/><h2>No scanner locations yet</h2><p>Locations will appear after an enrolled Hive Agent reports its first fix.</p></div>}
      </div>
    </section>
  </>
}
