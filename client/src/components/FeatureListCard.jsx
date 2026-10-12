export default function FeatureListCard({ title, items, tone = "default" }) {
  const marker = tone === "alert" ? "bg-red-500" : tone === "info" ? "bg-brand-500" : "bg-slate-300";

  return (
    <div className="panel p-4 sm:p-5">
      <h3 className="panel-title">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${marker}`} />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
