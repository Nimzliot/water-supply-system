import { MIN_FLOW_LPM, useController } from "../../lib/useController";
import { formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import TankGauge from "../../components/TankGauge";

export default function TankMonitoringPage() {
  const { system, live } = useController();
  const { online, meta, pumpRunning, flows, controller } = live;

  const level = Math.min(100, Math.max(0, live.tankPercent));
  const height = Number(meta?.water_level_cm ?? system?.water_level ?? 0);
  const start = system?.pump_on_threshold ?? 65;
  const stop = system?.pump_off_threshold ?? 95;
  const draining = flows.main > MIN_FLOW_LPM;

  let phase = "The tank is between the two levels. The pump stays as it is.";
  if (!online) phase = "The controller is offline. This is the last level it reported.";
  else if (meta.sensor_fault) phase = "The level sensor is not reading, so the pump and valves are held off.";
  else if (pumpRunning) phase = `Filling: the pump runs until the tank reaches ${stop}%. Supply waits while it refills.`;
  else if (draining) phase = `Supplying: ${flows.main.toFixed(1)} L/min is leaving the tank. The pump starts when the level falls below ${start}%.`;
  else if (level >= stop) phase = `Full: the pump is off and supply to households can run.`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Tank Monitoring"
        description="The tank is drawn at its real level. Its surface moves only while water is going in or out."
        actions={<StatusPill color={online ? "green" : "rose"} dot>{online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}</StatusPill>}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="panel flex flex-col items-center gap-4 p-5 sm:p-6 lg:col-span-5">
          <TankGauge percent={level} startLevel={start} stopLevel={stop} offline={!online} filling={pumpRunning} draining={draining} />
          <p className="text-center text-sm font-medium text-slate-600">{phase}</p>
        </div>

        <div className="space-y-4 lg:col-span-7 lg:space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard label="Tank level" value={`${level.toFixed(0)}%`} hint={online ? "Live from the controller" : "Last reading received"} />
            <StatCard label="Water height" value={`${height.toFixed(1)} cm`} hint="Ultrasonic sensor" />
            <StatCard label="Pump" value={online ? (pumpRunning ? "Running" : "Stopped") : "--"} hint={`Mode: ${system?.pump_mode || "auto"}`} />
            <StatCard label="Leaving the tank" value={online ? `${flows.main.toFixed(1)} L/min` : "--"} hint={online ? meta.supply_status || "Main flow meter" : "Controller offline"} />
          </div>

          <div className="panel p-5 sm:p-6">
            <p className="panel-title">How the tank is managed</p>
            <ol className="mt-3 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">1</span>
                <span>When the level falls below <b className="text-ink">{start}%</b>, the pump starts and supply to households pauses.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">2</span>
                <span>The pump runs until the tank reaches <b className="text-ink">{stop}%</b>, then stops.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">3</span>
                <span>With the tank full, supply turns on and continues until the level is back below {start}%.</span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">Change the two levels in Settings. Use Pump Control or Manual mode to override the pump.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
