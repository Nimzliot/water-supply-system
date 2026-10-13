import { useId } from "react";
import { useCountUp } from "./AnimatedValue";

// Geometry of the drawn cylinder, in SVG units.
const LEFT = 30;
const RIGHT = 170;
const CENTER = 100;
const RADIUS_X = 70;
const RADIUS_Y = 16;
const TOP = 34;
const BOTTOM = 250;

// A 3D tank: a glass cylinder that slowly turns from side to side, filled to the measured
// level. Bubbles rise while the pump is filling it, and the two pump levels are ringed on the
// glass: the pump starts below `startLevel` and stops at `stopLevel`.
//
// Its motion follows the hardware: the surface ripples only while water is going in
// (`filling`, the pump reports running) or out (`draining`, the main meter measures flow),
// and with the controller offline the tank is grey and completely still.
export default function TankGauge({ percent, startLevel = 65, stopLevel = 95, offline = false, filling = false, draining = false }) {
  const moving = !offline && (filling || draining);
  const id = useId().replace(/:/g, "");
  const target = Math.min(100, Math.max(0, Number(percent) || 0));
  const level = useCountUp(target, 1200);
  const surface = BOTTOM - (level / 100) * (BOTTOM - TOP);
  const yFor = (value) => BOTTOM - (Math.min(100, Math.max(0, value)) / 100) * (BOTTOM - TOP);

  const waterDark = offline ? "#94a3b8" : "#1d4ed8";
  const waterMid = offline ? "#cbd5e1" : "#3b82f6";
  const waterLight = offline ? "#e2e8f0" : "#93c5fd";

  const ring = (value, label) => {
    const y = yFor(value);
    return (
      <g>
        <path d={`M ${LEFT} ${y} A ${RADIUS_X} ${RADIUS_Y} 0 0 0 ${RIGHT} ${y}`} fill="none" stroke="#0f172a" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="4 4" />
        <line x1={RIGHT} y1={y} x2={RIGHT + 10} y2={y} stroke="#94a3b8" strokeWidth="1.2" />
        <text x={RIGHT + 14} y={y + 4} fontSize="11" fontWeight="700" fill="#94a3b8">{label}</text>
      </g>
    );
  };

  return (
    <div className="scene-3d mx-auto w-52 max-w-full shrink-0 sm:w-56 xl:w-48" role="img" aria-label={`Tank is ${Math.round(target)} percent full`}>
      <div className={offline ? "" : "sway-3d"}>
        <svg viewBox="0 0 222 280" className="block h-auto w-full overflow-visible">
          <defs>
            <linearGradient id={`glass-${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#cbd5e1" stopOpacity="0.55" />
              <stop offset="0.22" stopColor="#f8fafc" stopOpacity="0.9" />
              <stop offset="0.6" stopColor="#f1f5f9" stopOpacity="0.7" />
              <stop offset="1" stopColor="#94a3b8" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id={`water-${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={waterDark} />
              <stop offset="0.3" stopColor={waterMid} />
              <stop offset="0.7" stopColor={waterMid} />
              <stop offset="1" stopColor={waterDark} />
            </linearGradient>
            <clipPath id={`body-${id}`}>
              <path d={`M ${LEFT} ${TOP} L ${LEFT} ${BOTTOM} A ${RADIUS_X} ${RADIUS_Y} 0 0 0 ${RIGHT} ${BOTTOM} L ${RIGHT} ${TOP} A ${RADIUS_X} ${RADIUS_Y} 0 0 0 ${LEFT} ${TOP} Z`} />
            </clipPath>
          </defs>

          {/* Shadow on the ground under the tank. */}
          <ellipse cx={CENTER} cy={BOTTOM + 18} rx={RADIUS_X + 6} ry="7" fill="#0f172a" opacity="0.08" />

          {/* Glass body. */}
          <path
            d={`M ${LEFT} ${TOP} L ${LEFT} ${BOTTOM} A ${RADIUS_X} ${RADIUS_Y} 0 0 0 ${RIGHT} ${BOTTOM} L ${RIGHT} ${TOP} A ${RADIUS_X} ${RADIUS_Y} 0 0 1 ${LEFT} ${TOP} Z`}
            fill={`url(#glass-${id})`}
            stroke="#cbd5e1"
            strokeWidth="2"
          />

          {/* Water volume, clipped to the cylinder. */}
          <g clipPath={`url(#body-${id})`}>
            <path
              d={`M ${LEFT} ${surface} L ${LEFT} ${BOTTOM} A ${RADIUS_X} ${RADIUS_Y} 0 0 0 ${RIGHT} ${BOTTOM} L ${RIGHT} ${surface} A ${RADIUS_X} ${RADIUS_Y} 0 0 1 ${LEFT} ${surface} Z`}
              fill={`url(#water-${id})`}
            />
            {filling && level > 6
              ? [52, 84, 118, 146].map((x, index) => (
                  <circle key={x} className="bubble" cx={x} cy={BOTTOM - 6} r={2.5 + (index % 2)} fill="#ffffff" opacity="0" style={{ animationDelay: `${index * 0.7}s` }} />
                ))
              : null}
          </g>

          {/* Water surface: a lit ellipse with two ripples moving across it. */}
          {level > 0.5 ? (
            <g>
              <ellipse cx={CENTER} cy={surface} rx={RADIUS_X} ry={RADIUS_Y} fill={waterLight} />
              <g clipPath={`url(#body-${id})`}>
                <svg x={LEFT} y={surface - 8} width={RADIUS_X * 2} height="16" viewBox="0 0 140 16" overflow="hidden">
                  <path className={moving ? "tank-wave" : ""} d="M0 8 Q 17 3 35 8 T 70 8 T 105 8 T 140 8 T 175 8 T 210 8 T 245 8 T 280 8" fill="none" stroke="#ffffff" strokeOpacity={moving ? 0.7 : 0.35} strokeWidth="1.4" />
                  {moving ? <path className="tank-wave-slow" d="M0 11 Q 17 7 35 11 T 70 11 T 105 11 T 140 11 T 175 11 T 210 11 T 245 11 T 280 11" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.2" /> : null}
                </svg>
              </g>
            </g>
          ) : null}

          {/* Water pouring in while the pump runs. */}
          {filling ? <line className="pipe-flow" x1={CENTER + 34} y1={TOP - 22} x2={CENTER + 34} y2={Math.max(TOP, surface - 4)} stroke={waterMid} strokeWidth="5" strokeLinecap="round" /> : null}

          {ring(stopLevel, `${Math.round(stopLevel)}%`)}
          {ring(startLevel, `${Math.round(startLevel)}%`)}

          {/* Light catching the glass, and the open rim. */}
          <rect x={LEFT + 12} y={TOP + 6} width="9" height={BOTTOM - TOP - 14} rx="4.5" fill="#ffffff" opacity="0.35" />
          <ellipse cx={CENTER} cy={TOP} rx={RADIUS_X} ry={RADIUS_Y} fill="#ffffff" fillOpacity="0.35" stroke="#cbd5e1" strokeWidth="2" />

          <text x={CENTER} y={(TOP + BOTTOM) / 2 + 6} textAnchor="middle" fontSize="40" fontWeight="800" fill={level > 50 && !offline ? "#ffffff" : "#1c1c1c"} style={{ letterSpacing: "-0.03em" }}>
            {Math.round(level)}%
          </text>
          <text x={CENTER} y={(TOP + BOTTOM) / 2 + 26} textAnchor="middle" fontSize="12" fontWeight="600" fill={level > 42 && !offline ? "#ffffff" : "#64748b"} fillOpacity="0.85">
            {offline ? "last reading" : filling ? "filling" : draining ? "supplying" : "full"}
          </text>
        </svg>
      </div>
    </div>
  );
}
