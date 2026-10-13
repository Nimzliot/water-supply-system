import { useState } from "react";
import api from "../../lib/api";
import { useController } from "../../lib/useController";
import { errorMessage, formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";
import { PumpVisual } from "../../components/LiveVisuals";

const commands = [
  { mode: "on", label: "Pump ON", sent: "Pump ON sent. Watch the drawing: it changes when the pump actually starts." },
  { mode: "off", label: "Pump OFF", sent: "Pump OFF sent. Watch the drawing: it changes when the pump actually stops." },
  { mode: "auto", label: "Automatic", sent: "The pump is back under automatic control." }
];

const modeLabels = { auto: "Automatic", on: "Pump ON", off: "Pump OFF" };

export default function PumpControlPage() {
  const { system, setSystem, live } = useController();
  const [savingMode, setSavingMode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const setPumpMode = async (mode) => {
    try {
      setSavingMode(mode);
      setError("");
      setMessage("");
      const { data } = await api.post("/admin/pump", { mode });
      setSystem(data.system);
      setMessage(commands.find((command) => command.mode === mode).sent);
    } catch (err) {
      setError(errorMessage(err, "Unable to update pump state."));
    } finally {
      setSavingMode("");
    }
  };

  const { online, meta, pumpRunning, tankPercent, controller } = live;
  const mode = system?.pump_mode || "auto";
  const startLevel = Number(system?.pump_on_threshold ?? 65);
  const stopLevel = Number(system?.pump_off_threshold ?? 95);
  const dryRun = Boolean(meta?.dry_run_alert);
  const sensorFault = Boolean(meta?.sensor_fault);
  // The controller applies a command on its next sync, a few seconds after it is sent.
  const applied = meta?.pump_mode ? meta.pump_mode === mode : null;

  // Why the pump is in the state it is in, from what the controller reports.
  let reason = "The controller is offline, so the real state of the pump is not known.";
  if (online) {
    if (sensorFault) reason = "Held off: the tank level sensor is not reading, so the pump is not allowed to run.";
    else if (dryRun) reason = "Locked out: the tank level did not rise while the pump was running. It may be running dry.";
    else if (applied === false) reason = "Your command has been sent. Waiting for the controller to pick it up.";
    else if (pumpRunning) reason = `Running. It stops by itself when the tank reaches ${stopLevel}%.`;
    else if (mode === "off") reason = "Stopped because you switched it off.";
    else if (tankPercent >= stopLevel - 5) reason = "Stopped: the tank is full.";
    else if (mode === "on") reason = "Switched on, waiting for the controller to start it.";
    else if (tankPercent < startLevel) reason = `The tank is below ${startLevel}%, so the pump should be running, but the controller has not started it. Check that the controller has the latest sketch and that the pump relay is wired.`;
    else reason = `Stopped: the tank is above ${startLevel}%. It starts by itself when the level falls below that.`;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Pump Control"
        description="The drawing shows what the pump is really doing, as reported by the controller every few seconds."
        actions={
          <StatusPill color={online ? "green" : "rose"} dot>
            {online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}
          </StatusPill>
        }
      />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="panel p-5 sm:p-6 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="panel-title">Pump right now</p>
            <StatusPill color={!online ? "slate" : dryRun || sensorFault ? "rose" : pumpRunning ? "green" : "slate"} dot>
              {!online ? "Unknown" : dryRun ? "Locked out" : sensorFault ? "Sensor fault" : pumpRunning ? "Running" : "Stopped"}
            </StatusPill>
          </div>
          <div className="mt-3">
            <PumpVisual online={online} running={pumpRunning} lockedOut={dryRun} sensorFault={sensorFault} tankPercent={tankPercent} startLevel={startLevel} stopLevel={stopLevel} />
          </div>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">{reason}</p>
        </div>

        <div className="space-y-4 lg:col-span-4 lg:space-y-5">
          <div className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <p className="panel-title">Your command</p>
              {applied === false ? <StatusPill color="amber">Sending...</StatusPill> : null}
            </div>
            <div className="mt-4 grid gap-2">
              {commands.map((command) => (
                <button
                  key={command.mode}
                  onClick={() => setPumpMode(command.mode)}
                  disabled={Boolean(savingMode)}
                  className={`${mode === command.mode ? "btn-primary" : "btn-secondary"} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {savingMode === command.mode ? "Sending..." : command.label}
                  {mode === command.mode && !savingMode ? " (current)" : ""}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Automatic refills the tank below {startLevel}% and stops at {stopLevel}%. The pump never runs with a full tank, a failed level sensor, or after a dry-run trip.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
            <StatCard label="Tank level" value={online ? `${Math.round(tankPercent)}%` : "--"} hint={online ? `Pump stops at ${stopLevel}%` : "Controller offline"} />
            <StatCard label="Command in use" value={modeLabels[meta?.pump_mode] || "--"} hint={online ? "What the controller is following" : "Controller offline"} />
          </div>
        </div>
      </div>
    </div>
  );
}
