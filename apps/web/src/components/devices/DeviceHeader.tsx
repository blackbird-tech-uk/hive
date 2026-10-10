type DeviceHeaderProps = {
  realtimeStatus: 'connected' | 'connecting' | 'disconnected'
  onEnroll: () => void
}

export function DeviceHeader({
  realtimeStatus,
  onEnroll,
}: DeviceHeaderProps) {
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow">
          DEVICE OPERATIONS
        </p>

        <h1>Devices</h1>

        <p>
          Monitor live health and connectivity
          for every device registered with
          Hive.
        </p>
      </div>

      <div
        className={`realtime-status realtime-status--${realtimeStatus}`}
        title={`Realtime connection: ${realtimeStatus}`}
      >
        <span
          aria-hidden="true"
          className="realtime-status-dot"
        />

        <span>
          {realtimeStatus === 'connected' && 'Live'}
          {realtimeStatus === 'connecting' &&
            'Connecting'}
          {realtimeStatus === 'disconnected' &&
            'Offline'}
        </span>
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={onEnroll}
      >
        + Enrol Device
      </button>
    </section>
  )
}