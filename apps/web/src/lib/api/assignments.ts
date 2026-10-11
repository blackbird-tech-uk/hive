import { api } from './client'
import type { Assignment } from './types'

export async function getAssignments(): Promise<Assignment[]> {
  return api.get<Assignment[]>('/assignments')
}
