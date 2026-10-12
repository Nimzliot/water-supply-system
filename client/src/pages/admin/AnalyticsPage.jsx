import { useState } from "react";
import { useLive } from "../../lib/useLive";
import { Bar, Line } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import api from "../../lib/api";
import { cartesianOptions } from "../../lib/charts";
import PageHeader from "../../components/PageHeader";

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

export default function AnalyticsPage() {
  const [data, setData] = useState(null);

  useLive(() => api.get("/admin/analytics").then((response) => setData(response.data)), ["usage:new", "billing:update"], 60000);

  if (!data) {
    return <div className="text-sm text-slate-500">Loading analytics...</div>;
  }

  const billingChart = {
    labels: data.billingTrend.map((row) => row.month),
    datasets: [
      {
        label: "Rs.",
        data: data.billingTrend.map((row) => row.amount),
        backgroundColor: "#e23744"
      }
    ]
  };

  const usageChart = {
    labels: data.dailyUsage.map((row) => row.day),
    datasets: [
      {
        label: "Liters",
        data: data.dailyUsage.map((row) => row.liters),
        borderColor: "#e23744",
        backgroundColor: "rgba(226,55,68,0.10)",
        fill: true
      }
    ]
  };

  const demandChart = {
    labels: data.predictions.map((row) => row.slot),
    datasets: [
      {
        label: "Liters",
        data: data.predictions.map((row) => row.liters),
        borderColor: "#e23744",
        backgroundColor: "rgba(226,55,68,0.10)"
      }
    ]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Analytics"
        description="Billing totals by month and average usage by hour."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Billed amount by month (Rs.)</p>
          {data.billingTrend.length ? (
            <div className="mt-4 h-56 sm:h-72">
              <Bar data={billingChart} options={cartesianOptions} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No bills have been generated yet.</p>
          )}
        </div>
        <div className="panel p-4 sm:p-5">
          <p className="panel-title">Average reading by hour of day (liters)</p>
          {data.predictions.length ? (
            <div className="mt-4 h-56 sm:h-72">
              <Line data={demandChart} options={cartesianOptions} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No meter readings have been recorded yet.</p>
          )}
        </div>
        <div className="panel p-4 sm:p-5 xl:col-span-2">
          <p className="panel-title">Daily usage, all households (liters)</p>
          {data.dailyUsage.length ? (
            <div className="mt-4 h-56 sm:h-72">
              <Line data={usageChart} options={cartesianOptions} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No meter readings have been recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
