import { useEffect, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/alerts");
      setAlerts(data.alerts || []);
    } catch {
      // Keep the current list; the next live update retries.
    }
  };

  const setResolved = async (alert, resolved) => {
    await api.patch(`/admin/alerts/${alert.id}`, { resolved }).catch(() => {});
    load();
  };

  useEffect(() => {
    load();
    socket.on("alert:new", load);
    return () => socket.off("alert:new", load);
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Leakage Alerts"
        description="Leaks detected by the controller. Mark each one resolved after inspection."
      />
      <div className="panel divide-y divide-slate-100">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{alert.affected_house}</p>
                <StatusPill color={alert.resolved ? "green" : "rose"}>{alert.resolved ? "Resolved" : "Open"}</StatusPill>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                <span className="capitalize">{alert.severity}</span> severity · {new Date(alert.detected_at).toLocaleString()}
              </p>
            </div>
            <button type="button" onClick={() => setResolved(alert, !alert.resolved)} className="btn-secondary w-full sm:w-auto">
              {alert.resolved ? "Reopen" : "Mark resolved"}
            </button>
          </div>
        ))}
        {!alerts.length ? <p className="p-5 text-sm text-slate-500">No leak alerts have been reported.</p> : null}
      </div>
    </div>
  );
}
