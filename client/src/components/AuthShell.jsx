import { Droplets } from "lucide-react";

const points = ["See your usage and daily allowance live", "Get your bill by email every month", "Request extra water in a few taps"];

// Layers of water moving at different speeds along the bottom of the brand panel.
function Waves() {
  const wave = "M0 40 Q 150 0 300 40 T 600 40 T 900 40 T 1200 40 T 1500 40 T 1800 40 T 2100 40 T 2400 40 V 140 H 0 Z";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 overflow-hidden" aria-hidden="true">
      <svg className="tank-wave-slow absolute bottom-0 left-0 h-full w-[200%]" viewBox="0 0 2400 140" preserveAspectRatio="none">
        <path d={wave} fill="#ffffff" fillOpacity="0.1" />
      </svg>
      <svg className="tank-wave absolute -bottom-3 left-0 h-full w-[200%]" viewBox="0 0 2400 140" preserveAspectRatio="none">
        <path d={wave} fill="#ffffff" fillOpacity="0.14" />
      </svg>
    </div>
  );
}

// The brand mark as a coin turning in 3D, with the drop on both faces.
function Emblem({ size = "h-11 w-11", icon = 24 }) {
  return (
    <span className="scene-3d inline-flex">
      <span className={`spin-3d relative ${size}`}>
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white text-brand-600 shadow-lg" style={{ backfaceVisibility: "hidden" }}>
          <Droplets size={icon} />
        </span>
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink text-white shadow-lg" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <Droplets size={icon} />
        </span>
      </span>
    </span>
  );
}

// Shared frame for the signed-out pages: a brand panel beside the form on wide screens,
// a compact brand header above it on phones.
export default function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative hidden overflow-hidden bg-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Emblem />
          <span className="text-lg font-extrabold tracking-tight">Water Distribution</span>
        </div>
        <div className="page-enter relative z-10">
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
        </div>
        <p className="relative z-10 text-sm text-white/70">Smart Automated Rural Water Distribution System</p>
        <Waves />
      </div>

      <div className="flex min-h-screen flex-col bg-white lg:min-h-0 lg:bg-[#f5f5f6]">
        <div className="relative flex items-center gap-3 overflow-hidden bg-brand-600 px-5 pb-12 pt-8 text-white lg:hidden">
          <Emblem size="h-10 w-10" icon={22} />
          <span className="relative z-10 text-lg font-extrabold tracking-tight">Water Distribution</span>
          <Waves />
        </div>

        <div className="relative z-10 -mt-5 flex flex-1 flex-col rounded-t-3xl bg-white px-5 pb-8 pt-7 lg:mt-0 lg:items-center lg:justify-center lg:rounded-none lg:bg-transparent lg:p-10">
          <div className={`page-enter w-full ${wide ? "lg:max-w-2xl" : "lg:max-w-md"}`}>
            <div>
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
    </div>
  );
}
