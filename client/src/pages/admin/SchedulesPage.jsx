import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useController } from "../../lib/useController";
import { errorMessage } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVERY_DAY = 127;
const WEEKDAYS = 62; // Mon to Fri
const WEEKENDS = 65; // Sun and Sat
const MAX_WINDOWS = 4;

const emptyForm = { zone_name: "", start_time: "06:00", end_time: "08:00", days_mask: EVERY_DAY, target: "all" };

const toMinutes = (text) => {
  const [hours, minutes] = String(text || "").split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
};
const formatClock = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const formatDuration = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`);
const maskOf = (schedule) => schedule.days_mask ?? EVERY_DAY;
const runsOn = (schedule, weekday) => (maskOf(schedule) & (1 << weekday)) !== 0;

// A window that ends before it starts runs past midnight; the controller uses the same rule.
function windowLength(schedule) {
  const start = toMinutes(schedule.start_time);
  const end = toMinutes(schedule.end_time);
  if (start === null || end === null) return 0;
  return end > start ? end - start : 1440 - start + end;
}

function isRunning(schedule, now, weekday) {
  const start = toMinutes(schedule.start_time);
  const end = toMinutes(schedule.end_time);
  if (start === null || end === null || !runsOn(schedule, weekday)) return false;
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

function daysLabel(mask) {
  if (mask === EVERY_DAY) return "Every day";
  if (mask === WEEKDAYS) return "Weekdays";
  if (mask === WEEKENDS) return "Weekends";
  return DAY_NAMES.filter((_, index) => mask & (1 << index)).join(", ");
}

// Minutes from now until the window next starts, looking up to a week ahead.
function minutesUntilNextStart(schedule, now, weekday) {
  const start = toMinutes(schedule.start_time);
  if (start === null) return null;
  for (let offset = 0; offset < 8; offset++) {
    const day = (weekday + offset) % 7;
    if (!runsOn(schedule, day)) continue;
    const wait = offset * 1440 + start - now;
    if (wait > 0) return wait;
  }
  return null;
}

function describeWait(minutes, weekday, now) {
  if (minutes === null) return "Never";
  const startsAt = now + minutes;
  const daysAhead = Math.floor(startsAt / 1440);
  const clock = formatClock(startsAt % 1440);
  if (daysAhead === 0) return minutes < 60 ? `In ${minutes} min` : `Today at ${clock}`;
  if (daysAhead === 1) return `Tomorrow at ${clock}`;
  return `${DAY_NAMES[(weekday + daysAhead) % 7]} at ${clock}`;
}

// Today as a 24-hour bar with each window drawn on it and a marker at the current time.
function DayTimeline({ schedules, now, weekday }) {
  const segments = [];
  for (const schedule of schedules) {
    if (!runsOn(schedule, weekday)) continue;
    const start = toMinutes(schedule.start_time);
    const end = toMinutes(schedule.end_time);
    if (start === null || end === null) continue;
    // A window past midnight shows as two pieces: late evening and early morning.
    const pieces = end > start ? [[start, end]] : [[start, 1440], [0, end]];
    for (const [from, to] of pieces) segments.push({ key: `${schedule.id}-${from}`, from, to, name: schedule.zone_name });
  }

  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-xl bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.name}: ${formatClock(segment.from)} to ${formatClock(segment.to)}`}
            className="absolute inset-y-0 rounded-md bg-brand-500"
            style={{ left: `${(segment.from / 1440) * 100}%`, width: `${Math.max(0.6, ((segment.to - segment.from) / 1440) * 100)}%` }}
          />
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(now / 1440) * 100}%` }} />
      </div>
      <div className="relative mt-1 h-4 text-[0.7rem] font-semibold tabular-nums text-slate-400">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${Math.min(97, Math.max(3, (hour / 24) * 100))}%` }}>
            {String(hour).padStart(2, "0")}:00
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const { system, reload, live } = useController();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const schedules = system?.schedules || null;
  const { online, meta, houses } = live;

  const houseName = (index) => (houses[index]?.label ? `House ${index + 1} (${houses[index].label})` : `House ${index + 1}`);
  const targetLabel = (target) => (target === "house1" ? houseName(0) : target === "house2" ? houseName(1) : "Both houses");

  const run = async (request, done = "") => {
    try {
      setError("");
      setMessage("");
      await request();
      await reload();
      if (done) setMessage(done);
    } catch (err) {
      setError(errorMessage(err, "Unable to save the schedule."));
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (form.zone_name.trim().length < 2) return setError("Give the schedule a name.");
    if (form.start_time === form.end_time) return setError("The start and end time are the same, so this window would never run.");
    if (!form.days_mask) return setError("Pick at least one day.");

    const payload = { ...form, zone_name: form.zone_name.trim() };
    return run(async () => {
      if (editingId) await api.patch(`/admin/schedules/${editingId}`, payload);
      else await api.post("/admin/schedules", { ...payload, is_active: true });
      setForm(emptyForm);
      setEditingId(null);
    }, editingId ? "Schedule updated." : "Schedule added. The controller picks it up within a few seconds.");
  };

  const startEdit = (schedule) => {
    setEditingId(schedule.id);
    setForm({ zone_name: schedule.zone_name, start_time: schedule.start_time.slice(0, 5), end_time: schedule.end_time.slice(0, 5), days_mask: maskOf(schedule), target: schedule.target || "all" });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (schedule) => {
    if (!window.confirm(`Delete the schedule "${schedule.zone_name}"?`)) return;
    run(() => api.delete(`/admin/schedules/${schedule.id}`), "Schedule deleted.");
  };

  // The controller's own clock decides when a window runs, so that is the time used here.
  const today = new Date();
  const weekday = today.getDay();
  const browserNow = today.getHours() * 60 + today.getMinutes();
  const controllerNow = online && meta.clock_valid !== false ? toMinutes(meta.clock) : null;
  const now = controllerNow ?? browserNow;
  const clockOff = controllerNow !== null && Math.min(Math.abs(controllerNow - browserNow), 1440 - Math.abs(controllerNow - browserNow)) > 5;

  const active = (schedules || []).filter((schedule) => schedule.is_active);
  const todays = active.filter((schedule) => runsOn(schedule, weekday));
  const running = active.find((schedule) => isRunning(schedule, now, weekday));
  const supplyToday = todays.reduce((total, schedule) => total + windowLength(schedule), 0);
  const upcoming = active
    .map((schedule) => ({ schedule, wait: minutesUntilNextStart(schedule, now, weekday) }))
    .filter((item) => item.wait !== null)
    .sort((a, b) => a.wait - b.wait)[0];

  // Everything that stops a scheduled window from actually delivering water.
  const valveOn = (name) => system?.valves?.find((valve) => valve.valve_name === name)?.status;
  const blockers = [];
  if (system) {
    if (!online) blockers.push({ text: "The controller is offline, so it cannot follow the schedule.", to: "/admin/system-health", link: "System health" });
    if (online && meta.clock_valid === false) blockers.push({ text: "The controller has no valid time, so it cannot tell when a window starts.", to: "/admin/system-health", link: "System health" });
    if (online && meta.sensor_fault) blockers.push({ text: `Tank level sensor fault. ${meta.sensor_fault_reason || "Everything is stopped until the level can be read again."}`, to: "/admin/tank-monitoring", link: "Tank" });
    if (system.control_mode === "manual") blockers.push({ text: "Manual mode is on, so schedules are ignored.", to: "/admin/valve-control", link: "Switch to Automatic" });
    if (valveOn("Main Distribution Valve") === false) blockers.push({ text: "The main valve switch is off, so no water leaves the tank.", to: "/admin/water-distribution", link: "Open distribution" });
    if (valveOn("House 1 Intake Valve") === false && valveOn("House 2 Intake Valve") === false) blockers.push({ text: "Both house valve switches are off.", to: "/admin/valve-control", link: "Valves" });
    if (online && meta.leak_detected) blockers.push({ text: "A leak was detected, so the valves are held closed.", to: "/admin/leakage-alerts", link: "Leak alerts" });
    if (active.length > MAX_WINDOWS) blockers.push({ text: `The controller follows at most ${MAX_WINDOWS} active windows. Pause or delete the extra ones.`, to: "/admin/schedules", link: "" });
  }

  const toggleDay = (index) => setForm((current) => ({ ...current, days_mask: current.days_mask ^ (1 << index) }));
  const chip = (selected) => `rounded-full px-3.5 py-2 text-xs font-bold transition ${selected ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Schedules"
        description="In Automatic mode the controller supplies water only inside the active windows: on the days you choose, to the houses you choose."
        actions={<StatusPill color={online ? "green" : "rose"} dot>{online ? `Controller time ${meta.clock || "--:--"}` : "Controller offline"}</StatusPill>}
      />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Supply right now" value={!active.length ? "Any time" : running ? "In a window" : "Waiting"} hint={running ? `${running.zone_name}, until ${running.end_time.slice(0, 5)}` : !active.length ? "No active schedule" : "Outside every window"} />
        <StatCard label="Next window" value={!active.length ? "--" : upcoming ? describeWait(upcoming.wait, weekday, now) : "None"} hint={upcoming ? `${upcoming.schedule.zone_name} · ${targetLabel(upcoming.schedule.target)}` : "Nothing scheduled"} />
        <StatCard label="Windows today" value={todays.length} hint={`${active.length} active in total`} />
        <StatCard label="Supply hours today" value={supplyToday ? formatDuration(supplyToday) : "0 min"} hint={`${DAY_NAMES[weekday]} · planned by the schedule`} />
      </div>

      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="panel-title">Today, {DAY_NAMES[weekday]}</p>
          <p className="text-xs font-semibold tabular-nums text-slate-500">Now {formatClock(now)}</p>
        </div>
        <div className="mt-4">
          <DayTimeline schedules={active} now={now} weekday={weekday} />
        </div>
        {online && meta.supply_status ? <p className="mt-3 text-sm text-slate-600">Controller says: {meta.supply_status}</p> : null}

        {clockOff ? (
          <p className="pop-in mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            The controller's clock ({meta.clock}) and this device's clock ({formatClock(browserNow)}) disagree. Windows run on the controller's time.
          </p>
        ) : null}

        {blockers.length ? (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500">{running || !active.length ? "Why water is not flowing" : "What will stop the next window"}</p>
            <ul className="mt-2 space-y-2">
              {blockers.map((blocker) => (
                <li key={blocker.text} className="flex flex-col gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="min-w-0">{blocker.text}</span>
                  {blocker.link ? <Link to={blocker.to} className="shrink-0 text-xs font-bold text-brand-700 hover:underline">{blocker.link}</Link> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : system ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">Nothing is blocking the schedule.</p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr] xl:gap-5">
        <form onSubmit={submit} className="panel space-y-4 self-start p-5 sm:p-6">
          <p className="panel-title">{editingId ? "Edit supply window" : "Add a supply window"}</p>
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
          <p className="text-xs text-slate-500">
            Runs for {formatDuration(windowLength(form))}
            {toMinutes(form.end_time) < toMinutes(form.start_time) ? ", past midnight" : ""}.
          </p>

          <div>
            <p className="field-label">Days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((name, index) => (
                <button key={name} type="button" onClick={() => toggleDay(index)} aria-pressed={Boolean(form.days_mask & (1 << index))} className={chip(form.days_mask & (1 << index))}>
                  {name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-brand-600">
              <button type="button" onClick={() => setForm({ ...form, days_mask: EVERY_DAY })} className="hover:text-brand-700">Every day</button>
              <button type="button" onClick={() => setForm({ ...form, days_mask: WEEKDAYS })} className="hover:text-brand-700">Weekdays</button>
              <button type="button" onClick={() => setForm({ ...form, days_mask: WEEKENDS })} className="hover:text-brand-700">Weekends</button>
            </div>
          </div>

          <div>
            <p className="field-label">Supplies</p>
            <div className="flex flex-wrap gap-2">
              {["all", "house1", "house2"].map((target) => (
                <button key={target} type="button" onClick={() => setForm({ ...form, target })} aria-pressed={form.target === target} className={chip(form.target === target)}>
                  {targetLabel(target)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary flex-1">{editingId ? "Save changes" : "Add schedule"}</button>
            {editingId ? (
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="btn-secondary">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="space-y-3">
          {(schedules || []).map((schedule) => {
            const runningNow = schedule.is_active && isRunning(schedule, now, weekday);
            const wait = schedule.is_active ? minutesUntilNextStart(schedule, now, weekday) : null;
            return (
              <div key={schedule.id} className={`panel p-5 ${editingId === schedule.id ? "ring-2 ring-brand-500" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{schedule.zone_name}</p>
                    <p className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums text-ink">
                      {schedule.start_time.slice(0, 5)} to {schedule.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <StatusPill color={runningNow ? "green" : schedule.is_active ? "blue" : "slate"} dot={runningNow}>
                    {runningNow ? "Running now" : schedule.is_active ? "Active" : "Paused"}
                  </StatusPill>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">Days</dt>
                    <dd className="text-ink">{daysLabel(maskOf(schedule))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">Supplies</dt>
                    <dd className="text-ink">{targetLabel(schedule.target)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">Length</dt>
                    <dd className="text-ink">{formatDuration(windowLength(schedule))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">Next start</dt>
                    <dd className="text-ink">{!schedule.is_active ? "Paused" : runningNow ? "Running now" : describeWait(wait, weekday, now)}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => startEdit(schedule)} className="btn-secondary">Edit</button>
                  <button type="button" onClick={() => run(() => api.patch(`/admin/schedules/${schedule.id}`, { is_active: !schedule.is_active }))} className="btn-secondary">
                    {schedule.is_active ? "Pause" : "Activate"}
                  </button>
                  <button type="button" onClick={() => remove(schedule)} className="btn-danger">Delete</button>
                </div>
              </div>
            );
          })}
          {schedules === null ? <p className="text-sm text-slate-500">Loading schedules...</p> : null}
          {schedules && !schedules.length ? (
            <div className="panel p-5 text-sm text-slate-500">No schedules yet. Without one, the controller supplies water at any time of day.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
