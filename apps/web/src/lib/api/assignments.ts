import { api } from './client'
import type { Assignment, CreateAssignmentPayload } from './types'

export async function getAssignments(): Promise<Assignment[]> {
  return api.get<Assignment[]>('/assignments')
}

export async function createAssignment(payload: CreateAssignmentPayload): Promise<Assignment> {
  return api.post<Assignment>('/assignments', payload)
}

export async function moveAssignmentArea(assignmentId: string, mapAreaId: string): Promise<Assignment> {
  return api.patch<Assignment>(`/assignments/${assignmentId}/area`, { map_area_id: mapAreaId })
}
