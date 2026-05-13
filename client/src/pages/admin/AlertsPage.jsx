import { useEffect, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import PageHeader from "../../components/PageHeader";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get("/admin/alerts");
      setAlerts(data.alerts);
    };

    load();
    socket.on("alert:new", load);
    return () => socket.off("alert:new", load);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leakage Alerts"
        title="Leak management and resolution queue"
        description="Review leakage location, severity, timestamp, and resolution state."
      />
      <div className="mt-6 space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="panel p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{alert.affected_house}</p>
                <p className="mt-1 text-sm text-slate-300">Severity: {alert.severity}</p>
                <p className="mt-2 text-xs text-slate-400">{new Date(alert.detected_at).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.resolved ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>
                {alert.resolved ? "Resolved" : "Open"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
