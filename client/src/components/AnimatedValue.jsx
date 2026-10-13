import { useEffect, useRef, useState } from "react";

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Counts from the number shown before to the new one, so a live update is seen to change.
export function useCountUp(target, duration = 800) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (reduceMotion()) {
      from.current = end;
      setDisplay(end);
      return undefined;
    }

    const start = from.current;
    const startedAt = performance.now();
    let frame;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = start + (end - start) * eased;
      from.current = value;
      setDisplay(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}

function Counted({ prefix, number, decimals, suffix }) {
  const value = useCountUp(number);
  return (
    <>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </>
  );
}

// Animates text that holds exactly one number ("82%", "Rs. 236.80", "6.4 L/min").
// Anything else ("2 of 3", "Online", a time of day) is shown as it is.
export default function AnimatedValue({ children }) {
  const text = typeof children === "number" ? String(children) : children;
  const match = typeof text === "string" ? text.match(/^(\D*?)(\d+(?:\.\d+)?)(\D*)$/) : null;

  if (!match) return <>{children}</>;

  const [, prefix, number, suffix] = match;
  const decimals = number.includes(".") ? number.split(".")[1].length : 0;
  return <Counted prefix={prefix} number={Number(number)} decimals={decimals} suffix={suffix} />;
}
