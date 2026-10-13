function partOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Dashboard opening line: a greeting by name, today's date, and any status pills.
export default function Greeting({ name, children }) {
  const firstName = name?.split(/\s+/)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{today}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {partOfDay()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

// Shown in place of a dashboard while its first data loads.
export function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-14 w-64 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="skeleton h-72 lg:col-span-5" />
        <div className="skeleton h-72 lg:col-span-7" />
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}
