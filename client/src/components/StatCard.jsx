// Values stay neutral; colour is reserved for states that need attention.
const tones = {
  "text-alert": "text-red-600",
  "text-red-600": "text-red-600",
  "text-emerald-600": "text-emerald-600"
};

export default function StatCard({ label, value, hint, accent }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className={`mt-2 break-words text-xl font-semibold sm:text-2xl tabular-nums ${tones[accent] || "text-slate-900"}`}>{value}</div>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
