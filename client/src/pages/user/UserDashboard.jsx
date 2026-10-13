import { useState } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { ChevronRight, LifeBuoy, PlusCircle, Receipt, Waves } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cartesianOptions } from "../../lib/charts";
import { useLive } from "../../lib/useLive";
import { formatLiters, formatMoney, formatTime } from "../../lib/format";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import ProgressRing from "../../components/ProgressRing";
import TiltCard from "../../components/TiltCard";
import AnimatedValue from "../../components/AnimatedValue";
import QuickActions from "../../components/QuickActions";
import Greeting, { DashboardSkeleton } from "../../components/Greeting";

const actions = [
  { to: "/user/live-usage", label: "Live usage", icon: Waves },
  { to: "/user/bills", label: "Bills", icon: Receipt },
  { to: "/user/request-extra-water", label: "Extra water", icon: PlusCircle },
  { to: "/user/support", label: "Support", icon: LifeBuoy }
];

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useLive(() => api.get("/user/dashboard").then((response) => setData(response.data)), ["usage:new", "device:update", "billing:update", "request:update", "system:update"], 30000);

  if (!data) {
    return <DashboardSkeleton />;
  }

  const device = data.deviceStatus;
  const limit = Number(data.dailyLimitLiters || 0);
  const used = Number(data.todayUsage || 0);
  const reached = limit > 0 && used >= limit;
  const supplying = data.waterStatus === "Supplying";
  const bill = data.currentBill;

  const chartData = {
    labels: data.history.map((row) => row.day),
    datasets: [{ label: "Liters", data: data.history.map((row) => row.liters), borderColor: "#e23744", backgroundColor: "rgba(226,55,68,0.08)", fill: true }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <Greeting name={user?.name}>
        <StatusPill color={supplying ? "green" : "slate"} dot>{supplying ? "Supply is on" : "Supply is off"}</StatusPill>
      </Greeting>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-7">
          <TiltCard className="panel p-5 sm:p-6">
          <p className="panel-title">Today's water</p>
          <div className="mt-4 flex items-center gap-5 sm:gap-7">
            <ProgressRing percent={limit > 0 ? (used / limit) * 100 : 0}>
              <span className="text-2xl font-extrabold tracking-tight tabular-nums text-ink">
                <AnimatedValue>{formatLiters(used)}</AnimatedValue>
              </span>
              <span className="text-[0.7rem] font-semibold text-slate-500">used</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className={`text-lg font-extrabold leading-snug tracking-tight sm:text-xl ${reached ? "text-brand-600" : "text-ink"}`}>
                {reached ? "Today's limit is used up" : `${formatLiters(Math.max(0, limit - used))} left today`}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {reached ? "Supply to your connection resumes tomorrow." : `Daily limit ${formatLiters(limit)}`}
                {data.extraLitersToday > 0 ? `, including ${formatLiters(data.extraLitersToday)} extra` : ""}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {data.lpcdUsed} L per person · allowance {data.lpcdLimit} L each
              </p>
              <Link to="/user/request-extra-water" className="btn-primary mt-4 w-full sm:w-auto">Request extra water</Link>
            </div>
          </div>
          </TiltCard>
        </div>

        <div className="space-y-4 lg:col-span-5 lg:space-y-5">
          <QuickActions actions={actions} />

          <Link to={bill ? `/user/bill-details/${bill.id}` : "/user/bills"} className="panel flex items-center justify-between gap-3 p-5 transition hover:ring-black/10">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{bill ? `Bill for ${bill.month}` : "Bills"}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums text-ink">{bill ? formatMoney(bill.total_amount) : "No bill yet"}</p>
              {bill ? (
                <div className="mt-2">
                  <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Payment pending"}</StatusPill>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Your first bill appears here once it is generated.</p>
              )}
            </div>
            <ChevronRight size={20} className="shrink-0 text-slate-400" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Water supply" value={supplying ? "On" : "Off"} hint={data.controllerOnline ? "Live from the village controller" : "Controller is offline"} />
        <StatCard
          label="Your meter"
          value={device?.is_online ? "Online" : "Offline"}
          hint={device?.last_seen_at ? `Last reading ${formatTime(device.last_seen_at)}` : "No reading received yet"}
          accent={device?.is_online ? undefined : "text-red-600"}
        />
      </div>

      <div className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="panel-title">Daily usage (liters)</p>
          <Link to="/user/usage-history" className="flex items-center gap-0.5 text-xs font-bold text-brand-600 hover:text-brand-700">
            History
            <ChevronRight size={14} />
          </Link>
        </div>
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
