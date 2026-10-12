import { useParams } from "react-router-dom";
import { useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../../lib/api";
import { cartesianOptions } from "../../lib/charts";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime, formatLiters, formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

export default function HouseholdDetailsPage() {
  const { id } = useParams();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  useLive(
    () =>
      api
        .get(`/admin/houses/${id}`)
        .then(({ data }) => setDetails(data))
        .catch((err) => setError(errorMessage(err, "Unable to load this household."))),
    ["device:update", "usage:new", "billing:update", "request:update"],
    30000
  );

  if (!details) {
    return error ? <Notice tone="error">{error}</Notice> : <div className="text-sm text-slate-500">Loading household...</div>;
  }

  const { house, allowance, device, dailyUsage, recentUsage, bills } = details;
  const live = device?.is_online ? device.meta || {} : null;
  const usedToday = allowance?.liters_today ?? 0;
  const limit = allowance?.daily_limit_liters ?? 0;

  const chart = {
    labels: dailyUsage.map((row) => row.day),
    datasets: [{ label: "Liters", data: dailyUsage.map((row) => row.liters), borderColor: "#1c668c", backgroundColor: "rgba(28,102,140,0.12)", fill: true }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow={house.name}
        description={`${house.service_number} · ${house.family_members} family ${house.family_members === 1 ? "member" : "members"} · ${house.mobile || "no mobile"}`}
        actions={<StatusPill color={device?.is_online ? "green" : "slate"} dot>{device?.is_online ? "Meter online" : "Meter offline"}</StatusPill>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Flow now" value={live ? `${Number(live.flow_lpm || 0).toFixed(1)} L/min` : "--"} hint={live ? "Live from the meter" : "Meter is offline"} />
        <StatCard label="Valve" value={live ? (live.valve_open ? "Open" : "Closed") : "--"} hint={live ? "Reported by the controller" : "Meter is offline"} />
        <StatCard
          label="Used today"
          value={formatLiters(usedToday)}
          hint={limit ? `of ${formatLiters(limit)} allowed` : "No limit set"}
          accent={limit && usedToday >= limit ? "text-red-600" : undefined}
        />
        <StatCard label="Latest bill" value={bills[0] ? formatMoney(bills[0].total_amount) : "--"} hint={bills[0] ? `${bills[0].month} · ${bills[0].paid_status ? "Paid" : "Pending"}` : "No bill generated yet"} />
      </div>

      <div className="panel p-4 sm:p-5">
        <p className="panel-title">Daily usage (liters)</p>
        {dailyUsage.length ? (
          <div className="mt-4 h-56 sm:h-72">
            <Line data={chart} options={cartesianOptions} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No usage recorded for this household yet.</p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Recent readings</p>
          <div className="mt-2 divide-y divide-slate-100">
            {recentUsage.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <p className="truncate text-sm text-slate-600">{formatDateTime(row.timestamp)}</p>
                <p className="shrink-0 text-sm font-medium tabular-nums text-slate-900">{row.liters_used} L</p>
              </div>
            ))}
            {!recentUsage.length ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">No readings yet.</p> : null}
          </div>
        </div>

        <div className="panel">
          <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Bills</p>
          <div className="mt-2 divide-y divide-slate-100">
            {bills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{bill.month}</p>
                  <p className="text-xs text-slate-500">{bill.total_usage} L</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-sm font-medium tabular-nums text-slate-900">{formatMoney(bill.total_amount)}</p>
                  <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Pending"}</StatusPill>
                </div>
              </div>
            ))}
            {!bills.length ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">No bills generated yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
