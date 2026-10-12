// Values stay neutral; colour is reserved for states that need attention.
const tones = {
  "text-alert": "text-red-600",
  "text-red-600": "text-red-600",
  "text-emerald-600": "text-emerald-600"
};

export default function StatCard({ label, value, hint, accent }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
      <div className={`mt-1.5 break-words text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl ${tones[accent] || "text-ink"}`}>{value}</div>
      {hint ? <p className="mt-1 text-xs text-slate-500 sm:text-sm">{hint}</p> : null}
    </div>
  );
}
