import { useState } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { ChevronRight, Droplets, Receipt, ToggleRight, Zap } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cartesianOptions } from "../../lib/charts";
import { useLive } from "../../lib/useLive";
import { MIN_FLOW_LPM, describeLiveState } from "../../lib/useController";
import { formatDateTime } from "../../lib/format";
import { describeWaterQuality } from "../../lib/waterQuality";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import TankGauge from "../../components/TankGauge";
import TiltCard from "../../components/TiltCard";
import SystemDiagram from "../../components/SystemDiagram";
import QuickActions from "../../components/QuickActions";
import Greeting, { DashboardSkeleton } from "../../components/Greeting";

const severityColor = { high: "rose", medium: "amber", low: "slate" };

const actions = [
  { to: "/admin/water-distribution", label: "Supply", icon: Droplets },
  { to: "/admin/pump-control", label: "Pump", icon: Zap },
  { to: "/admin/valve-control", label: "Valves", icon: ToggleRight },
  { to: "/admin/billing", label: "Billing", icon: Receipt }
];

function SectionHeader({ title, to, linkLabel = "See all" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="panel-title">{title}</p>
      {to ? (
        <Link to={to} className="flex items-center gap-0.5 text-xs font-bold text-brand-600 hover:text-brand-700">
          {linkLabel}
          <ChevronRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);

  useLive(() => api.get("/admin/analytics").then(({ data }) => setDashboard(data)), ["system:update", "alert:new", "device:update"], 30000);

  if (!dashboard) {
    return <DashboardSkeleton />;
  }

  const system = dashboard.system;
  const controller = system.controller;
  const online = Boolean(controller?.is_online);
  const meta = online ? controller.meta || {} : null;
  // The heartbeat is newer than the stored tank log, so prefer it while the controller is online.
  const tankPercentage = Number(meta?.tank_percentage ?? system.tank_percentage ?? 0);
  const pumpRunning = meta ? Boolean(meta.pump_status) : Boolean(system.pump_status);
  const openAlerts = dashboard.alerts.filter((alert) => !alert.resolved);
  // Measured flows and per-house state for the drawings, from the same heartbeats.
  const live = describeLiveState(system, dashboard.deviceStatuses);
  const manual = system.control_mode === "manual";
  const quality = describeWaterQuality(meta || dashboard.waterQuality);

  const usageChart = {
    labels: dashboard.dailyUsage.map((row) => row.day),
    datasets: [{ label: "Liters", data: dashboard.dailyUsage.map((row) => row.liters), borderColor: "#e23744", backgroundColor: "rgba(226,55,68,0.08)", fill: true }]
  };
  const hourlyChart = {
    labels: dashboard.predictions.map((row) => row.slot),
    datasets: [{ label: "Average liters", data: dashboard.predictions.map((row) => row.liters), borderColor: "#1c1c1c", backgroundColor: "rgba(28,28,28,0.06)", fill: true }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <Greeting name={user?.name}>
        <StatusPill color={manual ? "amber" : "blue"}>{manual ? "Manual mode" : "Automatic mode"}</StatusPill>
        <StatusPill color={online ? "green" : "rose"} dot>{online ? "Controller live" : "Controller offline"}</StatusPill>
      </Greeting>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-5">
          <TiltCard className="panel p-5 sm:p-6">
          <SectionHeader title="Overhead tank" to="/admin/tank-monitoring" linkLabel="Details" />
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6 lg:flex-col xl:flex-row">
            <TankGauge percent={tankPercentage} startLevel={system.pump_on_threshold} stopLevel={system.pump_off_threshold} offline={!online} filling={pumpRunning} draining={live.flows.main > MIN_FLOW_LPM} />
            <div className="w-full min-w-0 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Controller says</p>
                <p className="mt-1 text-sm font-bold leading-snug text-ink">
                  {online ? controller.meta?.supply_status || "Running" : "Offline. Showing the last reading received."}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">Pump</dt>
                  <dd className={`mt-0.5 font-extrabold ${pumpRunning ? "text-emerald-600" : "text-ink"}`}>{pumpRunning ? "Running" : "Stopped"}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">Supply</dt>
                  <dd className={`mt-0.5 font-extrabold ${meta?.main_valve_open ? "text-emerald-600" : "text-ink"}`}>{meta ? (meta.main_valve_open ? "Flowing" : "Stopped") : "--"}</dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500">
                Pump starts below {system.pump_on_threshold}% and stops at {system.pump_off_threshold}%. Supply runs once the tank is full.
              </p>
            </div>
          </div>
          </TiltCard>
        </div>

        <div className="space-y-4 lg:col-span-7 lg:space-y-5">
          <QuickActions actions={actions} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard
              label="Water quality"
              value={quality ? quality.title : "No data"}
              hint={quality ? quality.sentence : "Waiting for a reading"}
              accent={quality?.level === "unsafe" ? "text-red-600" : undefined}
            />
            <StatCard label="Open leak alerts" value={dashboard.alertCount} hint={dashboard.alertCount ? "Needs inspection" : "Nothing to review"} accent={dashboard.alertCount ? "text-red-600" : undefined} />
            <StatCard label="Households" value={dashboard.householdCount} hint="Registered connections" />
            <StatCard label="Devices online" value={`${dashboard.onlineDeviceCount} of ${dashboard.deviceStatuses.length}`} hint="Based on recent heartbeats" />
          </div>
        </div>
      </div>

      <div className="panel p-5 sm:p-6">
        <SectionHeader title="Live system" to="/admin/water-distribution" linkLabel="Control" />
        <p className="mt-1 text-sm text-slate-500">
          {online ? "Water is drawn moving only where it is really flowing right now." : "The controller is offline, so nothing is shown as flowing."}
        </p>
        <div className="mx-auto mt-3 max-w-3xl">
          <SystemDiagram meta={meta} tankPercent={tankPercentage} flows={live.flows} houses={live.houses} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="panel p-5 sm:p-6 lg:col-span-8">
          <SectionHeader title="Daily usage (liters)" to="/admin/analytics" linkLabel="Analytics" />
          {dashboard.dailyUsage.length ? (
            <div className="mt-4 h-56 sm:h-72">
              <Line data={usageChart} options={cartesianOptions} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No meter readings have been recorded yet.</p>
          )}
        </div>

        <div className="panel p-5 sm:p-6 lg:col-span-4">
          <SectionHeader title="Devices" to="/admin/system-health" linkLabel="Health" />
          <ul className="mt-2 divide-y divide-slate-100">
            {dashboard.deviceStatuses.map((device) => (
              <li key={device.device_key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{device.device_label}</p>
                  <p className="truncate text-xs text-slate-500">{device.last_seen_at ? `Seen ${formatDateTime(device.last_seen_at)}` : "No heartbeat yet"}</p>
                </div>
                <StatusPill color={device.is_online ? "green" : "slate"} dot>{device.is_online ? "Online" : "Offline"}</StatusPill>
              </li>
            ))}
            {!dashboard.deviceStatuses.length ? <li className="py-3 text-sm text-slate-500">No devices have reported yet.</li> : null}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="panel p-5 sm:p-6 lg:col-span-7">
          <SectionHeader title="Usage by hour (average liters)" to="/admin/ai-predictions" linkLabel="Forecast" />
          {dashboard.predictions.length ? (
            <div className="mt-4 h-56 sm:h-64">
              <Line data={hourlyChart} options={cartesianOptions} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No meter readings have been recorded yet.</p>
          )}
        </div>

        <div className="panel p-5 sm:p-6 lg:col-span-5">
          <SectionHeader title="Open leak alerts" to="/admin/leakage-alerts" />
          <ul className="mt-2 divide-y divide-slate-100">
            {openAlerts.slice(0, 5).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{alert.affected_house}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(alert.detected_at)}</p>
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
