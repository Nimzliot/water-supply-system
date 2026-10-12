import { useEffect, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import PageHeader from "../../components/PageHeader";

export default function SystemControlsPage() {
  const [system, setSystem] = useState(null);
  const [lpcdLimit, setLpcdLimit] = useState(135);
  const [error, setError] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/system");
    setSystem(data.system);
    setLpcdLimit(Number(data.system.lpcd_limit));
  };

  useEffect(() => {
    load().catch(() => setError("Unable to load system state."));

    // Refresh the live state, but leave the limit field alone while the admin may be typing in it.
    const refresh = () => api.get("/admin/system").then(({ data }) => setSystem(data.system)).catch(() => {});
    socket.on("system:update", refresh);
    return () => socket.off("system:update", refresh);
  }, []);

  const setPumpMode = async (mode) => {
    try {
      setError("");
      await api.post("/admin/pump", { mode });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update pump state.");
    }
  };

  const saveLpcd = async () => {
    try {
      setError("");
      await api.patch("/admin/lpcd", { lpcd_limit: lpcdLimit });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save the LPCD limit.");
    }
  };

  if (!system) {
    return <div className="text-slate-600">{error || "Loading system controls..."}</div>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="System Controls"
        description="Pump mode, daily allowance, valves, and schedules in one place."
      />

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Pump Control</p>
          <p className="mt-4 text-xl font-semibold text-slate-900">{system.pump_status ? "Pump ON" : "Pump OFF"}</p>
          <p className="mt-1 text-sm text-slate-600">Command mode: {system.pump_mode || "auto"}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => setPumpMode("on")} className="btn-primary">Turn ON</button>
            <button onClick={() => setPumpMode("off")} className="btn-secondary">Turn OFF</button>
            <button onClick={() => setPumpMode("auto")} className="btn-secondary">Automatic</button>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Default LPCD Limit</p>
          <input className="input mt-4" type="number" value={lpcdLimit} onChange={(e) => setLpcdLimit(Number(e.target.value))} />
          <button onClick={saveLpcd} className="btn-primary mt-4">Save LPCD Limit</button>
        </div>
      </div>

      <div className="panel p-4 sm:p-5">
        <p className="panel-title">Valve Status</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {system.valves.map((valve) => (
            <div key={valve.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{valve.valve_name}</p>
              <p className="mt-2 text-sm text-slate-600">{valve.status ? "Open" : "Closed"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4 sm:p-5">
        <p className="panel-title">Distribution Schedules</p>
        <div className="mt-4 space-y-3">
          {system.schedules?.map((schedule) => (
            <div key={schedule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{schedule.zone_name}</p>
              <p className="mt-1 text-sm text-slate-600">
                {schedule.start_time} to {schedule.end_time}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {schedule.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
