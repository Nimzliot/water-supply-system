import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import FeatureListCard from "../../components/FeatureListCard";

export default function PumpControlPage() {
  const [system, setSystem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system));

  useEffect(() => {
    load();
  }, []);

  const setPump = async (pump_status) => {
    try {
      setSaving(true);
      setError("");
      await api.post("/admin/pump", { pump_status });
      await load();
      setMessage(`Pump turned ${pump_status ? "ON" : "OFF"} successfully.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update pump state.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pump Control"
        title="Manual and automatic pump management"
        description="Control runtime, review automation mode, and track dry-run or fault events."
        actions={
          <>
            <button onClick={() => setPump(true)} disabled={saving} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {saving && system?.pump_status !== true ? "Saving..." : "Pump ON"}
            </button>
            <button onClick={() => setPump(false)} disabled={saving} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
              {saving && system?.pump_status !== false ? "Saving..." : "Pump OFF"}
            </button>
          </>
        }
      />
      {message ? <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Current Status" value={system?.pump_status ? "Running" : "Stopped"} hint="Live command state" />
        <StatCard label="Mode" value="Auto + Manual Override" hint="Supports scheduled protection logic" accent="text-surge" />
        <StatCard label="Dry-Run Alerts" value="0" hint="No dry-run events in current sample state" accent="text-sand" />
      </div>
      <FeatureListCard
        title="Pump Page Modules"
        items={[
          "Manual ON/OFF override",
          "Runtime logs and history",
          "Auto mode/manual mode indicator",
          "Dry-run and fault alert tracking"
        ]}
      />
    </div>
  );
}
