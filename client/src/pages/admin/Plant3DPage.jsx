import { useController, MIN_FLOW_LPM } from "../../lib/useController";
import { formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import StatCard from "../../components/StatCard";
import Plant3D from "../../components/three/Plant3D";

// The plant as a 3D model that follows the hardware: drag to turn it, pinch or scroll to zoom.
export default function Plant3DPage() {
  const { live } = useController();
  const { online, meta, flows, tankPercent, pumpRunning, controller } = live;
  const flowing = online && (flows.main > MIN_FLOW_LPM || flows.house1 > MIN_FLOW_LPM || flows.house2 > MIN_FLOW_LPM);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="3D Plant"
        description="A live 3D model of the borewell, pump, tank, valves and houses. Water moves only where the meters measure it."
        actions={<StatusPill color={online ? "green" : "rose"} dot>{online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}</StatusPill>}
      />

      <div className="panel relative isolate overflow-hidden p-0">
        <div className="h-[420px] w-full sm:h-[560px]">
          <Plant3D live={live} />
        </div>
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          Drag to turn · scroll or pinch to zoom
        </div>
        {online && meta?.supply_status ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl bg-white/90 px-3 py-2 text-sm text-ink shadow-sm sm:right-auto">
            <span className="font-semibold text-slate-500">Controller says: </span>
            {meta.supply_status}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Tank" value={online ? (meta?.sensor_fault ? "Sensor fault" : `${Math.round(tankPercent)}%`) : "--"} hint={online ? "Measured by the ultrasonic sensor" : "Controller offline"} />
        <StatCard label="Pump" value={online ? (pumpRunning ? "Running" : "Stopped") : "--"} hint={`Mode ${meta?.pump_mode || "--"}`} />
        <StatCard label="Supply" value={online ? (flowing ? "Flowing" : "No flow") : "--"} hint={online ? `Main meter ${flows.main.toFixed(1)} L/min` : "Controller offline"} />
        <StatCard
          label="Valves open"
          value={online ? [meta?.main_valve_open, meta?.house1_valve_open, meta?.house2_valve_open].filter(Boolean).length + " of 3" : "--"}
          hint="Main, house 1 and house 2"
        />
      </div>
    </div>
  );
}
