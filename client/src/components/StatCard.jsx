export default function StatCard({ label, value, hint, accent = "text-aqua" }) {
  return (
    <div className="panel p-5">
      <p className="panel-title">{label}</p>
      <div className={`mt-3 text-3xl font-bold ${accent}`}>{value}</div>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

