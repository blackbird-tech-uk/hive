import { api } from './client'

import type {
  Organization,
} from './types'

export async function getOrganizations(): Promise<
  Organization[]
> {
  return api.get<Organization[]>(
    '/organizations',
  )
}