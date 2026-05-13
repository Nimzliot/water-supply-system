import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import api from "../../lib/api";

export default function LiveUsagePage() {
  const [device, setDevice] = useState(null);
  const [usage, setUsage] = useState([]);

  useEffect(() => {
    api.get("/user/device-status").then(({ data }) => setDevice(data.device));
    api.get("/user/usage").then(({ data }) => setUsage(data.usage || []));
  }, []);

  const latestUsage = usage[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live Usage"
        title="Real-time household flow monitoring"
        description="Track current flow rate, valve status, and live consumption from your service connection."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Current Flow Reading"
          value={latestUsage ? `${latestUsage.liters_used} L` : "--"}
          hint={latestUsage ? "Latest uploaded household reading" : "Waiting for live hardware reading"}
        />
        <StatCard
          label="Valve / Device Link"
          value={device?.is_online ? "Connected" : "Waiting"}
          hint={device?.is_online ? "Heartbeat active from field hardware" : "No recent heartbeat"}
          accent="text-surge"
        />
        <StatCard
          label="Live Consumption"
          value={latestUsage ? `${latestUsage.lpcd_used} LPCD` : "--"}
          hint={latestUsage ? "Most recent LPCD upload" : "No recent consumption upload"}
          accent="text-sand"
        />
        <StatCard
          label="Device Status"
          value={device?.is_online ? "Online" : "Offline"}
          hint={device?.last_seen_at ? `Heartbeat at ${new Date(device.last_seen_at).toLocaleTimeString()}` : "No heartbeat received"}
          accent={device?.is_online ? "text-aqua" : "text-alert"}
        />
      </div>
    </div>
  );
}
