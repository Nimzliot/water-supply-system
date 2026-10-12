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
    return () => socket.off("system:update", load);
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
  const dryRun = Boolean(controller?.meta?.dry_run_alert);

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
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Reported Status"
          value={system?.pump_status ? "Running" : "Stopped"}
          hint={controller?.is_online ? "Latest state reported by the controller" : "Controller offline, showing the last reported state"}
        />
        <StatCard label="Command Mode" value={modeLabels[mode]} hint="What the controller is asked to do" accent="text-surge" />
        <StatCard
          label="Dry-Run Protection"
          value={dryRun ? "Tripped" : "Normal"}
          hint={dryRun ? "Pump locked out: tank level did not rise while pumping" : "No dry-run event reported"}
          accent={dryRun ? "text-alert" : "text-sand"}
        />
      </div>
      <FeatureListCard
        title="How Pump Commands Work"
        items={[
          "Automatic: the controller refills the tank below 75% and stops at 95%",
          "Manual ON: the pump runs until the tank reaches 95%",
          "Manual OFF: the pump stays off until the mode is changed",
          "Overflow, sensor-fault, and dry-run protection apply in every mode"
        ]}
      />
    </div>
  );
}
