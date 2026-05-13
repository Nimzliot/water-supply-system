import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function ValveControlPage() {
  const [system, setSystem] = useState(null);

  const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system));

  useEffect(() => {
    load();
  }, []);

  const toggleValve = async (valve) => {
    await api.post("/admin/valves", { valve_name: valve.valve_name, status: !valve.status });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Valve Control"
        title="Real-time solenoid valve operations"
        description="Control every valve, inspect state changes, and isolate faults quickly."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {system?.valves?.map((valve) => (
          <div key={valve.id} className="panel p-5">
            <p className="text-lg font-semibold text-white">{valve.valve_name}</p>
            <p className="mt-2 text-sm text-slate-300">{valve.status ? "Open" : "Closed"}</p>
            <p className="mt-2 text-xs text-slate-400">Fault detection ready for sensor-backed validation</p>
            <button onClick={() => toggleValve(valve)} className="btn-primary mt-5 w-full">
              {valve.status ? "Close Valve" : "Open Valve"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

