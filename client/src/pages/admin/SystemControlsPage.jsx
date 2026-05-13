import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function SystemControlsPage() {
  const [system, setSystem] = useState(null);
  const [lpcdLimit, setLpcdLimit] = useState(135);

  const load = async () => {
    const { data } = await api.get("/admin/system");
    setSystem(data.system);
    setLpcdLimit(data.system.lpcd_limit);
  };

  useEffect(() => {
    load();
  }, []);

  const togglePump = async (pump_status) => {
    await api.post("/admin/pump", { pump_status });
    load();
  };

  const saveLpcd = async () => {
    await api.patch("/admin/lpcd", { lpcd_limit: lpcdLimit });
    load();
  };

  if (!system) {
    return <div className="text-slate-300">Loading system controls...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Controls"
        title="Pump, valve, and LPCD command center"
        description="Unified operations screen for core field hardware and control thresholds."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <p className="panel-title">Pump Control</p>
          <p className="mt-4 text-2xl font-bold text-white">{system.pump_status ? "Pump ON" : "Pump OFF"}</p>
          <div className="mt-4 flex gap-3">
            <button onClick={() => togglePump(true)} className="btn-primary">Turn ON</button>
            <button onClick={() => togglePump(false)} className="btn-secondary">Turn OFF</button>
          </div>
        </div>

        <div className="panel p-5">
          <p className="panel-title">Default LPCD Limit</p>
          <input className="input mt-4" type="number" value={lpcdLimit} onChange={(e) => setLpcdLimit(Number(e.target.value))} />
          <button onClick={saveLpcd} className="btn-primary mt-4">Save LPCD Limit</button>
        </div>
      </div>

      <div className="panel p-5">
        <p className="panel-title">Valve Status</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {system.valves.map((valve) => (
            <div key={valve.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="font-semibold text-white">{valve.valve_name}</p>
              <p className="mt-2 text-sm text-slate-300">{valve.status ? "Open" : "Closed"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <p className="panel-title">Distribution Schedules</p>
        <div className="mt-4 space-y-3">
          {system.schedules?.map((schedule) => (
            <div key={schedule.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="font-semibold text-white">{schedule.zone_name}</p>
              <p className="mt-1 text-sm text-slate-300">
                {schedule.start_time} to {schedule.end_time}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                {schedule.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
