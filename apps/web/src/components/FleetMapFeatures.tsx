import { useEffect, useRef, useState } from 'react'
import { createMapArea, deleteMapArea, getMapAreas, updateMapArea, type MapArea } from '../lib/api/mapAreas'
import { CircleMarker, Polygon, Popup, useMapEvents } from 'react-leaflet'
import { DomEvent, type LatLngTuple } from 'leaflet'

function MapClickCapture({ onPoint }: { onPoint: (point: LatLngTuple) => void }) {
  useMapEvents({ click: (event) => onPoint([event.latlng.lat, event.latlng.lng]) })
  return null
}

export function FleetMapFeatures({
  eventId, onAssign, assignedAreaId, assignedEventId, deviceName,
}: {
  eventId: string | null
  onAssign: (area: MapArea) => Promise<void>
  assignedAreaId?: string | null
  assignedEventId?: string | null
  deviceName?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [features, setFeatures] = useState<MapArea[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [mode, setMode] = useState<'idle' | 'zone'>('idle')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [points, setPoints] = useState<LatLngTuple[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setFeatures([])
    setSelected('')
    setPoints([])
    setMode('idle')
    setEditingId(null)
    setError('')
    setFetching(Boolean(eventId))
    if (!eventId) return
    getMapAreas(eventId).then((areas) => { if (active) { setFeatures(areas); setError('') } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load areas') }).finally(() => { if (active) setFetching(false) })
    return () => { active = false }
  }, [eventId])
  const visible = features.filter((feature) => feature.event_id === eventId)
  const capture = (point: LatLngTuple) => {
    if (mode === 'zone' && !loading) setPoints((old) => old.length < 100 ? [...old, point] : old)
  }
  const save = async () => {
    if (!eventId || !name.trim() || points.length < 3 || points.length > 100 || loading) return
    setLoading(true)
    try {
      const payload = { name: name.trim(), points: points.map(([lat, lng]): [number, number] => [lat, lng]) }
      const area = editingId ? await updateMapArea(eventId, editingId, payload) : await createMapArea(eventId, payload)
      setFeatures((old) => editingId ? old.map((item) => item.id === editingId ? area : item) : [...old, area]); setMode('idle'); setEditingId(null); setPoints([]); setName(''); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save area') }
    finally { setLoading(false) }
  }
  const cancel = () => { setMode('idle'); setEditingId(null); setPoints([]); setName('') }
  const edit = (area: MapArea) => { setEditingId(area.id); setName(area.name); setPoints(area.points.map(([lat, lng]) => [lat, lng])); setMode('zone'); setError('') }

  useEffect(() => {
    const element = editorRef.current
    if (!element) return
    DomEvent.disableClickPropagation(element)
    DomEvent.disableScrollPropagation(element)
  }, [])

  return <>
    <div ref={editorRef} className="fleet-area-editor">
      <strong>Allocated areas</strong>
      {error && <span role="alert">{error}</span>}
      {fetching && <span role="status">Loading saved areas…</span>}
      {!eventId && <span>Select an active or planned event to edit its map areas.</span>}
      <div className="fleet-area-toolbar">
        <button type="button" className="secondary-button" disabled={!eventId || fetching} onClick={() => { setEditingId(null); setName(''); setMode('zone'); setPoints([]) }}>Draw allocated area</button>
        {mode !== 'idle' && <button type="button" className="secondary-button" onClick={cancel}>Cancel</button>}
      </div>
      {mode !== 'idle' && <div className="fleet-area-controls">
        <label htmlFor="fleet-area-name">Area name</label>
        <input id="fleet-area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Registration Desk A" maxLength={100} />
        <span>{editingId ? 'Existing points are loaded. Use Undo point or Clear points to redraw the boundary.' : 'Click at least three map points to outline the allocated area.'} {points.length} of 100 points selected. On mobile, tap the map to add boundary points.</span>
        <button type="button" className="secondary-button" disabled={points.length === 0 || loading} onClick={() => setPoints((old) => old.slice(0, -1))}>Undo point</button>
        <button type="button" className="secondary-button" disabled={points.length === 0 || loading} onClick={() => setPoints([])}>Clear points</button>
        <button type="button" className="secondary-button" onClick={save} disabled={loading || !name.trim() || points.length < 3 || points.length > 100}>{editingId ? "Save changes" : "Save area"}</button>
      </div>}
      {!fetching && eventId && visible.length === 0 && !error && <small>No saved areas for this event yet.</small>}
      {visible.length > 0 && <div className="fleet-area-list">{visible.map((feature) =>
        <div key={feature.id}><span>▱ {feature.name}</span><button type="button" className="secondary-button" disabled={loading || saving || fetching || Boolean(deletingId)} onClick={() => edit(feature)}>Edit</button><button type="button" aria-label={`Delete ${feature.name}`} disabled={loading || saving || fetching || Boolean(deletingId)} onClick={async () => { if (!eventId || !window.confirm(`Remove ${feature.name}? This cannot be undone.`)) return; setDeletingId(feature.id); try { await deleteMapArea(eventId, feature.id); setFeatures((old) => old.filter((item) => item.id !== feature.id)); if (selected === feature.id) setSelected(''); if (editingId === feature.id) cancel(); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete area') } finally { setDeletingId(null) } }}>{deletingId === feature.id ? 'Removing…' : 'Remove'}</button></div>
      )}</div>}
      {deviceName && visible.length > 0 && (!assignedEventId || assignedEventId === eventId) && <div className="fleet-area-controls">
        <label htmlFor="fleet-area-assignment">{assignedEventId ? `Move ${deviceName} to another area` : `Assign ${deviceName} to a map area`}</label>
        <select id="fleet-area-assignment" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose area</option>{visible.filter((feature) => feature.id !== assignedAreaId).map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select>
        <button type="button" className="secondary-button" disabled={!selected || saving} onClick={async () => { setSaving(true); try { const area = visible.find((feature) => feature.id === selected); if (area) { await onAssign(area); setSelected(''); setError('') } } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not assign scanner') } finally { setSaving(false) } }}>{saving ? 'Saving…' : assignedEventId ? 'Move scanner' : 'Assign scanner'}</button>
      </div>}
      {deviceName && assignedEventId && assignedEventId !== eventId && <small>This scanner is assigned to another event. Return it before assigning it here.</small>}
      <small>Area boundaries are saved to HIVE and shared with authorised users of this organisation.</small>
    </div>
    {mode !== 'idle' && <MapClickCapture onPoint={capture} />}
    {visible.filter((feature) => feature.id !== editingId).map((feature) => <Polygon key={feature.id} interactive={mode === 'idle'} positions={feature.points} pathOptions={{ color: '#e6b43c', fillOpacity: 0.17 }}><Popup><strong>{feature.name}</strong><br/>Allocated area</Popup></Polygon>)}
    {mode === 'zone' && points.map((point, index) => <CircleMarker key={index} interactive={false} center={point} radius={5} pathOptions={{ color: '#e6b43c' }} />)}
    {mode === 'zone' && points.length >= 3 && <Polygon interactive={false} positions={points} pathOptions={{ color: '#e6b43c', dashArray: '5,5' }} />}
  </>
}
