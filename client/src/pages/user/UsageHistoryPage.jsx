import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function UsageHistoryPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/user/usage").then(({ data }) => setRows(data.usage));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Usage History"
        title="Daily, weekly, and monthly consumption records"
        description="Historical usage feed for household monitoring."
      />
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="panel flex items-center justify-between p-5">
            <div>
              <p className="font-semibold text-white">{new Date(row.timestamp).toLocaleString()}</p>
              <p className="text-sm text-slate-300">Flow sensor: {row.flow_sensor_id}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-aqua">{row.liters_used} L</p>
              <p className="text-sm text-slate-300">{row.lpcd_used} LPCD</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
