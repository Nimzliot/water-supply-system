import { Droplets } from "lucide-react";

const points = ["See your usage and daily allowance live", "Get your bill by email every month", "Request extra water in a few taps"];

// Shared frame for the signed-out pages: a brand panel beside the form on wide screens,
// a compact brand header above it on phones.
export default function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="hidden bg-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-600">
            <Droplets size={24} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Water Distribution</span>
        </div>
        <div>
          <p className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Fair water for every household, every day.</p>
          <ul className="mt-8 space-y-3 text-base font-medium text-white/90">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">Smart Automated Rural Water Distribution System</p>
      </div>

      <div className="flex min-h-screen flex-col bg-white lg:min-h-0 lg:bg-[#f5f5f6]">
        <div className="flex items-center gap-3 bg-brand-600 px-5 pb-10 pt-8 text-white lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-600">
            <Droplets size={22} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Water Distribution</span>
        </div>

        <div className="-mt-5 flex flex-1 flex-col rounded-t-3xl bg-white px-5 pb-8 pt-7 lg:mt-0 lg:items-center lg:justify-center lg:rounded-none lg:bg-transparent lg:p-10">
          <div className={`w-full ${wide ? "lg:max-w-2xl" : "lg:max-w-md"}`}>
            <div className="lg:rounded-2xl lg:bg-white lg:p-9 lg:shadow-card">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
              {subtitle ? <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p> : null}
              <div className="mt-6">{children}</div>
            </div>
            {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
