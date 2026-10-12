import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import { cartesianOptions } from "../../lib/charts";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import HeroCard from "../../components/HeroCard";

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
    // Tank telemetry arrives as system:update every 10 seconds; this covers the gaps when it stops.
    const interval = window.setInterval(load, 30000);

    return () => {
      window.clearInterval(interval);
      socket.off("system:update", load);
      socket.off("alert:new", load);
    };
  }, []);

  if (!dashboard) {
    return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  }

  const tankPercentage = Number(dashboard.system.tank_percentage || 0);
  const openAlerts = dashboard.alerts.filter((alert) => !alert.resolved);
  const controller = dashboard.system.controller;

  const usageChart = {
    labels: dashboard.dailyUsage.map((row) => row.day),
    datasets: [
      {
        label: "Liters",
        data: dashboard.dailyUsage.map((row) => row.liters),
        borderColor: "#e23744",
        backgroundColor: "rgba(226,55,68,0.10)",
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
        borderColor: "#e23744",
        backgroundColor: "rgba(226,55,68,0.10)"
      }
    ]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroCard
        label="Tank level"
        value={`${Math.round(tankPercentage)}%`}
        percent={tankPercentage}
        caption={controller?.is_online ? controller.meta?.supply_status || "Controller online" : "Controller offline. Showing the last reading received."}
        aside={
          <>
            <StatusPill color={controller?.is_online ? "green" : "rose"} dot>{controller?.is_online ? "Live" : "Offline"}</StatusPill>
            <StatusPill color={dashboard.system.control_mode === "manual" ? "amber" : "blue"}>{dashboard.system.control_mode === "manual" ? "Manual" : "Automatic"}</StatusPill>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard
          label="Supply"
          value={controller?.is_online ? (controller.meta?.main_valve_open ? "Flowing" : "Stopped") : "--"}
          hint={controller?.is_online ? `Main flow ${Number(controller.meta?.main_flow_lpm || 0).toFixed(1)} L/min` : "Controller offline"}
        />
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

      <div className="panel p-4 sm:p-5">
        <p className="panel-title">Daily usage (liters)</p>
        {dashboard.dailyUsage.length ? (
          <div className="mt-4 h-56 sm:h-72">
            <Line data={usageChart} options={cartesianOptions} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No meter readings have been recorded yet.</p>
        )}
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
                  <p className="truncate text-sm font-medium text-ink">{device.device_label}</p>
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
                  <p className="text-sm font-medium text-ink">{alert.affected_house}</p>
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
