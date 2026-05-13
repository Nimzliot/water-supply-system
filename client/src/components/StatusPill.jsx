export default function StatusPill({ children, color = "slate" }) {
  const styles = {
    green: "bg-emerald-400/20 text-emerald-200",
    blue: "bg-sky-400/20 text-sky-200",
    rose: "bg-rose-400/20 text-rose-200",
    amber: "bg-amber-400/20 text-amber-200",
    slate: "bg-white/10 text-slate-200"
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${styles[color]}`}>{children}</span>;
}

