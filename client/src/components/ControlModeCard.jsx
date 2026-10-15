import { useState } from "react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import StatusPill from "./StatusPill";
import Notice from "./Notice";

const modes = {
  auto: {
    label: "Automatic",
    detail: "The controller runs the supply cycle itself: it follows the schedules, keeps the tank filled, and closes a house when it reaches its daily limit. It opens the valves by itself once the tank is full; the valve switches are not used."
  },
  manual: {
    label: "Manual",
    detail: "The pump and every valve follow the switches on this dashboard immediately. Schedules and daily limits are not applied. Leak, overflow, and dry-run protection still are."
  }
};

// Shows who is in control (the automatic cycle or the dashboard switches), lets the admin
// change it, and reports what the controller says it is doing right now.
export default function ControlModeCard({ system, onChange }) {
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const mode = system?.control_mode === "manual" ? "manual" : "auto";
  const controller = system?.controller;
  const online = Boolean(controller?.is_online);
  const applied = online && controller.meta?.control_mode ? controller.meta.control_mode === mode : null;

  const setMode = async (next) => {
    try {
      setSaving(next);
      setError("");
      const { data } = await api.post("/admin/control-mode", { mode: next });
      onChange?.(data.system);
    } catch (err) {
      setError(errorMessage(err, "Unable to change the control mode."));
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p className="panel-title">Control mode</p>
          <StatusPill color={mode === "manual" ? "amber" : "blue"}>{modes[mode].label}</StatusPill>
          {applied === false ? <StatusPill color="slate">Sending to controller...</StatusPill> : null}
        </div>
        <div className="flex gap-2">
          {Object.entries(modes).map(([key, value]) => (
            <button
              key={key}
              type="button"
              disabled={Boolean(saving) || mode === key}
              onClick={() => setMode(key)}
              className={`${mode === key ? "btn-primary" : "btn-secondary"} flex-1 disabled:cursor-default sm:flex-none ${mode === key ? "" : "disabled:opacity-60"}`}
            >
              {saving === key ? "Switching..." : value.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-500">{modes[mode].detail}</p>

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
        {online ? (
          <p className="text-slate-700">
            <span className="font-medium text-ink">Controller says:</span> {controller.meta?.supply_status || "Running"}
          </p>
        ) : (
          <p className="text-red-700">The controller is offline. Changes are saved and applied when it reconnects.</p>
        )}
      </div>

      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}
