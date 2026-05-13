import { useEffect, useState } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import StatCard from "../../components/StatCard";

ChartJS.register(ArcElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get("/admin/analytics");
      setDashboard(data);
    };

    load();
    socket.on("system:update", load);
    socket.on("alert:new", load);

    return () => {
      socket.off("system:update", load);
      socket.off("alert:new", load);
    };
  }, []);

  if (!dashboard) {
    return <div className="text-slate-300">Loading admin dashboard...</div>;
  }

  const usageChart = {
    labels: dashboard.dailyUsage.map((row) => row.day),
    datasets: [
      {
        label: "Daily liters",
        data: dashboard.dailyUsage.map((row) => row.liters),
        borderColor: "#3dd9b6",
        backgroundColor: "rgba(61,217,182,0.18)",
        tension: 0.35
      }
    ]
  };

  const predictionChart = {
    labels: dashboard.predictions.map((row) => row.slot),
    datasets: [
      {
        label: "Predicted demand",
        data: dashboard.predictions.map((row) => row.liters),
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.2)"
      }
    ]
  };

  const tankData = {
    labels: ["Tank filled", "Available capacity"],
    datasets: [
      {
        data: [dashboard.system.tank_percentage, 100 - dashboard.system.tank_percentage],
        backgroundColor: ["#3dd9b6", "rgba(255,255,255,0.08)"],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="panel-title">Admin Dashboard</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Village water operations at a glance</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tank Level" value={`${dashboard.system.tank_percentage}%`} hint={`${dashboard.system.water_level} cm level`} />
        <StatCard label="Pump Status" value={dashboard.system.pump_status ? "Running" : "Idle"} hint={`Runtime today: ${dashboard.runtimeHours} hrs`} accent="text-surge" />
        <StatCard label="Active Leak Alerts" value={dashboard.alertCount} hint="Requires field inspection or auto-isolation" accent="text-alert" />
        <StatCard label="Connected Houses" value={dashboard.householdCount} hint="Registered and monitored service connections" accent="text-sand" />
        <StatCard label="Device Status" value={`${dashboard.onlineDeviceCount}/${dashboard.deviceStatuses.length} Online`} hint="Admin heartbeat freshness window: 15 seconds" accent="text-aqua" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="panel p-5">
          <p className="panel-title">Real-Time Usage</p>
          <div className="mt-4 h-72">
            <Line data={usageChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="panel p-5">
          <p className="panel-title">Tank Fill Gauge</p>
          <div className="mx-auto mt-6 h-64 max-w-xs">
            <Doughnut data={tankData} options={{ cutout: "76%", plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="panel-title">AI Demand Prediction</p>
          <div className="mt-4 h-72">
            <Line data={predictionChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="panel p-5">
          <p className="panel-title">Device Heartbeat Status</p>
          <div className="mt-4 space-y-3">
            {dashboard.deviceStatuses.map((device) => (
              <div key={device.device_key} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{device.device_label}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${device.is_online ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>
                    {device.is_online ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Last heartbeat: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "No heartbeat"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <p className="panel-title">Recent Leakage Alerts</p>
          <div className="mt-4 space-y-3">
            {dashboard.alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                <p className="font-semibold text-white">{alert.affected_house}</p>
                <p className="text-sm text-rose-200">Severity: {alert.severity}</p>
                <p className="text-xs text-slate-300">{new Date(alert.detected_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
