import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import ControlModeCard from "../../components/ControlModeCard";
import Notice from "../../components/Notice";

// Which field of the controller's heartbeat reports each valve's relay.
const relayField = {
  "Main Distribution Valve": "main_valve_open",
  "House 1 Intake Valve": "house1_valve_open",
  "House 2 Intake Valve": "house2_valve_open"
};

export default function ValveControlPage() {
  const [system, setSystem] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system));
  useLive(load, ["system:update", "device:update"], 15000);

  const toggleValve = async (valve) => {
    try {
      setBusy(valve.valve_name);
      setError("");
      await api.post("/admin/valves", { valve_name: valve.valve_name, status: !valve.status });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to switch the valve."));
    } finally {
      setBusy("");
    }
  };

  const manual = system?.control_mode === "manual";
  const controller = system?.controller;
  const meta = controller?.is_online ? controller.meta || {} : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Valve Control"
        description={
          manual
            ? "Manual mode: each valve opens or closes as soon as you switch it."
            : "Automatic mode: a switched-on valve is opened by the controller during its supply cycle. Use Manual mode to operate valves directly."
        }
      />
      <ControlModeCard system={system} onChange={setSystem} />
      <Notice tone="error">{error}</Notice>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {system?.valves?.map((valve) => {
          const field = relayField[valve.valve_name];
          const relayKnown = meta && field && meta[field] !== undefined;
          const relayOpen = relayKnown ? Boolean(meta[field]) : null;

          return (
            <div key={valve.id} className="panel p-4 sm:p-5">
              <p className="text-sm font-semibold text-ink">{valve.valve_name}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Dashboard switch</dt>
                  <dd><StatusPill color={valve.status ? "green" : "slate"}>{valve.status ? (manual ? "Open" : "Enabled") : manual ? "Closed" : "Disabled"}</StatusPill></dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Valve right now</dt>
                  <dd>
                    {relayOpen === null ? (
                      <StatusPill color="slate">{!field ? "Not wired" : meta ? "Not reported yet" : "Controller offline"}</StatusPill>
                    ) : (
                      <StatusPill color={relayOpen ? "green" : "slate"} dot>{relayOpen ? "Open" : "Closed"}</StatusPill>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-400">Switched {formatDateTime(valve.timestamp)}</p>
              <button
                onClick={() => toggleValve(valve)}
                disabled={busy === valve.valve_name}
                className={`${valve.status ? "btn-secondary" : "btn-primary"} mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {busy === valve.valve_name ? "Sending..." : valve.status ? (manual ? "Close valve" : "Disable valve") : manual ? "Open valve" : "Enable valve"}
              </button>
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
