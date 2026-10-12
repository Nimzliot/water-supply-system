import { useEffect, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import FeatureListCard from "../../components/FeatureListCard";

const modeLabels = {
  auto: "Automatic",
  on: "Manual ON",
  off: "Manual OFF"
};

const modeMessages = {
  auto: "Pump returned to automatic control.",
  on: "Pump ON command sent. The controller applies it on its next sync.",
  off: "Pump OFF command sent. The controller applies it on its next sync."
};

export default function PumpControlPage() {
  const [system, setSystem] = useState(null);
  const [savingMode, setSavingMode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system)).catch(() => {});

  useEffect(() => {
    load();
    socket.on("system:update", load);
    socket.on("device:update", load);
    return () => {
      socket.off("system:update", load);
      socket.off("device:update", load);
    };
  }, []);

  const setPumpMode = async (mode) => {
    try {
      setSavingMode(mode);
      setError("");
      setMessage("");
      const { data } = await api.post("/admin/pump", { mode });
      setSystem(data.system);
      setMessage(modeMessages[mode]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update pump state.");
    } finally {
      setSavingMode("");
    }
  };

  const mode = system?.pump_mode || "auto";
  const controller = system?.controller;
  const meta = controller?.is_online ? controller.meta || {} : null;
  const dryRun = Boolean(meta?.dry_run_alert);
  // The heartbeat is newer than the stored tank log, so prefer it while the controller is online.
  const running = meta ? Boolean(meta.pump_status) : Boolean(system?.pump_status);
  const tankLevel = Number(meta?.tank_percentage ?? system?.tank_percentage ?? 0).toFixed(0);
  const stopLevel = Number(system?.pump_off_threshold ?? 95);

  // Why the pump is not running although it was switched on.
  let holdReason = "";
  if (meta && mode === "on" && !running) {
    if (meta.sensor_fault) holdReason = "Held off: the tank level sensor is not reading";
    else if (dryRun) holdReason = "Held off: dry-run protection tripped";
    else if (Number(tankLevel) >= stopLevel - 5) holdReason = "Held off: the tank is full";
    else holdReason = "Waiting for the controller to apply the command";
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Pump Control"
        description="Send a pump command to the controller and compare it with the state the hardware reports."
        actions={
          <>
            <button onClick={() => setPumpMode("on")} disabled={Boolean(savingMode)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {savingMode === "on" ? "Saving..." : "Pump ON"}
            </button>
            <button onClick={() => setPumpMode("off")} disabled={Boolean(savingMode)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
              {savingMode === "off" ? "Saving..." : "Pump OFF"}
            </button>
            <button onClick={() => setPumpMode("auto")} disabled={Boolean(savingMode)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
              {savingMode === "auto" ? "Saving..." : "Automatic"}
            </button>
          </>
        }
      />
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Pump right now"
          value={running ? "Running" : "Stopped"}
          hint={controller?.is_online ? holdReason || "Reported live by the controller" : "Controller offline, showing the last reported state"}
        />
        <StatCard label="Your command" value={modeLabels[mode]} hint={`Tank at ${tankLevel}% · stops at ${system?.pump_off_threshold ?? 95}%`} />
        <StatCard
          label="Dry-Run Protection"
          value={dryRun ? "Tripped" : "Normal"}
          hint={dryRun ? "Pump locked out: tank level did not rise while pumping" : "No dry-run event reported"}
          accent={dryRun ? "text-alert" : undefined}
        />
      </div>
      <FeatureListCard
        title="How Pump Commands Work"
        items={[
          `Automatic: the controller refills the tank below ${system?.pump_on_threshold ?? 75}% and stops at ${stopLevel}%`,
          `Pump ON: the pump runs until the tank reaches ${stopLevel}%`,
          "Pump OFF: the pump stays off until the command is changed",
          "The pump never runs with a full tank, a failed level sensor, or after a dry-run trip"
        ]}
      />
    </div>
  );
}
