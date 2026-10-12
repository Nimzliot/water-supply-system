import { useEffect, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";
import StatCard from "../../components/StatCard";

export default function WaterDistributionPage() {
  const [system, setSystem] = useState(null);
  const [busyMode, setBusyMode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/system");
    setSystem(data.system);
  };

  useEffect(() => {
    load();
    socket.on("system:update", load);

    return () => {
      socket.off("system:update", load);
    };
  }, []);

  const handleDistribution = async (mode) => {
    try {
      setBusyMode(mode);
      setError("");
      const { data } = await api.post("/admin/distribution", { mode });
      setSystem(data.system);
      setMessage(
        mode === "close"
          ? "Distribution stopped and valves closed."
          : mode === "emergency"
            ? "Emergency supply started immediately."
            : "Distribution opened successfully."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update water distribution.");
    } finally {
      setBusyMode("");
    }
  };

  const openValves = system?.valves?.filter((valve) => valve.status).length || 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Water Distribution"
        description="Open or close supply to all households."
        actions={
          <>
            <button onClick={() => handleDistribution("open")} disabled={Boolean(busyMode)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {busyMode === "open" ? "Opening..." : "Open Distribution"}
            </button>
            <button onClick={() => handleDistribution("close")} disabled={Boolean(busyMode)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
              {busyMode === "close" ? "Closing..." : "Close Distribution"}
            </button>
            <button onClick={() => handleDistribution("emergency")} disabled={Boolean(busyMode)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
              {busyMode === "emergency" ? "Starting..." : "Emergency Supply"}
            </button>
          </>
        }
      />

      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Pump Status" value={system?.pump_status ? "Running" : "Stopped"} hint={`Reported by the controller | mode: ${system?.pump_mode || "auto"}`} />
        <StatCard label="Open Valves" value={String(openValves)} hint="Valves currently enabled for distribution" accent="text-surge" />
        <StatCard label="Tank Level" value={system ? `${system.tank_percentage}%` : "--"} hint="Latest stored tank reading" accent="text-sand" />
        <StatCard label="Water Quality" value={system?.waterQuality ? (system.waterQuality.is_safe ? "Safe" : "Unsafe") : "--"} hint={system?.waterQuality ? `TDS: ${system.waterQuality.tds_value} | pH: ${system.waterQuality.ph_value}` : "No telemetry"} accent={system?.waterQuality?.is_safe === false ? "text-red-600" : "text-emerald-600"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FeatureListCard
          title="Distribution Controls"
          items={[
            "Open distribution enables every valve for the controller",
            "Close distribution stops supply and closes all valves",
            "Emergency supply enables every valve immediately",
            "The pump keeps refilling the tank on its own; use Pump Control to override it"
          ]}
          tone="info"
        />
        <FeatureListCard
          title="Current Valve State"
          items={
            system?.valves?.length
              ? system.valves.map((valve) => `${valve.valve_name}: ${valve.status ? "Open" : "Closed"}`)
              : ["No valve records found yet"]
          }
        />
      </div>
    </div>
  );
}
