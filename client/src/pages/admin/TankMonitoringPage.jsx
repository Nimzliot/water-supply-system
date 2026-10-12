import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import { socket } from "../../lib/socket";

export default function TankMonitoringPage() {
  const [system, setSystem] = useState(null);

  useEffect(() => {
    const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system)).catch(() => {});

    load();
    socket.on("system:update", load);
    return () => socket.off("system:update", load);
  }, []);

  const level = Math.min(100, Math.max(0, Number(system?.tank_percentage ?? 0)));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Tank Monitoring"
        description="Overhead tank level and the thresholds that drive the pump."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Tank level" value={`${level}%`} hint="Latest reading from the controller" />
        <StatCard label="Water height" value={`${system?.water_level ?? 0} cm`} hint="Ultrasonic sensor" />
        <StatCard label="Pump" value={system?.pump_status ? "Running" : "Stopped"} hint={`Mode: ${system?.pump_mode || "auto"}`} />
      </div>
      <div className="panel p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="panel-title">Level against pump thresholds</p>
          <p className="text-sm tabular-nums text-slate-500">{level}%</p>
        </div>
        <div className="relative mt-4 h-3 rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-brand-600 transition-all" style={{ width: `${level}%` }} />
          <span className="absolute -top-1 h-5 w-px bg-slate-400" style={{ left: "75%" }} />
          <span className="absolute -top-1 h-5 w-px bg-slate-400" style={{ left: "95%" }} />
        </div>
        <div className="relative mt-2 h-4 text-xs text-slate-500">
          <span className="absolute -translate-x-1/2" style={{ left: "75%" }}>75%</span>
          <span className="absolute -translate-x-1/2" style={{ left: "95%" }}>95%</span>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          In automatic mode the pump starts below 75% and stops at 95%. Supply to households pauses while the tank refills.
        </p>
      </div>
    </div>
  );
}

