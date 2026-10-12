import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";

export default function UsageHistoryPage() {
  const [rows, setRows] = useState(null);

  useLive(() => api.get("/user/usage").then(({ data }) => setRows(data.usage || [])), ["usage:new"], 60000);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Usage History" description="Every reading uploaded from your meter, newest first." />
      <div className="panel divide-y divide-slate-100">
        {(rows || []).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{formatDateTime(row.timestamp)}</p>
              <p className="truncate text-xs text-slate-500">{row.flow_sensor_id}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-ink">{row.liters_used} L</p>
              <p className="text-xs tabular-nums text-slate-500">{row.lpcd_used} L per person so far</p>
            </div>
          </div>
        ))}
        {rows === null ? <p className="p-5 text-sm text-slate-500">Loading readings...</p> : null}
        {rows && !rows.length ? <p className="p-5 text-sm text-slate-500">No usage has been recorded yet.</p> : null}
      </div>
    </div>
  );
}
