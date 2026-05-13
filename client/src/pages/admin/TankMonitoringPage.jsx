import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import FeatureListCard from "../../components/FeatureListCard";

export default function TankMonitoringPage() {
  const [system, setSystem] = useState(null);

  useEffect(() => {
    api.get("/admin/system").then(({ data }) => setSystem(data.system));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tank Monitoring"
        title="Overhead tank visibility and overflow protection"
        description="Dedicated monitoring page for tank percentage, water level, overflow warning thresholds, and automation behavior."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Tank Percentage" value={`${system?.tank_percentage ?? 0}%`} hint="Live fill percentage" />
        <StatCard label="Water Level" value={`${system?.water_level ?? 0} cm`} hint="Ultrasonic sensor reading" accent="text-surge" />
        <StatCard label="Pump Automation" value={system?.pump_status ? "Pump ON" : "Pump OFF"} hint="Auto logic follows 70% / 95% thresholds" accent="text-sand" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <FeatureListCard
          title="Tank Page Includes"
          items={[
            "Tank percentage trend graph",
            "Overflow warnings and thresholds",
            "Pump automation logs",
            "Maintenance event notes"
          ]}
        />
        <FeatureListCard
          title="Operational Logic"
          items={[
            "Pump turns OFF at 95% tank fill",
            "Pump turns ON at 70% tank fill",
            "Realtime telemetry from ESP32",
            "Alert stream for abnormal sensor values"
          ]}
          tone="info"
        />
      </div>
    </div>
  );
}

