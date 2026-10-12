import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import ControlModeCard from "../../components/ControlModeCard";
import Notice from "../../components/Notice";

const actions = {
  open: { label: "Open Distribution", busy: "Opening...", done: "All valves switched on.", style: "btn-primary" },
  close: { label: "Close Distribution", busy: "Closing...", done: "All valves switched off. Supply stops within a few seconds.", style: "btn-secondary" },
  emergency: { label: "Emergency Supply", busy: "Starting...", done: "Emergency supply started: Manual mode is on and every valve is open.", style: "btn-danger" }
};

export default function WaterDistributionPage() {
  const [system, setSystem] = useState(null);
  const [busyMode, setBusyMode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useLive(() => api.get("/admin/system").then(({ data }) => setSystem(data.system)), ["system:update", "device:update"], 15000);

  const handleDistribution = async (mode) => {
    if (mode === "emergency" && !window.confirm("Start emergency supply? This switches to Manual mode and opens every valve now, ignoring schedules and daily limits.")) {
      return;
    }

    try {
      setBusyMode(mode);
      setError("");
      setMessage("");
      const { data } = await api.post("/admin/distribution", { mode });
      setSystem(data.system);
      setMessage(actions[mode].done);
    } catch (err) {
      setError(errorMessage(err, "Unable to update water distribution."));
    } finally {
      setBusyMode("");
    }
  };

  const controller = system?.controller;
  const meta = controller?.is_online ? controller.meta || {} : null;
  const switchedOn = system?.valves?.filter((valve) => valve.status).length || 0;
  const relaysOpen = meta ? [meta.main_valve_open, meta.house1_valve_open, meta.house2_valve_open].filter(Boolean).length : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Water Distribution"
        description="Switch supply to all households on or off, or force water on in an emergency."
        actions={Object.entries(actions).map(([mode, action]) => (
          <button key={mode} onClick={() => handleDistribution(mode)} disabled={Boolean(busyMode)} className={`${action.style} disabled:cursor-not-allowed disabled:opacity-60`}>
            {busyMode === mode ? action.busy : action.label}
          </button>
        ))}
      />

      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      <ControlModeCard system={system} onChange={setSystem} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Supply" value={meta ? (meta.main_valve_open ? "Flowing" : "Stopped") : "--"} hint={meta ? `Main flow ${Number(meta.main_flow_lpm || 0).toFixed(1)} L/min` : "Controller offline"} />
        <StatCard label="Valves open now" value={relaysOpen === null ? "--" : `${relaysOpen} of 3`} hint={`${switchedOn} switched on in the dashboard`} />
        <StatCard label="Tank level" value={system ? `${system.tank_percentage}%` : "--"} hint={`Pump ${system?.pump_status ? "running" : "stopped"} · mode ${system?.pump_mode || "auto"}`} />
        <StatCard
          label="Water quality"
          value={system?.waterQuality ? (system.waterQuality.is_safe ? "Safe" : "Unsafe") : "--"}
          hint={system?.waterQuality ? `TDS ${system.waterQuality.tds_value} · pH ${system.waterQuality.ph_value}` : "No reading yet"}
          accent={system?.waterQuality?.is_safe === false ? "text-red-600" : undefined}
        />
      </div>

      <div className="panel">
        <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Valves</p>
        <div className="mt-2 divide-y divide-slate-100">
          {(system?.valves || []).map((valve) => (
            <div key={valve.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <p className="min-w-0 truncate text-sm text-ink">{valve.valve_name}</p>
              <p className="shrink-0 text-sm text-slate-500">{valve.status ? "Switched on" : "Switched off"}</p>
            </div>
          ))}
          {system && !system.valves?.length ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">No valves are set up yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
