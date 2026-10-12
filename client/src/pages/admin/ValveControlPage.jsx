import { useEffect, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";

export default function ValveControlPage() {
  const [system, setSystem] = useState(null);

  const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system)).catch(() => {});

  useEffect(() => {
    load();
    socket.on("system:update", load);
    return () => socket.off("system:update", load);
  }, []);

  const toggleValve = async (valve) => {
    await api.post("/admin/valves", { valve_name: valve.valve_name, status: !valve.status }).catch(() => {});
    load();
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Valve Control"
        description="Enable or disable each valve. The controller opens enabled valves only while it is distributing."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {system?.valves?.map((valve) => (
          <div key={valve.id} className="panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-slate-900">{valve.valve_name}</p>
              <StatusPill color={valve.status ? "green" : "slate"} dot>{valve.status ? "Open" : "Closed"}</StatusPill>
            </div>
            <p className="mt-1 text-xs text-slate-500">Changed {new Date(valve.timestamp).toLocaleString()}</p>
            <button onClick={() => toggleValve(valve)} className={`${valve.status ? "btn-secondary" : "btn-primary"} mt-4 w-full`}>
              {valve.status ? "Close valve" : "Open valve"}
            </button>
          </div>
        ))}
        {system && !system.valves?.length ? (
          <p className="panel p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            No valves are set up yet. Run the database migration to add the main and household valves.
          </p>
        ) : null}
      </div>
    </div>
  );
}

