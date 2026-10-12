import { useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../../lib/api";
import { cartesianOptions } from "../../lib/charts";
import { useLive } from "../../lib/useLive";
import { formatLiters, formatMoney, formatTime } from "../../lib/format";
import StatCard from "../../components/StatCard";
import PageHeader from "../../components/PageHeader";
import AllowanceBar from "../../components/AllowanceBar";

export default function UserDashboard() {
  const [data, setData] = useState(null);

  useLive(() => api.get("/user/dashboard").then((response) => setData(response.data)), ["usage:new", "device:update", "billing:update", "request:update", "system:update"], 30000);

  if (!data) {
    return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  }

  const device = data.deviceStatus;
  const chartData = {
    labels: data.history.map((row) => row.day),
    datasets: [{ label: "Liters", data: data.history.map((row) => row.liters), borderColor: "#1c668c", backgroundColor: "rgba(28,102,140,0.12)", fill: true }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Dashboard" description="Your usage today, current bill, and supply status." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Used today" value={formatLiters(data.todayUsage)} hint={`${data.lpcdUsed} L per person`} />
        <StatCard label="Latest bill" value={data.currentBill ? formatMoney(data.currentBill.total_amount) : "--"} hint={data.currentBill ? `${data.currentBill.month} · ${data.currentBill.paid_status ? "Paid" : "Pending"}` : "No bill generated yet"} />
        <StatCard label="Water supply" value={data.waterStatus} hint={data.controllerOnline ? "Live from the village controller" : "Controller is offline"} />
        <StatCard
          label="Your meter"
          value={device?.is_online ? "Online" : "Offline"}
          hint={device?.last_seen_at ? `Last reading ${formatTime(device.last_seen_at)}` : "No reading received yet"}
          accent={device?.is_online ? undefined : "text-red-600"}
        />
      </div>

      <AllowanceBar used={data.todayUsage} limit={data.dailyLimitLiters} extra={data.extraLitersToday} />

      <div className="panel p-4 sm:p-5">
        <p className="panel-title">Daily usage (liters)</p>
        {data.history.length ? (
          <div className="mt-4 h-56 sm:h-72">
            <Line data={chartData} options={cartesianOptions} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No usage has been recorded on your connection yet.</p>
        )}
      </div>
    </div>
  );
}
