import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

const initialForm = {
  zone_name: "",
  start_time: "06:00",
  end_time: "08:00",
  is_active: true
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const load = () => api.get("/admin/system").then(({ data }) => setSchedules(data.system.schedules || []));
  useLive(load, ["system:update"]);

  const run = async (request) => {
    try {
      setError("");
      await request();
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to save the schedule."));
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (form.zone_name.trim().length < 2) {
      setError("Give the schedule a name.");
      return;
    }
    run(async () => {
      await api.post("/admin/schedules", form);
      setForm(initialForm);
    });
  };

  const remove = (schedule) => {
    if (!window.confirm(`Delete the schedule "${schedule.zone_name}"?`)) return;
    run(() => api.delete(`/admin/schedules/${schedule.id}`));
  };

  const activeCount = (schedules || []).filter((schedule) => schedule.is_active).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Schedules" description="The controller supplies water only during the active windows below, and picks up changes within a few seconds." />
      <Notice tone="error">{error}</Notice>
      {schedules && !activeCount ? (
        <Notice tone="error">No schedule is active, so the controller falls back to its built-in window. Add or activate a schedule to control supply times.</Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submit} className="panel space-y-4 p-4 sm:p-5">
          <p className="panel-title">Add a supply window</p>
          <div>
            <label htmlFor="zone_name" className="field-label">Name</label>
            <input id="zone_name" className="input" placeholder="Morning supply" value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_time" className="field-label">Starts</label>
              <input id="start_time" className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label htmlFor="end_time" className="field-label">Ends</label>
              <input id="end_time" className="input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary w-full">Add schedule</button>
        </form>

        <div className="panel divide-y divide-slate-100 self-start">
          {(schedules || []).map((schedule) => (
            <div key={schedule.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{schedule.zone_name}</p>
                  <StatusPill color={schedule.is_active ? "green" : "slate"}>{schedule.is_active ? "Active" : "Paused"}</StatusPill>
                </div>
                <p className="mt-1 text-sm tabular-nums text-slate-600">
                  {schedule.start_time} to {schedule.end_time}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => run(() => api.patch(`/admin/schedules/${schedule.id}`, { is_active: !schedule.is_active }))} className="btn-secondary flex-1 sm:flex-none">
                  {schedule.is_active ? "Pause" : "Activate"}
                </button>
                <button type="button" onClick={() => remove(schedule)} className="btn-danger flex-1 sm:flex-none">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {schedules === null ? <p className="p-5 text-sm text-slate-500">Loading schedules...</p> : null}
          {schedules && !schedules.length ? <p className="p-5 text-sm text-slate-500">No schedules yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
