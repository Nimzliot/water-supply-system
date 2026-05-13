import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import api from "../../lib/api";
import StatCard from "../../components/StatCard";
import PageHeader from "../../components/PageHeader";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

export default function UserDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/user/dashboard").then(({ data }) => setData(data));
  }, []);

  if (!data) {
    return <div className="text-slate-300">Loading household dashboard...</div>;
  }

  const chartData = {
    labels: data.history.map((row) => row.day),
    datasets: [
      {
        label: "Daily consumption",
        data: data.history.map((row) => row.liters),
        borderColor: "#3dd9b6",
        backgroundColor: "rgba(61,217,182,0.18)"
      }
    ]
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Household Dashboard"
        title="Today’s usage, bill, LPCD progress, and availability"
        description="Simple multi-page household view with live consumption awareness and self-service actions."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={`${data.todayUsage} L`} hint="Current household consumption" />
        <StatCard label="Monthly Bill" value={`Rs. ${data.currentBill?.total_amount || 0}`} hint={data.currentBill?.month || "No bill generated"} accent="text-surge" />
        <StatCard label="LPCD Used" value={`${data.lpcdUsed}`} hint={`of ${data.lpcdLimit} LPCD target`} accent="text-sand" />
        <StatCard label="Water Status" value={data.waterStatus} hint="Live supply availability" accent="text-aqua" />
        <StatCard
          label="Device Status"
          value={data.deviceStatus?.is_online ? "Online" : "Offline"}
          hint={data.deviceStatus?.last_seen_at ? `Last heartbeat: ${new Date(data.deviceStatus.last_seen_at).toLocaleTimeString()}` : "Waiting for heartbeat"}
          accent={data.deviceStatus?.is_online ? "text-aqua" : "text-alert"}
        />
      </div>
      <div className="panel p-5">
        <p className="panel-title">Daily Consumption</p>
        <div className="mt-4 h-72">
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      </div>
    </div>
  );
}
