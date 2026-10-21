import { api } from './client'
import { getOrganizationId } from './session'

export interface MapArea {
  id: string
  organization_id: string
  event_id: string
  name: string
  points: [number, number][]
  created_at: string
}

export interface MapAreaPayload {
  name: string
  points: [number, number][]
}

function base(eventId: string) {
  return `/organizations/${encodeURIComponent(getOrganizationId())}/events/${encodeURIComponent(eventId)}/map-areas`
}

export function getMapAreas(eventId: string): Promise<MapArea[]> {
  return api.get<MapArea[]>(base(eventId))
}

export function createMapArea(eventId: string, payload: MapAreaPayload): Promise<MapArea> {
  return api.post<MapArea>(base(eventId), payload)
}

export function deleteMapArea(eventId: string, areaId: string): Promise<void> {
  return api.delete<void>(`${base(eventId)}/${encodeURIComponent(areaId)}`)
}
