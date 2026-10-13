import { MIN_FLOW_LPM, flowDuration } from "../lib/useController";

// Drawings of the pump and of a valve that show what the hardware reports, not what was
// commanded. Nothing in here moves unless a reading from the controller says it should.

const WATER = "#3b82f6";
const WATER_STILL = "#bfdbfe";
const PIPE = "#d7dbe2";
const GREEN = "#10b981";
const GREY = "#94a3b8";
const RED = "#e23744";

function Pipe({ d, state, lpm = 0, width = 14 }) {
  // state: "flow" (water moving), "wet" (water present but still), "dry"
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={PIPE} strokeWidth={width} />
      {state !== "dry" ? <path d={d} stroke={WATER_STILL} strokeWidth={width - 5} /> : null}
      {state === "flow" ? <path d={d} stroke={WATER} strokeWidth={width - 5} className="pipe-flow" style={{ animationDuration: flowDuration(lpm) }} /> : null}
    </g>
  );
}

// The borewell pump lifting water into the overhead tank.
//   running   - the impeller turns and water moves up the pipe into the tank
//   stopped   - still
//   lockedOut - dry-run protection tripped: the housing turns red and pulses
//   offline   - grey and still, because the real state is not known
export function PumpVisual({ online, running, lockedOut, sensorFault, tankPercent, stopLevel, startLevel }) {
  const level = Math.min(100, Math.max(0, Number(tankPercent) || 0));
  const tankTop = 28;
  const tankHeight = 120;
  const fill = (level / 100) * tankHeight;
  const accent = !online ? GREY : lockedOut ? RED : running ? GREEN : GREY;
  const levelLine = (value) => tankTop + tankHeight - (Math.min(100, Math.max(0, value)) / 100) * tankHeight;

  return (
    <svg viewBox="0 0 520 230" className="block h-auto w-full" role="img" aria-label={online ? `Pump ${running ? "running" : "stopped"}, tank ${Math.round(level)} percent` : "Controller offline"}>
      {/* Ground and the borewell under it. */}
      <rect x="0" y="182" width="520" height="48" fill="#f1f5f9" />
      <line x1="0" y1="182" x2="520" y2="182" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="92" y="182" width="36" height="48" fill="#e2e8f0" />
      <rect x="92" y={online ? 200 : 214} width="36" height="30" fill={online ? WATER_STILL : "#e2e8f0"} />
      <text x="136" y="208" fontSize="11" fontWeight="700" fill="#64748b">Borewell</text>

      {/* Suction pipe up from the borewell, then the delivery pipe over to the tank. */}
      <Pipe d="M110 214 V140" state={online && running ? "flow" : online ? "wet" : "dry"} lpm={12} />
      <Pipe d="M110 96 V56 H352 V72" state={online && running ? "flow" : "dry"} lpm={12} />

      {/* Pump housing with its impeller. */}
      <g transform="translate(110 118)">
        {lockedOut && online ? <circle className="pulse-ring" r="30" fill={RED} /> : null}
        <circle r="30" fill="#ffffff" stroke={accent} strokeWidth="4" />
        <g className={online && running ? "impeller" : ""}>
          {[0, 90, 180, 270].map((angle) => (
            <path key={angle} d="M0 0 C 6 -11 17 -14 20 -4 C 14 -6 8 -3 0 0 Z" fill={accent} transform={`rotate(${angle})`} />
          ))}
          <circle r="5" fill={accent} />
        </g>
      </g>
      <text x="158" y="114" fontSize="13" fontWeight="800" fill="#1c1c1c">Pump</text>
      <text x="158" y="131" fontSize="12" fontWeight="700" fill={accent === GREY ? "#64748b" : accent}>
        {!online ? "Offline" : lockedOut ? "Locked out" : running ? "Running" : "Stopped"}
      </text>

      {/* Overhead tank with the real level and the two pump levels. */}
      <g>
        <rect x="290" y={tankTop} width="124" height={tankHeight} rx="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
        <clipPath id="pump-visual-tank">
          <rect x="292" y={tankTop + 2} width="120" height={tankHeight - 4} rx="10" />
        </clipPath>
        <g clipPath="url(#pump-visual-tank)">
          <rect x="292" y={tankTop + tankHeight - fill} width="120" height={fill} fill={online && !sensorFault ? WATER : "#cbd5e1"} style={{ transition: "y 0.9s ease, height 0.9s ease" }} />
          {online && running && !sensorFault ? (
            <>
              <svg x="292" y={tankTop + tankHeight - fill - 4} width="120" height="8" viewBox="0 0 120 8" overflow="hidden">
                <path className="tank-wave" d="M0 4 Q 15 0 30 4 T 60 4 T 90 4 T 120 4 T 150 4 T 180 4 T 210 4 T 240 4 V 8 H 0 Z" fill={WATER} />
              </svg>
              {[316, 344, 372, 394].map((x, index) => (
                <circle key={x} className="bubble" cx={x} cy={tankTop + tankHeight - 8} r={2.5} fill="#ffffff" opacity="0" style={{ animationDelay: `${index * 0.6}s` }} />
              ))}
            </>
          ) : null}
        </g>
        {[stopLevel, startLevel].map((value) => (
          <g key={value}>
            <line x1="414" y1={levelLine(value)} x2="428" y2={levelLine(value)} stroke="#94a3b8" strokeWidth="1.5" />
            <text x="432" y={levelLine(value) + 4} fontSize="11" fontWeight="700" fill="#94a3b8">{Math.round(value)}%</text>
          </g>
        ))}
        <text x="352" y={tankTop + tankHeight / 2 + 8} textAnchor="middle" fontSize="24" fontWeight="800" fill={level > 55 && online && !sensorFault ? "#ffffff" : "#1c1c1c"}>
          {sensorFault && online ? "?" : `${Math.round(level)}%`}
        </text>
        <text x="352" y={tankTop + tankHeight + 20} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1c1c1c">Overhead tank</text>
        <rect x="336" y={tankTop + tankHeight} width="32" height="34" fill="none" />
        <line x1="306" y1={tankTop + tankHeight + 28} x2="306" y2="182" stroke="#cbd5e1" strokeWidth="4" />
        <line x1="398" y1={tankTop + tankHeight + 28} x2="398" y2="182" stroke="#cbd5e1" strokeWidth="4" />
      </g>
    </svg>
  );
}

// One valve on its pipe.
//   relayOpen  - what the controller says the relay is doing (null when unknown)
//   upstream   - whether there is water behind the valve to let through
//   flowLpm    - the flow the meter after this valve is measuring
// The gate lifts and the handwheel turns with the relay. Water is drawn moving through
// only when the meter measures flow; an open valve with no measured flow is drawn open but still.
export function ValveVisual({ relayOpen, upstream, flowLpm = 0, label }) {
  const known = relayOpen !== null && relayOpen !== undefined;
  const open = Boolean(relayOpen);
  const flowing = known && open && upstream && flowLpm > MIN_FLOW_LPM;
  const accent = !known ? GREY : open ? GREEN : GREY;

  return (
    <svg viewBox="0 0 300 118" className="block h-auto w-full" role="img" aria-label={`${label}: ${!known ? "state unknown" : open ? "open" : "closed"}${flowing ? `, ${flowLpm.toFixed(1)} liters per minute` : ""}`}>
      {/* Upstream side holds water whenever there is supply behind the valve. */}
      <Pipe d="M8 72 H128" state={known && upstream ? (flowing ? "flow" : "wet") : "dry"} lpm={flowLpm} width={22} />
      {/* Downstream side only carries water once the valve is open. */}
      <Pipe d="M172 72 H292" state={flowing ? "flow" : known && open && upstream ? "wet" : "dry"} lpm={flowLpm} width={22} />

      {/* Valve body, with the gate that lifts out of the way when open. */}
      <rect x="124" y="52" width="52" height="40" rx="8" fill="#ffffff" stroke={accent} strokeWidth="3.5" />
      <rect x="143" y="56" width="14" height="32" rx="3" fill={accent} style={{ transform: `translateY(${known && open ? -30 : 0}px)`, transition: "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />

      {/* Stem and handwheel. The wheel turns a quarter as the valve opens or closes. */}
      <rect x="147" y="26" width="6" height="28" fill={accent} />
      <g style={{ transform: `rotate(${known && open ? 90 : 0}deg)`, transformOrigin: "150px 22px", transition: "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        <circle cx="150" cy="22" r="15" fill="#ffffff" stroke={accent} strokeWidth="3.5" />
        <line x1="137" y1="22" x2="163" y2="22" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="150" cy="22" r="3" fill={accent} />
      </g>

      <text x="150" y="112" textAnchor="middle" fontSize="12" fontWeight="800" fill={flowing ? WATER : "#64748b"}>
        {!known ? "State not reported" : flowing ? `${flowLpm.toFixed(1)} L/min flowing` : open ? (upstream ? "Open, no flow measured" : "Open, no supply behind it") : "Closed"}
      </text>
    </svg>
  );
}
