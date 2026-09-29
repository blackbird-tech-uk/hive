import { LockKeyhole, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../app/AuthContext'
import { StatCard } from '../components/dashboard/StatCard'
import { DeviceDetails } from '../components/devices/DeviceDetails'
import { DeviceTable } from '../components/devices/DeviceTable'
import { TopBar } from '../components/layout/TopBar'
import { createDeviceCommand, getDevices, restoreAuthSession, type Device } from '../lib/api'
import { isDeviceOnline, isLowBattery, matchesDeviceSearch, matchesFleetFilter, needsAttention, type FleetFilter } from '../lib/fleet'
import { connectToDeviceUpdates, type RealtimeConnectionStatus } from '../lib/realtime'

type BulkScannerStatus = 'queued' | 'failed' | 'offline' | 'unsupported'
type BulkScannerResult = { deviceId: string; label: string; status: BulkScannerStatus; detail?: string }
type BulkActionResult = { action: string; queued: number; failed: number; offline: number; unsupported: number; scanners: BulkScannerResult[] }

function scannerLabel(device: Device): string { return device.hive_id || device.asset_id || device.serial_number || device.id }

export function DevicesPage() {
  const { activeOrganization } = useAuth()
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [devices, setDevices] = useState<Device[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('disconnected')
  const [currentTime, setCurrentTime] = useState(() => new Date().getTime())
  const [bulkActionRunning, setBulkActionRunning] = useState(false)
  const [bulkActionResult, setBulkActionResult] = useState<BulkActionResult | null>(null)

  const loadDevices = useCallback(async (showInitialLoader = false) => {
    if (showInitialLoader) setLoading(true); else setRefreshing(true)
    try {
      const response = await getDevices()
      setDevices(response); setError(null); setCurrentTime(new Date().getTime())
      setSelectedDeviceIds((current) => new Set([...current].filter((id) => response.some((device) => device.id === id))))
      setSelectedDevice((currentDevice) => currentDevice ? response.find((device) => device.id === currentDevice.id) ?? null : null)
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load devices.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => { void loadDevices(true) }, 0); return () => window.clearTimeout(timer) }, [loadDevices, activeOrganization?.id])
  useEffect(() => {
    if (!activeOrganization) return
    const session = restoreAuthSession(); if (!session.accessToken) return
    return connectToDeviceUpdates<Device>({ token: session.accessToken, organizationId: activeOrganization.id,
      onDeviceUpdated(updatedDevice) {
        setDevices((current) => current.some((device) => device.id === updatedDevice.id) ? current.map((device) => device.id === updatedDevice.id ? updatedDevice : device) : [updatedDevice, ...current])
        setSelectedDevice((current) => current?.id === updatedDevice.id ? updatedDevice : current); setCurrentTime(new Date().getTime()); setError(null)
      }, onStatusChange: setRealtimeStatus })
  }, [activeOrganization])
  useEffect(() => { const interval = window.setInterval(() => setCurrentTime(new Date().getTime()), 1_000); return () => window.clearInterval(interval) }, [])
  useEffect(() => { function handleVisibilityChange() { if (document.visibilityState === 'visible') void loadDevices() } document.addEventListener('visibilitychange', handleVisibilityChange); return () => document.removeEventListener('visibilitychange', handleVisibilityChange) }, [loadDevices])

  const onlineDevices = useMemo(() => devices.filter((device) => isDeviceOnline(device, currentTime)).length, [devices, currentTime])
  const offlineDevices = devices.length - onlineDevices
  const lowBatteryDevices = useMemo(() => devices.filter(isLowBattery).length, [devices])
  const attentionDevices = useMemo(() => devices.filter((device) => needsAttention(device, currentTime)).length, [devices, currentTime])
  const filteredDevices = useMemo(() => devices.filter((device) => matchesFleetFilter(device, fleetFilter, currentTime) && matchesDeviceSearch(device, searchQuery, currentTime)), [devices, searchQuery, currentTime, fleetFilter])

  const selectedDevices = useMemo(() => devices.filter((device) => selectedDeviceIds.has(device.id)), [devices, selectedDeviceIds])
  const selectedOnline = selectedDevices.filter((device) => isDeviceOnline(device, currentTime)).length
  const selectedLowBattery = selectedDevices.filter(isLowBattery).length
  const lockEligibleDevices = selectedDevices.filter((device) => isDeviceOnline(device, currentTime) && device.supports_device_lock)
  const syncEligibleDevices = selectedDevices.filter((device) => isDeviceOnline(device, currentTime))

  const toggleDevice = (deviceId: string) => { setBulkActionResult(null); setSelectedDeviceIds((current) => { const next = new Set(current); if (next.has(deviceId)) next.delete(deviceId); else next.add(deviceId); return next }) }
  const toggleAllVisible = () => { setBulkActionResult(null); setSelectedDeviceIds((current) => { const next = new Set(current); const allSelected = filteredDevices.length > 0 && filteredDevices.every((device) => next.has(device.id)); filteredDevices.forEach((device) => { if (allSelected) next.delete(device.id); else next.add(device.id) }); return next }) }

  async function runBulkCommand(action: string, command: string, eligibleDevices: Device[], unsupportedDevices: Device[] = []) {
    if (eligibleDevices.length === 0 || bulkActionRunning) return
    const offlineDevicesSelected = selectedDevices.filter((device) => !isDeviceOnline(device, currentTime))
    const confirmed = window.confirm(`${action} ${eligibleDevices.length} selected scanner${eligibleDevices.length === 1 ? '' : 's'}?${offlineDevicesSelected.length ? ` ${offlineDevicesSelected.length} offline scanner${offlineDevicesSelected.length === 1 ? '' : 's'} will be skipped.` : ''}${unsupportedDevices.length ? ` ${unsupportedDevices.length} unsupported scanner${unsupportedDevices.length === 1 ? '' : 's'} will be skipped.` : ''}`)
    if (!confirmed) return
    setBulkActionRunning(true); setBulkActionResult(null)
    const settled = await Promise.allSettled(eligibleDevices.map((device) => createDeviceCommand(device.id, { command })))
    const commandResults: BulkScannerResult[] = settled.map((result, index) => ({
      deviceId: eligibleDevices[index].id,
      label: scannerLabel(eligibleDevices[index]),
      status: result.status === 'fulfilled' ? 'queued' : 'failed',
      detail: result.status === 'rejected' ? (result.reason instanceof Error ? result.reason.message : 'Command could not be queued.') : undefined,
    }))
    const skippedOffline = offlineDevicesSelected.map((device): BulkScannerResult => ({ deviceId: device.id, label: scannerLabel(device), status: 'offline', detail: 'Heartbeat overdue.' }))
    const skippedUnsupported = unsupportedDevices.map((device): BulkScannerResult => ({ deviceId: device.id, label: scannerLabel(device), status: 'unsupported', detail: 'Scanner does not report support for this command.' }))
    const queued = commandResults.filter((result) => result.status === 'queued').length
    const failed = commandResults.filter((result) => result.status === 'failed').length
    setBulkActionResult({ action, queued, failed, offline: skippedOffline.length, unsupported: skippedUnsupported.length, scanners: [...commandResults, ...skippedOffline, ...skippedUnsupported] })
    setBulkActionRunning(false)
  }

  const lockUnsupportedDevices = selectedDevices.filter((device) => isDeviceOnline(device, currentTime) && !device.supports_device_lock)

  return <>
    <TopBar isLoading={loading || refreshing} onRefresh={() => void loadDevices()} />
    <section className="page-heading"><div><p className="eyebrow">DEVICE OPERATIONS</p><h1>Devices</h1><p>Monitor live health and connectivity for every device registered with Hive.</p></div><div className={`realtime-status realtime-status--${realtimeStatus}`} title={`Realtime connection: ${realtimeStatus}`}><span aria-hidden="true" className="realtime-status-dot" /><span>{realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? 'Connecting' : 'Offline'}</span></div></section>
    {error && <div className="dashboard-alert" role="alert"><strong>Device data unavailable</strong><span>{error}</span></div>}
    <section className="metric-grid"><StatCard label="Devices" value={devices.length} description="Registered devices" /><StatCard label="Online" value={onlineDevices} description="Seen within 20 minutes" /><StatCard label="Offline" value={offlineDevices} description="Heartbeat overdue" /><StatCard label="Low battery" value={lowBatteryDevices} description="20% or below" /></section>
    <section className="device-list-section">
      <div className="device-list-toolbar"><div className="device-search"><Search aria-hidden="true" className="device-search-icon" size={18} /><input aria-label="Search devices" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search Hive ID, asset, serial, Wi-Fi, IP or model..." type="search" value={searchQuery} />{searchQuery && <button aria-label="Clear device search" className="device-search-clear" onClick={() => setSearchQuery('')} type="button"><X aria-hidden="true" size={16} /></button>}</div><div className="device-search-result-count"><strong>{filteredDevices.length}</strong><span>{filteredDevices.length === 1 ? ' result' : ' results'}</span></div></div>
      <div className="fleet-filter-toolbar" aria-label="Fleet health filters">{([['all', `All (${devices.length})`], ['online', `Online (${onlineDevices})`], ['offline', `Offline (${offlineDevices})`], ['low_battery', `Low battery (${lowBatteryDevices})`], ['attention', `Needs attention (${attentionDevices})`]] as [FleetFilter, string][]).map(([value, label]) => <button className={fleetFilter === value ? 'secondary-button fleet-filter-active' : 'secondary-button'} key={value} onClick={() => setFleetFilter(value)} type="button">{label}</button>)}</div>
      {selectedDeviceIds.size > 0 && <div className="fleet-selection-toolbar"><div><strong>{selectedDeviceIds.size} selected</strong><span>{selectedOnline} online · {selectedDeviceIds.size - selectedOnline} offline · {selectedLowBattery} low battery · {lockEligibleDevices.length} lock ready</span></div><div className="fleet-selection-actions"><button className="secondary-button" disabled={syncEligibleDevices.length === 0 || bulkActionRunning} onClick={() => void runBulkCommand('Sync', 'SYNC', syncEligibleDevices)} type="button"><RefreshCw aria-hidden="true" size={16} />Sync selected ({syncEligibleDevices.length})</button><button className="primary-button" disabled={lockEligibleDevices.length === 0 || bulkActionRunning} onClick={() => void runBulkCommand('Lock', 'LOCK_DEVICE', lockEligibleDevices, lockUnsupportedDevices)} type="button"><LockKeyhole aria-hidden="true" size={16} />{bulkActionRunning ? 'Queuing…' : `Lock selected (${lockEligibleDevices.length})`}</button><button className="secondary-button" disabled={bulkActionRunning} onClick={() => { setSelectedDeviceIds(new Set()); setBulkActionResult(null) }} type="button">Clear selection</button></div></div>}
      {bulkActionResult && <div className="dashboard-alert fleet-command-result" role="status"><strong>Bulk {bulkActionResult.action.toLowerCase()} finished</strong><span>{bulkActionResult.queued} queued · {bulkActionResult.failed} failed · {bulkActionResult.offline} offline skipped · {bulkActionResult.unsupported} unsupported skipped</span><div className="fleet-command-result-list">{bulkActionResult.scanners.map((result) => <div className={`fleet-command-result-row fleet-command-result-row--${result.status}`} key={`${bulkActionResult.action}-${result.deviceId}`}><strong>{result.label}</strong><span>{result.status === 'queued' ? 'Queued' : result.status === 'failed' ? 'Failed' : result.status === 'offline' ? 'Skipped · Offline' : 'Skipped · Unsupported'}</span>{result.detail && <small>{result.detail}</small>}</div>)}</div></div>}
      {loading && devices.length === 0 ? <div className="device-search-empty"><h2>Loading devices…</h2><p>Hive is retrieving the latest device telemetry.</p></div> : filteredDevices.length > 0 ? <DeviceTable devices={filteredDevices} onSelectDevice={setSelectedDevice} selectedDeviceIds={selectedDeviceIds} onToggleDevice={toggleDevice} onToggleAll={toggleAllVisible} /> : <div className="device-search-empty"><Search aria-hidden="true" size={28} /><h2>No devices found</h2><p>No scanners match the current search and fleet-health filter.</p><button className="secondary-button" onClick={() => { setSearchQuery(''); setFleetFilter('all') }} type="button">Clear filters</button></div>}
    </section>
    {selectedDevice && <DeviceDetails device={selectedDevice} onClose={() => setSelectedDevice(null)} onUpdated={(updatedDevice) => { setDevices((current) => current.map((device) => device.id === updatedDevice.id ? updatedDevice : device)); setSelectedDevice(updatedDevice) }} />}
  </>
}
