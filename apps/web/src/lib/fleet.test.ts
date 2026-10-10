import { describe, expect, test } from 'vitest'

import type { Device } from './api'
import { isDeviceOnline, isLowBattery, matchesDeviceSearch, matchesFleetFilter, needsAttention } from './fleet'

const now = new Date('2026-09-29T20:00:00Z').getTime()

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1',
    hive_id: 'LB164',
    asset_id: 'EA660-164',
    serial_number: 'SERIAL164',
    imei: null,
    manufacturer: 'Unitech',
    model: 'EA660',
    android_version: '13',
    build_version: 'build-1',
    agent_version: '0.1.0',
    wifi_ssid: 'tmsonsite_5ghz',
    ip_address: '10.16.16.164',
    battery_level: 75,
    is_charging: false,
    status: 'available',
    condition: 'good',
    notes: null,
    last_seen_at: '2026-09-29T19:55:00Z',
    supports_device_lock: true,
    ...overrides,
  } as Device
}

describe('fleet health', () => {
  test('treats a recent heartbeat as online', () => {
    expect(isDeviceOnline(device(), now)).toBe(true)
  })

  test('treats an overdue heartbeat as offline', () => {
    expect(isDeviceOnline(device({ last_seen_at: '2026-09-29T19:30:00Z' }), now)).toBe(false)
  })

  test('only flags low battery when not charging', () => {
    expect(isLowBattery(device({ battery_level: 20, is_charging: false }))).toBe(true)
    expect(isLowBattery(device({ battery_level: 20, is_charging: true }))).toBe(false)
  })

  test('attention includes offline, low battery, and non-good condition', () => {
    expect(needsAttention(device({ last_seen_at: null }), now)).toBe(true)
    expect(needsAttention(device({ battery_level: 10 }), now)).toBe(true)
    expect(needsAttention(device({ condition: 'repair' }), now)).toBe(true)
    expect(needsAttention(device(), now)).toBe(false)
  })

  test('fleet filters use the same health rules', () => {
    expect(matchesFleetFilter(device(), 'online', now)).toBe(true)
    expect(matchesFleetFilter(device(), 'offline', now)).toBe(false)
    expect(matchesFleetFilter(device({ battery_level: 15 }), 'low_battery', now)).toBe(true)
    expect(matchesFleetFilter(device({ condition: 'repair' }), 'attention', now)).toBe(true)
  })
})

describe('fleet search', () => {
  test('searches scanner identity, network, and connection state', () => {
    const scanner = device()
    expect(matchesDeviceSearch(scanner, 'LB164', now)).toBe(true)
    expect(matchesDeviceSearch(scanner, 'ea660', now)).toBe(true)
    expect(matchesDeviceSearch(scanner, 'tmsonsite', now)).toBe(true)
    expect(matchesDeviceSearch(scanner, 'online', now)).toBe(true)
    expect(matchesDeviceSearch(scanner, 'not-a-scanner', now)).toBe(false)
  })
})
