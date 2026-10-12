// "blue" is the neutral informational style. The brand red is kept for actions, so status
// never competes with buttons.
const styles = {
  green: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  blue: { pill: "bg-slate-100 text-ink", dot: "bg-ink" },
  rose: { pill: "bg-red-50 text-red-700", dot: "bg-red-500" },
  amber: { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  slate: { pill: "bg-slate-100 text-slate-500", dot: "bg-slate-400" }
};

export default function StatusPill({ children, color = "slate", dot = false }) {
  const style = styles[color] || styles.slate;
  // Statuses come from the database in lower case ("pending", "approved").
  const label = typeof children === "string" ? children.charAt(0).toUpperCase() + children.slice(1) : children;

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${style.pill}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /> : null}
      {label}
    </span>
  );
}
