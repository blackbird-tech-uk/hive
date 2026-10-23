import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, del, org } = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), del: vi.fn(), org: vi.fn(() => 'org-1'),
}))
vi.mock('./client', () => ({ api: { get, post, delete: del } }))
vi.mock('./session', () => ({ getOrganizationId: org }))
import { createMapArea, deleteMapArea, getMapAreas } from './mapAreas'

describe('allocated area API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists areas scoped to the selected organisation and event', async () => {
    get.mockResolvedValue([])
    await getMapAreas('event-1')
    expect(get).toHaveBeenCalledWith('/organizations/org-1/events/event-1/map-areas')
  })

  it('saves a named polygon in the correct event', async () => {
    const payload = { name: 'Desk A', points: [[52, -1], [52.1, -1], [52, -1.1]] as [number, number][] }
    post.mockResolvedValue({ id: 'area-1', ...payload })
    await createMapArea('event-1', payload)
    expect(post).toHaveBeenCalledWith('/organizations/org-1/events/event-1/map-areas', payload)
  })

  it('deletes only the selected event area', async () => {
    del.mockResolvedValue(undefined)
    await deleteMapArea('event-1', 'area-1')
    expect(del).toHaveBeenCalledWith('/organizations/org-1/events/event-1/map-areas/area-1')
  })
})
