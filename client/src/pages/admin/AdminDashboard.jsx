import { useEffect, useState } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import { cartesianOptions } from "../../lib/charts";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import PageHeader from "../../components/PageHeader";

ChartJS.register(ArcElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend);

const severityColor = { high: "rose", medium: "amber", low: "slate" };

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/admin/analytics");
        setDashboard(data);
      } catch {
        // Keep the last good data on screen; the next live update retries.
      }
    };

    load();
    socket.on("system:update", load);
    socket.on("alert:new", load);

    return () => {
      socket.off("system:update", load);
      socket.off("alert:new", load);
    };
  }, []);

  if (!dashboard) {
    return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  }

  const tankPercentage = Number(dashboard.system.tank_percentage || 0);
  const openAlerts = dashboard.alerts.filter((alert) => !alert.resolved);

  const usageChart = {
    labels: dashboard.dailyUsage.map((row) => row.day),
    datasets: [
      {
        label: "Liters",
        data: dashboard.dailyUsage.map((row) => row.liters),
        borderColor: "#1c668c",
        backgroundColor: "rgba(28,102,140,0.12)",
        fill: true
      }
    ]
  };

  const predictionChart = {
    labels: dashboard.predictions.map((row) => row.slot),
    datasets: [
      {
        label: "Average liters",
        data: dashboard.predictions.map((row) => row.liters),
        borderColor: "#1c668c",
        backgroundColor: "rgba(28,102,140,0.12)"
      }
    ]
  };

  const tankData = {
    labels: ["Filled", "Empty"],
    datasets: [
      {
        data: [tankPercentage, 100 - tankPercentage],
        backgroundColor: ["#1c668c", "#e2e8f0"],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Dashboard" description="Current state of the tank, pump, devices, and household supply." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Tank level" value={`${tankPercentage}%`} hint={`${dashboard.system.water_level} cm of water`} />
        <StatCard label="Pump" value={dashboard.system.pump_status ? "Running" : "Idle"} hint={`Mode: ${dashboard.system.pump_mode || "auto"}`} />
        <StatCard
          label="Water quality"
          value={dashboard.waterQuality ? (dashboard.waterQuality.is_safe ? "Safe" : "Unsafe") : "No data"}
          hint={dashboard.waterQuality ? `TDS ${dashboard.waterQuality.tds_value} · pH ${dashboard.waterQuality.ph_value}` : "Waiting for a reading"}
          accent={dashboard.waterQuality?.is_safe === false ? "text-red-600" : undefined}
        />
        <StatCard label="Open leak alerts" value={dashboard.alertCount} hint={dashboard.alertCount ? "Needs inspection" : "Nothing to review"} accent={dashboard.alertCount ? "text-red-600" : undefined} />
        <StatCard label="Households" value={dashboard.householdCount} hint="Registered connections" />
        <StatCard label="Devices online" value={`${dashboard.onlineDeviceCount} of ${dashboard.deviceStatuses.length}`} hint="Based on recent heartbeats" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Daily usage (liters)</p>
          <div className="mt-4 h-56 sm:h-72">
            <Line data={usageChart} options={cartesianOptions} />
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Tank level</p>
          <div className="relative mx-auto mt-4 h-44 w-44 sm:h-56 sm:w-56">
            <Doughnut data={tankData} options={{ cutout: "78%", plugins: { tooltip: { enabled: false } } }} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums text-slate-900">{tankPercentage}%</span>
              <span className="text-xs text-slate-500">full</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Usage by hour (average liters)</p>
          <div className="mt-4 h-56 sm:h-72">
            <Line data={predictionChart} options={cartesianOptions} />
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Devices</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {dashboard.deviceStatuses.map((device) => (
              <li key={device.device_key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{device.device_label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {device.last_seen_at ? `Last seen ${new Date(device.last_seen_at).toLocaleString()}` : "No heartbeat yet"}
                  </p>
                </div>
                <StatusPill color={device.is_online ? "green" : "slate"} dot>{device.is_online ? "Online" : "Offline"}</StatusPill>
              </li>
            ))}
            {!dashboard.deviceStatuses.length ? <li className="py-3 text-sm text-slate-500">No devices have reported yet.</li> : null}
          </ul>
        </div>

        <div className="panel p-4 sm:p-5 xl:col-span-2">
          <p className="panel-title">Open leak alerts</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {openAlerts.slice(0, 5).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{alert.affected_house}</p>
                  <p className="text-xs text-slate-500">{new Date(alert.detected_at).toLocaleString()}</p>
                </div>
                <StatusPill color={severityColor[alert.severity] || "slate"}>{alert.severity}</StatusPill>
              </li>
            ))}
            {!openAlerts.length ? <li className="py-3 text-sm text-slate-500">No open leak alerts.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
