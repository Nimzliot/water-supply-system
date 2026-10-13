import { useState } from "react";
import { describeWaterQuality } from "../lib/waterQuality";
import StatusPill from "./StatusPill";

const dot = { good: "bg-emerald-500", acceptable: "bg-amber-500", unsafe: "bg-red-500" };
const word = { good: "text-emerald-600", acceptable: "text-amber-600", unsafe: "text-red-600", unknown: "text-slate-500" };

// Water quality as one word and one sentence, with three plain checks underneath.
// The raw numbers are tucked behind "Show numbers" for anyone calibrating the sensors.
export default function WaterQualityCard({ reading, volts = null, offline = false }) {
  const [showNumbers, setShowNumbers] = useState(false);
  const quality = offline ? null : describeWaterQuality(reading);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="panel-title">Water quality</p>
        {quality ? <StatusPill color={quality.color} dot>{quality.title}</StatusPill> : <StatusPill color="slate">{offline ? "Offline" : "No reading"}</StatusPill>}
      </div>

      {quality ? (
        <>
          <p className={`mt-3 text-3xl font-extrabold tracking-tight ${word[quality.level]}`}>{quality.title}</p>
          <p className="mt-1 text-sm text-slate-600">{quality.sentence}</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {quality.parts.map((part) => (
              <div key={part.name} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{part.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${quality.level === "unknown" ? "bg-slate-300" : dot[part.level]}`} />
                  <span className="min-w-0 leading-tight">{quality.level === "unknown" ? "Unknown" : part.text}</span>
                </p>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setShowNumbers((current) => !current)} className="mt-3 text-xs font-bold text-brand-600 hover:text-brand-700">
            {showNumbers ? "Hide numbers" : "Show numbers"}
          </button>
          {showNumbers ? (
            <dl className="pop-in mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
              <div>
                <dt>pH</dt>
                <dd className="font-bold tabular-nums text-ink">{quality.numbers.ph.toFixed(1)}</dd>
                {volts?.ph !== undefined ? <dd className="tabular-nums">{Number(volts.ph).toFixed(2)} V</dd> : null}
              </div>
              <div>
                <dt>TDS (ppm)</dt>
                <dd className="font-bold tabular-nums text-ink">{Math.round(quality.numbers.tds)}</dd>
                {volts?.tds !== undefined ? <dd className="tabular-nums">{Number(volts.tds).toFixed(2)} V</dd> : null}
              </div>
              <div>
                <dt>Turbidity (NTU)</dt>
                <dd className="font-bold tabular-nums text-ink">{Math.round(quality.numbers.turbidity)}</dd>
                {volts?.turbidity !== undefined ? <dd className="tabular-nums">{Number(volts.turbidity).toFixed(2)} V</dd> : null}
              </div>
            </dl>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{offline ? "The controller is offline, so there is no current reading." : "Waiting for the first reading from the sensors."}</p>
      )}
    </div>
  );
}
