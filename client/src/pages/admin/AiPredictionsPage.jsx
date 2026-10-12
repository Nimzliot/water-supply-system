import { useState } from "react";
import { Bar } from "react-chartjs-2";
import api from "../../lib/api";
import { cartesianOptions } from "../../lib/charts";
import { useLive } from "../../lib/useLive";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";

// Demand forecast: the average water drawn in each hour of the day, from recorded readings.
export default function AiPredictionsPage() {
  const [data, setData] = useState(null);

  useLive(() => api.get("/admin/analytics").then((response) => setData(response.data)), ["usage:new"], 60000);

  if (!data) {
    return <div className="text-sm text-slate-500">Loading forecast...</div>;
  }

  const slots = data.predictions || [];
  const peak = slots.reduce((best, slot) => (!best || slot.total > best.total ? slot : best), null);
  const quiet = slots.reduce((best, slot) => (!best || slot.total < best.total ? slot : best), null);
  const readings = slots.reduce((total, slot) => total + slot.readings, 0);

  const chart = {
    labels: slots.map((slot) => slot.slot),
    datasets: [{ label: "Liters", data: slots.map((slot) => slot.total), backgroundColor: "rgba(28,102,140,0.8)" }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Demand Forecast" description="When households draw water, based on the most recent meter readings. Use it to place supply windows." />

      {slots.length ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label="Busiest hour" value={peak.slot} hint={`${peak.total} L recorded`} />
            <StatCard label="Quietest hour" value={quiet.slot} hint={`${quiet.total} L recorded`} />
            <StatCard label="Readings used" value={readings} hint="Most recent meter uploads" />
          </div>
          <div className="panel p-4 sm:p-5">
            <p className="panel-title">Water drawn by hour of day (liters)</p>
            <div className="mt-4 h-56 sm:h-80">
              <Bar data={chart} options={cartesianOptions} />
            </div>
          </div>
        </>
      ) : (
        <div className="panel p-5 text-sm text-slate-500">
          No meter readings have been recorded yet. The forecast appears once households start drawing water.
        </div>
      )}
    </div>
  );
}
