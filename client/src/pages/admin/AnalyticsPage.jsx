import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

export default function AnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/analytics").then(({ data }) => setData(data));
  }, []);

  if (!data) {
    return <div className="text-slate-300">Loading analytics...</div>;
  }

  const billingChart = {
    labels: data.billingTrend.map((row) => row.month),
    datasets: [
      {
        label: "Revenue",
        data: data.billingTrend.map((row) => row.amount),
        backgroundColor: "rgba(14,165,233,0.55)"
      }
    ]
  };

  const demandChart = {
    labels: data.predictions.map((row) => row.slot),
    datasets: [
      {
        label: "Predicted liters",
        data: data.predictions.map((row) => row.liters),
        borderColor: "#f8e7be",
        backgroundColor: "rgba(248,231,190,0.2)"
      }
    ]
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Daily usage, peak hours, and demand insights"
        description="Operational analytics for consumption, revenue trends, and demand prediction."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="panel-title">Revenue Trend</p>
          <div className="mt-4 h-72">
            <Bar data={billingChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="panel p-5">
          <p className="panel-title">Pump Optimization Forecast</p>
          <div className="mt-4 h-72">
            <Line data={demandChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>
    </div>
  );
}
