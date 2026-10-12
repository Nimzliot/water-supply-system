import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatDateTime, formatLiters, formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import AllowanceBar from "../../components/AllowanceBar";

export default function LiveUsagePage() {
  const [device, setDevice] = useState(null);
  const [usage, setUsage] = useState([]);

  useLive(
    () =>
      Promise.all([
        api.get("/user/device-status").then(({ data }) => setDevice(data.device)),
        api.get("/user/usage").then(({ data }) => setUsage((data.usage || []).slice(0, 10)))
      ]),
    ["device:update", "usage:new"],
    15000
  );

  const online = Boolean(device?.is_online);
  const live = online ? device.meta || {} : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Live Usage"
        description="Readings from the meter on your connection, updated every few seconds while it is online."
        actions={<StatusPill color={online ? "green" : "slate"} dot>{online ? `Live · ${formatTime(device.last_seen_at)}` : "Meter offline"}</StatusPill>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Flow now" value={live ? `${Number(live.flow_lpm || 0).toFixed(1)} L/min` : "--"} hint={live ? (Number(live.flow_lpm) > 0 ? "Water is flowing" : "No water flowing") : "Waiting for the meter"} />
        <StatCard label="Your valve" value={live ? (live.valve_open ? "Open" : "Closed") : "--"} hint={live ? (live.limit_reached ? "Closed: daily limit reached" : "Set by the village controller") : "Waiting for the meter"} />
        <StatCard label="Used today" value={live ? formatLiters(live.liters_today) : "--"} hint={live ? `${Number(live.lpcd_used || 0).toFixed(1)} L per person` : "Waiting for the meter"} />
        <StatCard label="Last reading" value={device?.last_seen_at ? formatTime(device.last_seen_at) : "--"} hint={device?.last_seen_at ? new Date(device.last_seen_at).toLocaleDateString() : "Nothing received yet"} />
      </div>

      {live ? <AllowanceBar used={live.liters_today} limit={live.daily_limit_liters} /> : null}

      <div className="panel">
        <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Latest recorded readings</p>
        <div className="mt-2 divide-y divide-slate-100">
          {usage.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
              <p className="truncate text-sm text-slate-600">{formatDateTime(row.timestamp)}</p>
              <p className="shrink-0 text-sm font-medium tabular-nums text-ink">{row.liters_used} L</p>
            </div>
          ))}
          {!usage.length ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">No readings recorded yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
