import { useEffect, useState } from "react";
import api from "../../lib/api";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Water Distribution"
        title="Distribution timing and emergency supply control"
        description="Command page for scheduled water release, manual intervention, and emergency supply activation."
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

      {message ? <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pump Status" value={system?.pump_status ? "Running" : "Stopped"} hint="Distribution command follows pump state" />
        <StatCard label="Open Valves" value={String(openValves)} hint="Latest active street and main valves" accent="text-surge" />
        <StatCard label="Tank Level" value={system ? `${system.tank_percentage}%` : "--"} hint="Latest stored tank reading" accent="text-sand" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FeatureListCard
          title="Distribution Controls"
          items={[
            "Open distribution starts the pump and opens all current valves",
            "Close distribution stops supply and closes all valves",
            "Emergency supply immediately activates pump and valves",
            "Valve states update from the latest command history"
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
