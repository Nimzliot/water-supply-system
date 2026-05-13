import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

const initialForm = {
  zone_name: "",
  start_time: "06:00",
  end_time: "08:00",
  is_active: true
};

export default function SchedulesPage() {
  const [system, setSystem] = useState(null);
  const [form, setForm] = useState(initialForm);

  const load = () => api.get("/admin/system").then(({ data }) => setSystem(data.system));

  useEffect(() => {
    load();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    await api.post("/admin/schedules", form);
    setForm(initialForm);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedules"
        title="Distribution schedule management"
        description="Set timing windows, prepare for RTC sync, and automate daily water distribution."
      />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submit} className="panel p-5">
          <p className="text-lg font-semibold text-white">Create Schedule</p>
          <div className="mt-4 space-y-4">
            <input className="input" placeholder="Zone or schedule name" value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <input className="input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <button className="btn-primary w-full">Save Schedule</button>
          </div>
        </form>
        <div className="space-y-3">
          {system?.schedules?.map((schedule) => (
            <div key={schedule.id} className="panel p-5">
              <p className="font-semibold text-white">{schedule.zone_name}</p>
              <p className="mt-2 text-sm text-slate-300">
                {schedule.start_time} - {schedule.end_time}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                {schedule.is_active ? "Automatic distribution active" : "Inactive"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

