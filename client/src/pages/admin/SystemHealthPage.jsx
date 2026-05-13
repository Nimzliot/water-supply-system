import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import api from "../../lib/api";

export default function SystemHealthPage() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    api.get("/admin/device-status").then(({ data }) => setDevices(data.devices || []));
  }, []);

  const onlineCount = devices.filter((device) => device.is_online).length;
  const avgWifi = devices.length
    ? Math.round(devices.reduce((total, device) => total + Number(device.wifi_rssi || 0), 0) / devices.length)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Health"
        title="IoT device and sensor health monitoring"
        description="Inspect sensor health, ESP32 device status, Wi-Fi strength, and uptime metrics."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ESP32 Nodes" value={`${onlineCount}/${devices.length || 0} Online`} hint="Based on recent heartbeat windows" />
        <StatCard label="Wi-Fi Strength" value={avgWifi !== null ? `${avgWifi} dBm` : "--"} hint="Average reported RSSI from hardware" accent="text-surge" />
        <StatCard label="Sensor Health" value={devices.length ? "Live Telemetry" : "Waiting"} hint="Derived from incoming hardware heartbeat" accent="text-sand" />
        <StatCard label="Last Device Seen" value={devices[0]?.last_seen_at ? new Date(devices[0].last_seen_at).toLocaleTimeString() : "--"} hint="Most recent hardware heartbeat received" accent="text-aqua" />
      </div>
    </div>
  );
}
