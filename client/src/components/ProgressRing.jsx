import { useCountUp } from "./AnimatedValue";

// A ring that sweeps round as the household uses its daily allowance; red once it is used up.
export default function ProgressRing({ percent, children, size = 148 }) {
  const target = Math.min(100, Math.max(0, Number(percent) || 0));
  const value = useCountUp(target, 1100);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const angle = (value / 100) * 2 * Math.PI;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f1f3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={target >= 100 ? "#e23744" : "#1c1c1c"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
        {/* A bright bead rides the leading end of the ring. */}
        {value > 1 && value < 100 ? <circle cx={size / 2 + radius * Math.cos(angle)} cy={size / 2 + radius * Math.sin(angle)} r={stroke / 4} fill="#ffffff" /> : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
