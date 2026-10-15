import { useState } from "react";
import api from "../../lib/api";
import { MIN_FLOW_LPM, useController } from "../../lib/useController";
import { errorMessage, formatTime } from "../../lib/format";
import { describeWaterQuality } from "../../lib/waterQuality";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import ControlModeCard from "../../components/ControlModeCard";
import SystemDiagram from "../../components/SystemDiagram";
import Notice from "../../components/Notice";

const actions = {
  open: { label: "Open Distribution", busy: "Opening...", done: "Automatic mode is on. The controller supplies water by itself whenever the tank is full and a schedule is running.", style: "btn-primary" },
  close: { label: "Close Distribution", busy: "Closing...", done: "Manual mode is on with every valve switched off. Supply stops within a few seconds.", style: "btn-secondary" },
  emergency: { label: "Emergency Supply", busy: "Starting...", done: "Emergency supply started: Manual mode is on and every valve is open.", style: "btn-danger" }
};

export default function WaterDistributionPage() {
  const { system, setSystem, live } = useController();
  const [busyMode, setBusyMode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const { online, meta, flows, houses, tankPercent, pumpRunning, controller } = live;
  const switchedOn = system?.valves?.filter((valve) => valve.status).length || 0;
  const relaysOpen = meta ? [meta.main_valve_open, meta.house1_valve_open, meta.house2_valve_open].filter(Boolean).length : null;
  const flowing = flows.main > MIN_FLOW_LPM;
  const quality = describeWaterQuality(meta || system?.waterQuality);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Water Distribution"
        description="Open hands supply to the automatic cycle, Close stops it, and Emergency forces water on now."
        actions={Object.entries(actions).map(([mode, action]) => (
          <button key={mode} onClick={() => handleDistribution(mode)} disabled={Boolean(busyMode)} className={`${action.style} disabled:cursor-not-allowed disabled:opacity-60`}>
            {busyMode === mode ? action.busy : action.label}
          </button>
        ))}
      />

      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="panel-title">Live system</p>
          <StatusPill color={online ? "green" : "rose"} dot>{online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {online
            ? "Each part follows the hardware: valves turn with their relays, and water moves along a pipe only while its meter measures flow."
            : "The controller is offline, so nothing is shown as moving."}
        </p>
        <div className="mx-auto mt-3 max-w-3xl">
          <SystemDiagram meta={meta} tankPercent={tankPercent} flows={flows} houses={houses} />
        </div>
      </div>

      <ControlModeCard system={system} onChange={setSystem} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Supply" value={online ? (flowing ? "Flowing" : meta.main_valve_open ? "Open" : "Stopped") : "--"} hint={online ? `Main meter ${flows.main.toFixed(1)} L/min` : "Controller offline"} />
        <StatCard label="Valves open now" value={relaysOpen === null ? "--" : `${relaysOpen} of 3`} hint={system?.control_mode === "manual" ? `${switchedOn} switched on in the dashboard` : "Opened by the automatic cycle"} />
        <StatCard label="Tank level" value={online ? `${Math.round(tankPercent)}%` : "--"} hint={online ? `Pump ${pumpRunning ? "running" : "stopped"} · mode ${system?.pump_mode || "auto"}` : "Controller offline"} />
        <StatCard
          label="Water quality"
          value={quality ? quality.title : "--"}
          hint={quality ? quality.sentence : "No reading yet"}
          accent={quality?.level === "unsafe" ? "text-red-600" : undefined}
        />
      </div>
    </div>
  );
}
