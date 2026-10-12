import { formatLiters } from "../lib/format";

// Today's usage against the household's daily limit.
export default function AllowanceBar({ used, limit, extra = 0 }) {
  const usedLiters = Number(used || 0);
  const limitLiters = Number(limit || 0);
  const percent = limitLiters > 0 ? Math.min(100, (usedLiters / limitLiters) * 100) : 0;
  const reached = limitLiters > 0 && usedLiters >= limitLiters;
  const remaining = Math.max(0, limitLiters - usedLiters);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="panel-title">Today's allowance</p>
        <p className="text-sm tabular-nums text-slate-500">
          {formatLiters(usedLiters)} of {formatLiters(limitLiters)}
        </p>
      </div>
      <div className="mt-3 h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full transition-all ${reached ? "bg-red-500" : "bg-brand-600"}`} style={{ width: `${percent}%` }} />
      </div>
      <p className={`mt-3 text-sm ${reached ? "text-red-700" : "text-slate-500"}`}>
        {reached ? "Today's allowance is used up. Supply to your connection resumes tomorrow." : `${formatLiters(remaining)} left today.`}
        {extra > 0 ? ` Includes ${formatLiters(extra)} of approved extra water.` : ""}
      </p>
    </div>
  );
}
