import { useRef } from "react";

const MAX_TILT_DEGREES = 7;

// A card that leans towards the pointer in 3D. On touch screens it simply stays flat.
export default function TiltCard({ className = "", children }) {
  const card = useRef(null);

  const handleMove = (event) => {
    if (event.pointerType !== "mouse" || !card.current) return;
    const box = card.current.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    card.current.style.transform = `rotateY(${(x * 2 * MAX_TILT_DEGREES).toFixed(2)}deg) rotateX(${(-y * 2 * MAX_TILT_DEGREES).toFixed(2)}deg)`;
  };

  const reset = () => {
    if (card.current) card.current.style.transform = "";
  };

  return (
    <div className="scene-3d h-full">
      <div ref={card} onPointerMove={handleMove} onPointerLeave={reset} className={`tilt-3d h-full ${className}`}>
        {children}
      </div>
    </div>
  );
}
