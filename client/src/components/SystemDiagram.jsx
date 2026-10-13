import { MIN_FLOW_LPM, flowDuration } from "../lib/useController";

// A live drawing of the whole system: borewell pump, overhead tank, main valve, and the two
// houses. Every moving part follows a reading from the hardware:
//   - the pump's impeller turns, and water climbs to the tank, only while the pump reports running
//   - a valve's handle follows its relay
//   - water moves along a pipe only while the flow meter on it measures flow, faster for more flow
//   - a pipe that is open but has no measured flow is drawn holding still water
// With the controller offline nothing moves.
const WATER = "#3b82f6";
const WATER_STILL = "#bfdbfe";
const PIPE = "#d7dbe2";

function Pipe({ d, state, lpm = 0 }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={PIPE} strokeWidth="9" />
      {state !== "dry" ? <path d={d} stroke={WATER_STILL} strokeWidth="5" /> : null}
      {state === "flow" ? <path d={d} stroke={WATER} strokeWidth="5" className="pipe-flow" style={{ animationDuration: flowDuration(lpm) }} /> : null}
    </g>
  );
}

function Valve({ x, y, open, known, label, labelY = -16 }) {
  const colour = known && open ? "#10b981" : "#94a3b8";
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="13" fill="#ffffff" stroke={colour} strokeWidth="2.5" />
      {/* The handle lies along the pipe when open and across it when closed. */}
      <rect x="-8" y="-2" width="16" height="4" rx="2" fill={colour} style={{ transform: `rotate(${known && open ? 0 : 90}deg)`, transition: "transform 0.5s ease" }} />
      <text y={labelY} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#64748b">{label}</text>
    </g>
  );
}

function House({ x, y, label, flowing, detail }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-26 0 L0 -22 L26 0 V28 H-26 Z" fill="#ffffff" stroke={flowing ? WATER : "#cbd5e1"} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="-7" y="10" width="14" height="18" rx="2" fill={flowing ? WATER : "#e2e8f0"} />
      {flowing ? <circle className="pulse-ring" cx="0" cy="-2" r="6" fill={WATER} /> : null}
      <text y="46" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#1c1c1c">{label}</text>
      <text y="60" textAnchor="middle" fontSize="10" fontWeight="600" fill={flowing ? WATER : "#64748b"}>{detail}</text>
    </g>
  );
}

export default function SystemDiagram({ meta, tankPercent = 0, flows = {}, houses = [] }) {
  const online = Boolean(meta);
  const pumpOn = Boolean(meta?.pump_status);
  const mainOpen = Boolean(meta?.main_valve_open);
  const house1Open = mainOpen && Boolean(meta?.house1_valve_open);
  const house2Open = mainOpen && Boolean(meta?.house2_valve_open);

  const mainFlow = online ? Number(flows.main || 0) : 0;
  const house1Flow = online ? Number(flows.house1 || 0) : 0;
  const house2Flow = online ? Number(flows.house2 || 0) : 0;
  // "flow" needs the valve open and the meter measuring; open without measured flow is "wet".
  const pipeState = (open, lpm) => (!open ? "dry" : lpm > MIN_FLOW_LPM ? "flow" : "wet");

  const level = Math.min(100, Math.max(0, Number(tankPercent) || 0));
  const tankHeight = 86;
  const fill = (level / 100) * tankHeight;
  const waterMoving = online && (pumpOn || mainFlow > MIN_FLOW_LPM);
  const houseDetail = (house, open, lpm) => {
    if (!online) return "";
    if (lpm > MIN_FLOW_LPM && open) return `${lpm.toFixed(1)} L/min`;
    return house?.limitReached ? "Limit reached" : open ? "No flow" : "Closed";
  };

  return (
    <svg viewBox="0 0 560 250" className="block h-auto w-full" role="img" aria-label="Live diagram of the pump, tank, valves and houses">
      {/* Pump to tank. There is no meter on this pipe, so it follows the pump itself. */}
      <Pipe d="M70 176 V60 H190" state={pumpOn ? "flow" : "dry"} lpm={12} />
      {/* Tank to main valve, then on to each house. */}
      <Pipe d="M250 120 V176 H330" state={online && level > 1 ? (mainOpen && mainFlow > MIN_FLOW_LPM ? "flow" : "wet") : "dry"} lpm={mainFlow} />
      <Pipe d="M330 176 H390 V92 H470" state={pipeState(house1Open, house1Flow)} lpm={house1Flow} />
      <Pipe d="M390 176 V206 H470" state={pipeState(house2Open, house2Flow)} lpm={house2Flow} />

      {/* Borewell pump. */}
      <g transform="translate(70 196)">
        <circle r="24" fill="#ffffff" stroke={pumpOn ? "#10b981" : "#cbd5e1"} strokeWidth="2.5" />
        <g className={pumpOn ? "impeller" : ""}>
          {[0, 120, 240].map((angle) => (
            <path key={angle} d="M0 0 C 4 -8 12 -10 14 -3 C 10 -4 6 -2 0 0 Z" fill={pumpOn ? "#10b981" : "#94a3b8"} transform={`rotate(${angle})`} />
          ))}
          <circle r="3.5" fill={pumpOn ? "#10b981" : "#94a3b8"} />
        </g>
        <text y="42" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#1c1c1c">Pump</text>
        <text y="55" textAnchor="middle" fontSize="10" fontWeight="600" fill={pumpOn ? "#059669" : "#64748b"}>{online ? (pumpOn ? "Running" : "Stopped") : "Offline"}</text>
      </g>

      {/* Overhead tank. Its surface ripples only while water is going in or out. */}
      <g transform="translate(190 30)">
        <rect width="120" height={tankHeight + 4} rx="14" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2.5" />
        <clipPath id="diagram-tank">
          <rect x="2" y="2" width="116" height={tankHeight} rx="12" />
        </clipPath>
        <g clipPath="url(#diagram-tank)">
          <rect x="2" y={2 + tankHeight - fill} width="116" height={fill} fill={online ? WATER : "#cbd5e1"} style={{ transition: "y 0.8s ease, height 0.8s ease" }} />
          {waterMoving && level > 2 && level < 98 ? (
            <svg x="2" y={tankHeight - fill - 4} width="116" height="8" viewBox="0 0 116 8" overflow="hidden">
              <path className="tank-wave" d="M0 4 Q 14.5 0 29 4 T 58 4 T 87 4 T 116 4 T 145 4 T 174 4 T 203 4 T 232 4 V 8 H 0 Z" fill={WATER} />
            </svg>
          ) : null}
        </g>
        <text x="60" y="52" textAnchor="middle" fontSize="20" fontWeight="800" fill={level > 55 && online ? "#ffffff" : "#1c1c1c"}>{Math.round(level)}%</text>
        <text x="60" y="-8" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#1c1c1c">Overhead tank</text>
      </g>

      <Valve x={330} y={176} known={online} open={mainOpen} label="Main valve" labelY={30} />
      <Valve x={430} y={92} known={online} open={Boolean(meta?.house1_valve_open)} label="Valve 1" />
      <Valve x={430} y={206} known={online} open={Boolean(meta?.house2_valve_open)} label="Valve 2" labelY={30} />

      <House x={505} y={86} label={houses[0]?.label || "House 1"} detail={houseDetail(houses[0], house1Open, house1Flow)} flowing={house1Open && house1Flow > MIN_FLOW_LPM} />
      <House x={505} y={184} label={houses[1]?.label || "House 2"} detail={houseDetail(houses[1], house2Open, house2Flow)} flowing={house2Open && house2Flow > MIN_FLOW_LPM} />
    </svg>
  );
}
