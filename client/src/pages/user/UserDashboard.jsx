import { useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../../lib/api";
import { cartesianOptions } from "../../lib/charts";
import { useLive } from "../../lib/useLive";
import { formatLiters, formatMoney, formatTime } from "../../lib/format";
import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import HeroCard from "../../components/HeroCard";

export default function UserDashboard() {
  const [data, setData] = useState(null);

  useLive(() => api.get("/user/dashboard").then((response) => setData(response.data)), ["usage:new", "device:update", "billing:update", "request:update", "system:update"], 30000);

  if (!data) {
    return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  }

  const device = data.deviceStatus;
  const limit = Number(data.dailyLimitLiters || 0);
  const reached = limit > 0 && data.todayUsage >= limit;
  const supplying = data.waterStatus === "Supplying";
  const chartData = {
    labels: data.history.map((row) => row.day),
    datasets: [{ label: "Liters", data: data.history.map((row) => row.liters), borderColor: "#e23744", backgroundColor: "rgba(226,55,68,0.10)", fill: true }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroCard
        label="Used today"
        value={formatLiters(data.todayUsage)}
        percent={limit > 0 ? (data.todayUsage / limit) * 100 : 0}
        danger={reached}
        caption={
          reached
            ? `Today's limit of ${formatLiters(limit)} is used up. Supply resumes tomorrow.`
            : `${formatLiters(Math.max(0, limit - data.todayUsage))} left of ${formatLiters(limit)} today${data.extraLitersToday > 0 ? `, including ${formatLiters(data.extraLitersToday)} extra` : ""}`
        }
        aside={<StatusPill color={supplying ? "green" : "slate"} dot>{supplying ? "Supply on" : "Supply off"}</StatusPill>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Link to="/user/request-extra-water" className="btn-primary">Request extra water</Link>
        <Link to="/user/bills" className="btn-secondary">View bills</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Per person today" value={`${data.lpcdUsed} L`} hint={`Allowance ${data.lpcdLimit} L each`} />
        <StatCard label="Latest bill" value={data.currentBill ? formatMoney(data.currentBill.total_amount) : "--"} hint={data.currentBill ? `${data.currentBill.month} · ${data.currentBill.paid_status ? "Paid" : "Pending"}` : "No bill generated yet"} />
        <div className="col-span-2 xl:col-span-1">
          <StatCard
            label="Your meter"
            value={device?.is_online ? "Online" : "Offline"}
            hint={device?.last_seen_at ? `Last reading ${formatTime(device.last_seen_at)}` : "No reading received yet"}
            accent={device?.is_online ? undefined : "text-red-600"}
          />
        </div>
      </div>

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
