import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import BlessonChat from "./BlessonChat";

// The Blesson AI bubble in the corner of every page. It opens the same chat as the Blesson AI
// page: full screen on a phone, a floating panel on a computer.
export default function BlessonWidget({ scope }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      {open ? (
        <div className="pop-in fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100vh-8rem))] sm:w-[400px] sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl sm:ring-1 sm:ring-slate-200 print:hidden">
          <BlessonChat scope={scope} variant="widget" onClose={() => setOpen(false)} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`fixed bottom-[5.5rem] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-brand-500 to-rose-700 pl-4 pr-5 text-sm font-extrabold text-white shadow-lg shadow-brand-600/30 transition hover:scale-105 lg:bottom-6 lg:right-6 print:hidden ${open ? "hidden sm:flex" : ""}`}
        aria-label={open ? "Close Blesson AI" : "Open Blesson AI"}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
        <span className="hidden sm:inline">{open ? "Close" : "Blesson AI"}</span>
      </button>
    </>
  );
}
