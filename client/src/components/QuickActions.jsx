import { Link } from "react-router-dom";

// A row of shortcuts: an icon tile with a short label under it, four across.
export default function QuickActions({ actions }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {actions.map(({ to, label, icon: Icon, badge }) => (
        <Link key={to} to={to} className="group flex flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center transition active:scale-95">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-ink shadow-card ring-1 ring-black/[0.04] transition group-hover:bg-brand-600 group-hover:text-white sm:h-16 sm:w-16">
            <Icon size={24} strokeWidth={1.9} />
            {badge ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold text-white ring-2 ring-[#f5f5f6]">
                {badge}
              </span>
            ) : null}
          </span>
          <span className="text-[0.72rem] font-semibold leading-tight text-slate-600 sm:text-xs">{label}</span>
        </Link>
      ))}
    </div>
  );
}
