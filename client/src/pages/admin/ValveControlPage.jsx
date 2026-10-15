import { useState } from "react";
import api from "../../lib/api";
import { MIN_FLOW_LPM, useController } from "../../lib/useController";
import { errorMessage, formatDateTime, formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import ControlModeCard from "../../components/ControlModeCard";
import Notice from "../../components/Notice";
import { ValveVisual } from "../../components/LiveVisuals";

// For each valve: the heartbeat field that reports its relay, and which flow meter sits after it.
const wiring = {
  "Main Distribution Valve": { relay: "main_valve_open", flow: "main" },
  "House 1 Intake Valve": { relay: "house1_valve_open", flow: "house1", house: 0 },
  "House 2 Intake Valve": { relay: "house2_valve_open", flow: "house2", house: 1 }
};

export default function ValveControlPage() {
  const { system, setSystem, reload, live } = useController();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const toggleValve = async (valve) => {
    try {
      setBusy(valve.valve_name);
      setError("");
      await api.post("/admin/valves", { valve_name: valve.valve_name, status: !valve.status });
      await reload();
    } catch (err) {
      setError(errorMessage(err, "Unable to switch the valve."));
    } finally {
      setBusy("");
    }
  };

  const { online, meta, flows, houses, tankPercent, controller } = live;
  const manual = system?.control_mode === "manual";
  const mainOpen = Boolean(meta?.main_valve_open);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Valve Control"
        description="Each drawing follows the real valve: it opens when the relay opens, and water is shown moving only when the meter after it measures flow."
        actions={
          <StatusPill color={online ? "green" : "rose"} dot>
            {online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}
          </StatusPill>
        }
      />
      <ControlModeCard system={system} onChange={setSystem} />
      <Notice tone="error">{error}</Notice>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {system?.valves?.map((valve) => {
          const wire = wiring[valve.valve_name];
          const relayKnown = Boolean(meta && wire && meta[wire.relay] !== undefined);
          const relayOpen = relayKnown ? Boolean(meta[wire.relay]) : null;
          const flow = wire ? flows[wire.flow] : 0;
          const house = wire?.house !== undefined ? houses[wire.house] : null;
          // Water is behind the main valve when the tank holds some, and behind a house valve when the main valve is open.
          const upstream = wire?.flow === "main" ? tankPercent > 1 : mainOpen;

          // What the switch and the real valve say when they disagree.
          let note = "";
          if (!wire) note = "This valve is not wired to a relay on the controller.";
          else if (!online) note = "The controller is offline. The switch is saved and applied when it reconnects.";
          else if (!relayKnown) note = "The controller has not reported this valve yet.";
          else if (!manual) {
            // Automatic: the controller opens and closes the valve itself.
            if (!relayOpen) {
              if (house?.limitReached) note = "Closed: this household has reached today's limit.";
              else if (meta.leak_detected) note = "Closed: a leak was detected.";
              else note = `Closed for now. ${meta.supply_status || "The controller opens it during supply."}`;
            }
          } else if (valve.status && !relayOpen) {
            if (meta.leak_detected) note = "Held closed: a leak was detected.";
            else note = "Opening: waiting for the controller to pick up the switch.";
          } else if (!valve.status && relayOpen) note = "Closing: waiting for the controller to pick up the switch.";
          else if (relayOpen && upstream && flow <= MIN_FLOW_LPM) note = "The valve is open but the meter measures no flow. Nobody may be drawing water.";

          return (
            <div key={valve.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{valve.valve_name}</p>
                  {house ? <p className="text-xs text-slate-500">{house.label}{house.litersToday !== null ? ` · ${house.litersToday.toFixed(1)} L today` : ""}</p> : null}
                </div>
                {relayOpen === null ? (
                  <StatusPill color="slate">{!wire ? "Not wired" : online ? "Not reported" : "Unknown"}</StatusPill>
                ) : (
                  <StatusPill color={relayOpen ? "green" : "slate"} dot>{relayOpen ? "Open" : "Closed"}</StatusPill>
                )}
              </div>

              <div className="mt-3">
                <ValveVisual label={valve.valve_name} relayOpen={relayOpen} upstream={online && upstream} flowLpm={flow} />
              </div>

              {note ? <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">{note}</p> : null}

              {manual ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="min-w-0 text-xs text-slate-500">
                    Switch is <b className="text-ink">{valve.status ? "on" : "off"}</b>
                    <span className="hidden sm:inline"> · set {formatDateTime(valve.timestamp)}</span>
                  </p>
                  <button
                    onClick={() => toggleValve(valve)}
                    disabled={busy === valve.valve_name}
                    className={`${valve.status ? "btn-secondary" : "btn-primary"} shrink-0 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {busy === valve.valve_name ? "Sending..." : valve.status ? "Close valve" : "Open valve"}
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Automatic: the controller opens this valve by itself. Switch to Manual to open or close it by hand.</p>
              )}
            </div>
          );
        })}
        {system && !system.valves?.length ? (
          <p className="panel p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            No valves are set up yet. Run the database migrations to add the main and household valves.
          </p>
        ) : null}
      </div>
    </div>
  );
}
