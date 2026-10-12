const styles = {
  green: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  blue: { pill: "bg-brand-50 text-brand-700 ring-brand-600/20", dot: "bg-brand-500" },
  rose: { pill: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
  amber: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  slate: { pill: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" }
};

export default function StatusPill({ children, color = "slate", dot = false }) {
  const style = styles[color] || styles.slate;

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.pill}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /> : null}
      {children}
    </span>
  );
}
