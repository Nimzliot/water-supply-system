// The one dark card at the top of a dashboard: the single most important number, with an
// optional progress bar and a line of context. `aside` holds status pills.
export default function HeroCard({ label, value, caption, percent, danger = false, aside, children }) {
  const width = percent === undefined ? null : Math.min(100, Math.max(0, Number(percent) || 0));

  return (
    <div className="rounded-3xl bg-ink p-5 text-white shadow-card sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/60">{label}</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">{value}</p>
        </div>
        {aside ? <div className="flex shrink-0 flex-col items-end gap-2">{aside}</div> : null}
      </div>

      {width !== null ? (
        <div className="mt-5 h-2.5 rounded-full bg-white/15">
          <div className={`h-2.5 rounded-full transition-all duration-500 ${danger ? "bg-brand-400" : "bg-white"}`} style={{ width: `${width}%` }} />
        </div>
      ) : null}

      {caption ? <p className="mt-3 text-sm font-medium text-white/75">{caption}</p> : null}
      {children}
    </div>
  );
}
