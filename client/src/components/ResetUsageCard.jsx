import { useState } from "react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import Notice from "./Notice";

const periods = [
  { value: "today", label: "Today", detail: "today's readings" },
  { value: "month", label: "This month", detail: "this month's readings" },
  { value: "all", label: "Everything", detail: "every reading ever recorded" }
];

// Clears recorded meter readings for one household (when `household` is given) or for all of them.
// Used to wipe test runs and sensor noise before real billing starts.
export default function ResetUsageCard({ household = null, onReset }) {
  const [period, setPeriod] = useState("today");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const who = household ? household.name : "every household";
  const chosen = periods.find((item) => item.value === period);

  const reset = async () => {
    if (!window.confirm(`Delete ${chosen.detail} for ${who}? This cannot be undone. Bills already generated are not changed.`)) return;

    try {
      setBusy(true);
      setMessage("");
      setError("");
      const { data } = await api.post("/admin/usage/reset", { period, ...(household ? { user_id: household.id } : {}) });
      setMessage(data.message);
      onReset?.();
    } catch (err) {
      setError(errorMessage(err, "Unable to reset usage."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5 sm:p-6">
      <p className="panel-title">Reset usage</p>
      <p className="mt-1 text-sm text-slate-500">
        Deletes recorded meter readings for {who}, for example after a test run. The controller's own counter follows within a few seconds, so a household that was at its limit can get water again.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {periods.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setPeriod(item.value)}
            className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${period === item.value ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <Notice>{message}</Notice>
        <Notice tone="error">{error}</Notice>
        <button type="button" onClick={reset} disabled={busy} className="btn-danger w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {busy ? "Resetting..." : `Reset ${chosen.label.toLowerCase()} for ${household ? "this household" : "all households"}`}
        </button>
      </div>
    </div>
  );
}
