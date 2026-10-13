import { Activity, AlertTriangle, CalendarClock, CircleGauge, Droplets, FlaskConical, Home, Receipt, Signal, ToggleRight, Users, Waves, Zap } from "lucide-react";

import AnimatedValue from "./AnimatedValue";

// Values stay neutral; colour is reserved for states that need attention.
const tones = {
  "text-alert": "text-red-600",
  "text-red-600": "text-red-600",
  "text-emerald-600": "text-emerald-600"
};

// The icon is picked from the label, so every page gets one without having to pass it.
const iconRules = [
  [/leak|alert|dry-run|fault/i, AlertTriangle],
  [/pump|command/i, Zap],
  [/valve/i, ToggleRight],
  [/tank|height|level/i, Waves],
  [/quality/i, FlaskConical],
  [/bill|amount|tariff/i, Receipt],
  [/wi-fi|signal/i, Signal],
  [/household|family|person|allowance|limit/i, Users],
  [/meter|device|controller|cycle/i, CircleGauge],
  [/reading|hour|last/i, CalendarClock],
  [/home/i, Home],
  [/flow|supply|used|water|usage/i, Droplets]
];

function iconFor(label) {
  const match = iconRules.find(([pattern]) => pattern.test(String(label)));
  return match ? match[1] : Activity;
}

export default function StatCard({ label, value, hint, accent, icon }) {
  const Icon = icon || iconFor(label);
  const alert = Boolean(tones[accent]) && accent !== "text-emerald-600";

  return (
    <div className="panel panel-lift p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${alert ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
          <Icon size={18} />
        </span>
        <p className="min-w-0 text-xs font-semibold leading-tight text-slate-500 sm:text-sm">{label}</p>
      </div>
      <div className={`mt-3 break-words text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl ${tones[accent] || "text-ink"}`}>
        <AnimatedValue>{value}</AnimatedValue>
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500 sm:text-sm">{hint}</p> : null}
    </div>
  );
}
