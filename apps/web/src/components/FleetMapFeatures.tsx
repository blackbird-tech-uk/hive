import { useEffect, useState } from 'react'
import { createMapArea, deleteMapArea, getMapAreas, type MapArea } from '../lib/api/mapAreas'
import { CircleMarker, Polygon, Popup, useMapEvents } from 'react-leaflet'
import { type LatLngTuple } from 'leaflet'

function MapClickCapture({ onPoint }: { onPoint: (point: LatLngTuple) => void }) {
  useMapEvents({ click: (event) => onPoint([event.latlng.lat, event.latlng.lng]) })
  return null
}

export function FleetMapFeatures({
  eventId, onAssign, assignedArea, deviceName,
}: {
  eventId: string | null
  onAssign: (name: string) => Promise<void>
  assignedArea?: string | null
  deviceName?: string
}) {
  const [features, setFeatures] = useState<MapArea[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'idle' | 'zone'>('idle')
  const [points, setPoints] = useState<LatLngTuple[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    if (!eventId) return
    getMapAreas(eventId).then((areas) => { if (active) { setFeatures(areas); setError('') } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load areas') })
    return () => { active = false }
  }, [eventId])
  const visible = features.filter((feature) => feature.event_id === eventId)
  const capture = (point: LatLngTuple) => {
    if (mode === 'zone') setPoints((old) => [...old, point])
  }
  const save = async () => {
    if (!eventId || !name.trim() || points.length < 3) return
    setLoading(true)
    try {
      const area = await createMapArea(eventId, { name: name.trim(), points })
      setFeatures((old) => [...old, area]); setMode('idle'); setPoints([]); setName(''); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save area') }
    finally { setLoading(false) }
  }
  const cancel = () => { setMode('idle'); setPoints([]); setName('') }

  return <>
    <div className="fleet-area-editor">
      <strong>Allocated areas</strong>
      {error && <span role="alert">{error}</span>}
      {!eventId && <span>Select an active or planned event to edit its map areas.</span>}
      <div className="fleet-area-toolbar">
        <button type="button" className="secondary-button" disabled={!eventId} onClick={() => { setMode('zone'); setPoints([]) }}>Draw allocated area</button>
        {mode !== 'idle' && <button type="button" className="secondary-button" onClick={cancel}>Cancel</button>}
      </div>
      {mode !== 'idle' && <div className="fleet-area-controls">
        <label htmlFor="fleet-area-name">Area name</label>
        <input id="fleet-area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Registration Desk A" maxLength={100} />
        <span>Click at least three map points to outline the allocated area. {points.length} point(s) selected.</span>
        <button type="button" className="secondary-button" onClick={save} disabled={loading || !name.trim() || points.length < 3}>Save area</button>
      </div>}
      {visible.length > 0 && <div className="fleet-area-list">{visible.map((feature) =>
        <div key={feature.id}><span>▱ {feature.name}</span><button type="button" aria-label={`Delete ${feature.name}`} onClick={async () => { if (!eventId) return; try { await deleteMapArea(eventId, feature.id); setFeatures((old) => old.filter((item) => item.id !== feature.id)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete area') } }}>Remove</button></div>
      )}</div>}
      {deviceName && !assignedArea && visible.length > 0 && <div className="fleet-area-controls">
        <label htmlFor="fleet-area-assignment">Assign {deviceName} to a map area</label>
        <select id="fleet-area-assignment" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose area</option>{visible.map((feature) => <option key={feature.id} value={feature.name}>{feature.name}</option>)}</select>
        <button type="button" className="secondary-button" disabled={!selected || saving} onClick={async () => { setSaving(true); try { await onAssign(selected); setSelected('') } finally { setSaving(false) } }}>{saving ? 'Assigning…' : 'Assign scanner'}</button>
      </div>}
      <small>Area boundaries are saved to HIVE and shared with authorised users of this organisation.</small>
    </div>
    {mode !== 'idle' && <MapClickCapture onPoint={capture} />}
    {visible.map((feature) => <Polygon key={feature.id} positions={feature.points} pathOptions={{ color: '#e6b43c', fillOpacity: 0.17 }}><Popup><strong>{feature.name}</strong><br/>Allocated area</Popup></Polygon>)}
    {mode === 'zone' && points.map((point, index) => <CircleMarker key={index} center={point} radius={5} pathOptions={{ color: '#e6b43c' }} />)}
    {mode === 'zone' && points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#e6b43c', dashArray: '5,5' }} />}
  </>
}
