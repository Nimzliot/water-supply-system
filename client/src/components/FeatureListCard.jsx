export default function FeatureListCard({ title, items, tone = "default" }) {
  const toneClass =
    tone === "alert"
      ? "border-rose-400/20 bg-rose-400/10"
      : tone === "info"
        ? "border-sky-400/20 bg-sky-400/10"
        : "border-white/10 bg-slate-900/40";

  return (
    <div className={`panel p-5 ${toneClass}`}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-2 text-sm text-slate-200">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

