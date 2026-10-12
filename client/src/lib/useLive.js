import { useEffect, useRef } from "react";
import { socket } from "./socket";

const MIN_GAP_MS = 1500;

// Runs `load` on mount, again whenever one of the socket `events` arrives, and (optionally)
// on an interval as a fallback for when the socket is down. Bursts of events are collapsed
// into one reload.
export function useLive(load, events = [], intervalMs = 0) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const eventKey = events.join("|");

  useEffect(() => {
    let lastRun = 0;
    let pending = null;

    const run = () => {
      pending = null;
      lastRun = Date.now();
      Promise.resolve(loadRef.current()).catch(() => {});
    };

    const trigger = () => {
      if (pending) return;
      const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRun));
      pending = window.setTimeout(run, wait);
    };

    run();
    const names = eventKey ? eventKey.split("|") : [];
    names.forEach((name) => socket.on(name, trigger));
    const interval = intervalMs ? window.setInterval(trigger, intervalMs) : null;

    return () => {
      names.forEach((name) => socket.off(name, trigger));
      if (interval) window.clearInterval(interval);
      if (pending) window.clearTimeout(pending);
    };
  }, [eventKey, intervalMs]);
}
