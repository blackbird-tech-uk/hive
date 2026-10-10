import { api } from './client'

import type {
  Event,
  CreateEventPayload,
} from './types'

export async function getEvents(): Promise<
  Event[]
> {
  return api.get<Event[]>(
    '/events',
  )
}

export async function createEvent(
  payload: CreateEventPayload,
): Promise<Event> {
  return api.post<Event>(
    '/events',
    payload,
  )
}