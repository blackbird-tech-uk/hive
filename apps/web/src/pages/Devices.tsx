import { useEffect, useMemo, useState } from "react";

import { DeviceTable } from "../components/devices/DeviceTable";
import { DeviceDetails } from '../components/devices/DeviceDetails';
import { StatCard } from "../components/dashboard/StatCard";
import { TopBar } from "../components/layout/TopBar";
import { getDevices, type Device } from "../lib/api";

export function DevicesPage() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDevices() {
    setLoading(true);

    try {
      const response = await getDevices();
      setDevices(response);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
  }, []);

  const available = useMemo(
    () => devices.filter((d) => d.status === "available").length,
    [devices]
  );

  const repair = useMemo(
    () => devices.filter((d) => d.status === "repair").length,
    [devices]
  );

  const assigned = useMemo(
    () =>
      devices.filter(
        (d) => d.status === "assigned" || d.status === "in_use"
      ).length,
    [devices]
  );

  return (
    <>
      <TopBar
        isLoading={loading}
        onRefresh={() => void loadDevices()}
      />

      <section className="metric-grid">
        <StatCard
          label="Devices"
          value={devices.length}
          description="Registered devices"
        />

        <StatCard
          label="Available"
          value={available}
          description="Ready for events"
        />

        <StatCard
          label="Assigned"
          value={assigned}
          description="Currently allocated"
        />

        <StatCard
          label="Repair"
          value={repair}
          description="Needs attention"
        />
      </section>

      <DeviceTable
        devices={devices}
        onSelectDevice={setSelectedDevice}
      />

      {selectedDevice && (
        <DeviceDetails
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}
        </>
  )
}