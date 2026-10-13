import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import WaterQualityCard from "../../components/WaterQualityCard";
import { describeWaterQuality } from "../../lib/waterQuality";

function signalLabel(rssi) {
  if (rssi === null || rssi === undefined) return "--";
  if (rssi >= -60) return `Strong (${rssi} dBm)`;
  if (rssi >= -75) return `Fair (${rssi} dBm)`;
  return `Weak (${rssi} dBm)`;
}

export default function SystemHealthPage() {
  const [devices, setDevices] = useState(null);

  useLive(() => api.get("/admin/device-status").then(({ data }) => setDevices(data.devices || [])), ["device:update"], 15000);

  const list = devices || [];
  const controller = list.find((device) => device.device_key === "SYSTEM-ESP32");
  const meta = controller?.is_online ? controller.meta || {} : null;
  const onlineCount = list.filter((device) => device.is_online).length;

  const quality = describeWaterQuality(meta);

  const checks = meta
    ? [
        { label: "Tank level sensor", ok: !meta.sensor_fault, good: "Reading normally", bad: meta.sensor_fault_reason || "The controller cannot read the tank level" },
        { label: "Pump dry-run protection", ok: !meta.dry_run_alert, good: "Not tripped", bad: "Tripped: level did not rise while pumping" },
        { label: "Leak detection", ok: !meta.leak_detected, good: "No leak detected", bad: "Leak detected, valves closed" },
        { label: "Clock", ok: meta.clock_valid !== false, good: meta.clock ? `Controller time ${meta.clock}` : "Time is set", bad: "No valid time, schedules cannot run" },
        { label: "Water quality", ok: quality?.level === "good" || quality?.level === "acceptable", good: quality?.sentence || "Within limits", bad: quality?.sentence || "Outside limits" }
      ]
    : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="System Health" description="Live connectivity and self-checks reported by the controller and household meters." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Devices online" value={`${onlineCount} of ${list.length}`} hint="Based on recent heartbeats" />
        <StatCard label="Controller" value={controller?.is_online ? "Online" : "Offline"} hint={controller?.last_seen_at ? `Last seen ${formatDateTime(controller.last_seen_at)}` : "Never seen"} accent={controller?.is_online ? undefined : "text-red-600"} />
        <StatCard
          label="Controller Wi-Fi"
          value={controller?.is_online ? signalLabel(controller.wifi_rssi).split(" (")[0] : "--"}
          hint={controller?.is_online && controller.wifi_rssi != null ? `${controller.wifi_rssi} dBm` : "Signal at the controller"}
        />
        <StatCard label="Cycle state" value={meta?.cycle_state ? meta.cycle_state.replace("_", " ").toLowerCase() : "--"} hint="What the controller is doing now" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Controller self-checks</p>
          <div className="mt-2 divide-y divide-slate-100">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{check.label}</p>
                  <p className="text-xs text-slate-500">{check.ok ? check.good : check.bad}</p>
                </div>
                <StatusPill color={check.ok ? "green" : "rose"} dot>{check.ok ? "OK" : "Fault"}</StatusPill>
              </div>
            ))}
            {!meta ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">The controller is offline, so no self-check results are available.</p> : null}
          </div>
        </div>

        <div className="panel">
          <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Devices</p>
          <div className="mt-2 divide-y divide-slate-100">
            {list.map((device) => (
              <div key={device.device_key} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{device.device_label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {device.last_seen_at ? `Last seen ${formatDateTime(device.last_seen_at)}` : "Never seen"}
                    {device.is_online ? ` · ${signalLabel(device.wifi_rssi)}` : ""}
                  </p>
                </div>
                <StatusPill color={device.is_online ? "green" : "slate"} dot>{device.is_online ? "Online" : "Offline"}</StatusPill>
              </div>
            ))}
            {devices === null ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">Loading devices...</p> : null}
            {devices && !list.length ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">No device has reported yet.</p> : null}
          </div>
        </div>
      </div>

      <WaterQualityCard reading={meta} offline={!meta} volts={meta ? { ph: meta.ph_volts, tds: meta.tds_volts, turbidity: meta.turbidity_volts } : null} />
    </div>
  );
}
