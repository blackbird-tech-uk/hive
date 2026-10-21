import { useEffect, useState } from 'react'
import { CircleMarker, Marker, Polygon, Popup, useMapEvents } from 'react-leaflet'
import { divIcon, type LatLngTuple } from 'leaflet'

export type MapFeature = {
  id: string
  eventId: string
  name: string
  kind: 'pin' | 'zone'
  points: LatLngTuple[]
}

const STORAGE_KEY = 'hive-fleet-map-features-v1'

function readFeatures(): MapFeature[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(data)) return []
    return data.filter((item): item is MapFeature =>
      item && typeof item.id === 'string' && typeof item.name === 'string' &&
      (item.kind === 'pin' || item.kind === 'zone') && Array.isArray(item.points))
  } catch { return [] }
}

function MapClickCapture({ onPoint }: { onPoint: (point: LatLngTuple) => void }) {
  useMapEvents({ click: (event) => onPoint([event.latlng.lat, event.latlng.lng]) })
  return null
}

const pinIcon = divIcon({
  className: 'hive-area-pin',
  html: '<span aria-hidden="true">●</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

export function FleetMapFeatures({
  eventId, onAssign, assignedArea, deviceName,
}: {
  eventId: string | null
  onAssign: (name: string) => Promise<void>
  assignedArea?: string | null
  deviceName?: string
}) {
  const [features, setFeatures] = useState<MapFeature[]>(readFeatures)
  const [mode, setMode] = useState<'idle' | 'pin' | 'zone'>('idle')
  const [points, setPoints] = useState<LatLngTuple[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(features)) }, [features])
  const visible = features.filter((feature) => feature.eventId === eventId)
  const capture = (point: LatLngTuple) => {
    if (mode === 'pin') setPoints([point])
    if (mode === 'zone') setPoints((old) => [...old, point])
  }
  const save = () => {
    if (!eventId || !name.trim() || (mode === 'zone' ? points.length < 3 : points.length !== 1)) return
    setFeatures((old) => [...old, { id: crypto.randomUUID(), eventId, name: name.trim(), kind: mode, points }])
    setMode('idle'); setPoints([]); setName('')
  }
  const cancel = () => { setMode('idle'); setPoints([]); setName('') }

  return <>
    <div className="fleet-area-editor">
      <strong>Map locations & zones</strong>
      {!eventId && <span>Select an active or planned event to edit its map areas.</span>}
      <div className="fleet-area-toolbar">
        <button type="button" className="secondary-button" disabled={!eventId} onClick={() => { setMode('pin'); setPoints([]) }}>Add pin</button>
        <button type="button" className="secondary-button" disabled={!eventId} onClick={() => { setMode('zone'); setPoints([]) }}>Draw zone</button>
        {mode !== 'idle' && <button type="button" className="secondary-button" onClick={cancel}>Cancel</button>}
      </div>
      {mode !== 'idle' && <div className="fleet-area-controls">
        <label htmlFor="fleet-area-name">Area name</label>
        <input id="fleet-area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Registration Desk A" maxLength={100} />
        <span>{mode === 'pin' ? 'Click the map to place the pin.' : 'Click at least three map points to outline the zone.'} {points.length} point(s) selected.</span>
        <button type="button" className="secondary-button" onClick={save} disabled={!name.trim() || points.length < (mode === 'zone' ? 3 : 1)}>Save {mode}</button>
      </div>}
      {visible.length > 0 && <div className="fleet-area-list">{visible.map((feature) =>
        <div key={feature.id}><span>{feature.kind === 'pin' ? '📍' : '▱'} {feature.name}</span><button type="button" aria-label={`Delete ${feature.name}`} onClick={() => setFeatures((old) => old.filter((item) => item.id !== feature.id))}>Remove</button></div>
      )}</div>}
      {deviceName && !assignedArea && visible.length > 0 && <div className="fleet-area-controls">
        <label htmlFor="fleet-area-assignment">Assign {deviceName} to a map area</label>
        <select id="fleet-area-assignment" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose area</option>{visible.map((feature) => <option key={feature.id} value={feature.name}>{feature.name}</option>)}</select>
        <button type="button" className="secondary-button" disabled={!selected || saving} onClick={async () => { setSaving(true); try { await onAssign(selected); setSelected('') } finally { setSaving(false) } }}>{saving ? 'Assigning…' : 'Assign scanner'}</button>
      </div>}
      <small>Preview storage: map pins and zones are saved in this browser only, not yet shared across users or devices.</small>
    </div>
    {mode !== 'idle' && <MapClickCapture onPoint={capture} />}
    {visible.map((feature) => feature.kind === 'pin'
      ? <Marker key={feature.id} position={feature.points[0]} icon={pinIcon}><Popup><strong>{feature.name}</strong><br/>Named location</Popup></Marker>
      : <Polygon key={feature.id} positions={feature.points} pathOptions={{ color: '#e6b43c', fillOpacity: 0.17 }}><Popup><strong>{feature.name}</strong><br/>Area zone</Popup></Polygon>
    )}
    {mode === 'zone' && points.map((point, index) => <CircleMarker key={index} center={point} radius={5} pathOptions={{ color: '#e6b43c' }} />)}
    {mode === 'pin' && points.length === 1 && <Marker position={points[0]} icon={pinIcon} />}
    {mode === 'zone' && points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#e6b43c', dashArray: '5,5' }} />}
  </>
}
