import { StatusCodes } from "http-status-codes";
import { supabaseAdmin } from "../lib/supabase.js";
import { generateText } from "../lib/gemini.js";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";
import { buildDemandPrediction, summarizeDailyUsage } from "../utils/aiPrediction.js";
import { startOfLocalDay } from "../utils/time.js";
import { CONTROLLER_DEVICE_KEY, getSystemSnapshot } from "./systemService.js";
import { getHouseholdAllowances } from "./householdService.js";

// The assistant only reads and explains. It never switches the pump or valves: every answer is
// built from the live data below, and any action is left to the person on the dashboard.

// The sketch numbers its houses by service number: the first is house 1.
const byServiceNumber = (list) => list.slice().sort((a, b) => String(a.service_number).localeCompare(String(b.service_number)));

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HISTORY_DAYS = 14;
const MAX_TURNS = 10;
const MAX_CHARS = 2000;

// A small per-person limit so one open tab cannot use up the Gemini quota.
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60000;
const recentCalls = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const calls = (recentCalls.get(userId) || []).filter((at) => now - at < RATE_WINDOW_MS);
  if (calls.length >= RATE_LIMIT) {
    throw httpError(StatusCodes.TOO_MANY_REQUESTS, "That is a lot of questions in a minute. Wait a moment and ask again.");
  }
  calls.push(now);
  recentCalls.set(userId, calls);
}

function cleanHistory(history = []) {
  return history
    .filter((turn) => turn && typeof turn.text === "string" && turn.text.trim())
    .slice(-MAX_TURNS)
    .map((turn) => ({ role: turn.role === "model" ? "model" : "user", text: turn.text.slice(0, MAX_CHARS) }));
}

function localNow() {
  return new Date().toLocaleString("en-IN", { timeZone: env.timeZone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function daysLabel(mask = 127) {
  if (mask === 127) return "every day";
  return DAY_NAMES.filter((_, index) => mask & (1 << index)).join(", ");
}

// What the controller is doing right now, in the form the dashboards show it.
function describeController(system) {
  const controller = system.controller;
  if (!controller?.is_online) {
    return { online: false, last_seen: controller?.last_seen_at || "never", note: "Offline: nothing below is live." };
  }
  const meta = controller.meta || {};
  return {
    online: true,
    controller_says: meta.supply_status,
    cycle_state: meta.cycle_state,
    controller_clock: meta.clock,
    tank_percent: meta.tank_percentage,
    pump_running: meta.pump_status,
    valves_open: { main: meta.main_valve_open, house1: meta.house1_valve_open, house2: meta.house2_valve_open },
    main_flow_l_per_min: meta.main_flow_lpm,
    level_sensor_fault: meta.sensor_fault ? meta.sensor_fault_reason || true : false,
    pump_dry_run_lockout: meta.dry_run_alert,
    leak_detected: meta.leak_detected,
    water_quality: {
      counted_safe: meta.water_safe,
      ph: meta.ph, tds_ppm: meta.tds, turbidity_ntu: meta.turbidity,
      sensors_validated: { ph: meta.ph_validated === true, tds: meta.tds_validated === true, turbidity: meta.turbidity_validated === true }
    }
  };
}

async function adminContext() {
  const dayStart = startOfLocalDay(env.timeZone);
  const historyStart = new Date(dayStart.getTime() - (HISTORY_DAYS - 1) * 86400000);
  const [system, allowances, { data: usage }, { data: alerts }, { data: bills }, { data: devices }] = await Promise.all([
    getSystemSnapshot(),
    getHouseholdAllowances(),
    supabaseAdmin.from("water_usage").select("liters_used, timestamp").gte("timestamp", historyStart.toISOString()).order("timestamp", { ascending: true }).limit(5000),
    supabaseAdmin.from("leakage_alerts").select("affected_house, severity, detected_at").eq("resolved", false).limit(10),
    supabaseAdmin.from("billing").select("month, total_amount, paid_status, users!inner(name, role)").eq("users.role", "user"),
    supabaseAdmin.from("device_status").select("*")
  ]);

  const unpaid = (bills || []).filter((bill) => !bill.paid_status);
  return {
    time_now: localNow(),
    controller: describeController(system),
    settings: {
      control_mode: system.control_mode,
      pump_switch: system.pump_mode,
      pump_starts_below_percent: system.pump_on_threshold,
      pump_stops_at_percent: system.pump_off_threshold,
      tariff_rupees_per_litre: system.tariff,
      lpcd_limit_litres_per_person_per_day: system.lpcd_limit
    },
    schedules: (system.schedules || []).map((s) => ({ name: s.zone_name, from: s.start_time?.slice(0, 5), to: s.end_time?.slice(0, 5), days: daysLabel(s.days_mask ?? 127), houses: s.target || "all", active: s.is_active })),
    households: byServiceNumber(allowances).map((house, index) => ({
      house: `House ${index + 1}`, name: house.name, service_number: house.service_number, family_members: house.family_members,
      used_today_litres: house.liters_today, daily_limit_litres: house.daily_limit_liters, extra_approved_today: house.extra_liters
    })),
    daily_usage_litres_last_14_days: summarizeDailyUsage(usage || []),
    usage_by_hour_of_day: buildDemandPrediction(usage || []).map(({ slot, total }) => ({ hour: slot, litres: total })),
    open_leak_alerts: alerts || [],
    unpaid_bills: { count: unpaid.length, total_rupees: Number(unpaid.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0).toFixed(2)) },
    devices: (devices || []).map((device) => buildDeviceHealth(device, 15)).map((d) => ({ device: d.device_label, online: d.is_online, last_seen: d.last_seen_at }))
  };
}

const SYSTEM_RULES = `You are Blesson AI, the assistant built into a smart rural water distribution prototype in Rajapalayam, Tamil Nadu: an ESP32 controller with an overhead tank (ultrasonic level sensor), a borewell pump, a main valve, and one valve and flow meter per household (two houses). The data you are given is live from the database.

How the system works:
- Automatic control mode: the pump starts below the start level and stops at the stop level. Supply to houses only starts with a full tank (stop level), runs only inside an active schedule window (on its days, for its houses), pauses to refill when the tank falls below the start level, and closes a house when it reaches its daily limit (LPCD limit x family members + approved extra). Valve switches on the dashboard are not used in Automatic.
- Manual control mode: the pump and every valve follow the dashboard switches; schedules and limits are ignored.
- Pump ON runs the pump to the stop level; with a level sensor fault it runs for at most 60 seconds per press.
- Safety always applies: level sensor fault stops automatic pumping and supply; dry-run lockout stops the pump if the level does not rise; a leak closes the valves.
- Water quality sensors only judge the water once marked validated in the sketch; until then the water counts as good.
- Billing is the tariff (rupees per litre) times litres used.

Pages in the admin dashboard (use these exact names): Dashboard, Analytics, Demand Forecast, Blesson AI, Live Map, 3D Plant, Tank Monitoring, Water Distribution, Pump Control, Valve Control, Schedules, System Controls, Households, Billing, Payments, LPCD Requests, Support, Leakage Alerts, Notifications, System Health, Reports, Users, Settings.
Pages for a household: Dashboard, Live Usage, Usage History, LPCD Status, Blesson AI, Bills, Payments, Request Extra Water, Notifications, Profile, Support, Settings.

Rules for answering:
- Use only the data given. If something is not in the data, say you do not know. Never invent readings.
- You cannot operate anything. When an action is needed, say exactly which dashboard page and button to use (for example "Water Distribution > Open Distribution", "Pump Control > Automatic", "Schedules").
- Be short and plain: a direct answer first, then at most a few short bullet points. Use litres, %, rupees (Rs.) and 24-hour times.`;

// How Blesson AI talks to the operator: an engineer reading the plant.
const ADMIN_PERSONA = `You are talking to the system administrator, who runs the plant and the hardware.
- Be precise and technical: name the exact reading, setting, page and button. Lead with the cause, then the fix.
- When something is wrong, check the likely causes in order: controller offline, level sensor fault, control mode, schedule window, tank not full yet, daily limits, leak, dry-run lockout.
- Photos: the admin may send a photo of wiring, a sensor, the ESP32, the LCD, the Arduino serial monitor, an error message or a meter. Read it carefully, say what you see, and relate it to the live data (for example an HC-SR04 powered from 3.3 V instead of 5 V, no voltage divider on Echo, a loose jumper, a relay LED that is off).
- Use short bullets when there are steps.`;

// How Blesson AI talks to a household: a friendly helper, not an engineer.
const HOUSEHOLD_PERSONA = `You are talking to a member of a household that receives water. They are not technical.
- Be warm and simple. Short sentences, everyday words. Avoid jargon such as relay, LPCD, ESP32 or threshold: say "daily water allowance", "the main tank", "the water supply".
- If they write in Tamil, answer in Tamil. If they write in English, answer in English.
- Talk only about their own household: their usage, their allowance, their bills and when water comes. Never reveal other households' data, and never explain how to control the system.
- Add one practical water-saving tip when it fits.
- Photos: they may send a photo of their bill, a tap, a leak, a meter or the water itself. Explain what you see in plain words. You cannot tell from a photo whether water is safe to drink: say so, and suggest Support if they are worried.
- For more water today: "Request Extra Water". To pay: "Bills" or "Payments". For a problem: "Support".`;

export async function askAdmin({ userId, question, images = [], history }) {
  checkRateLimit(userId);
  const context = await adminContext();
  return generateText({
    system: `${SYSTEM_RULES}\n\n${ADMIN_PERSONA}\n\nLIVE DATA (JSON):\n${JSON.stringify(context)}`,
    messages: [...cleanHistory(history), { role: "user", text: question.slice(0, MAX_CHARS), images }]
  });
}

// A short briefing for the dashboard. Cached so every open dashboard shares one call.
const BRIEFING_MS = 120000;
let briefingCache = { at: 0, text: "" };

export async function adminBriefing({ userId, fresh = false }) {
  if (!fresh && briefingCache.text && Date.now() - briefingCache.at < BRIEFING_MS) {
    return { text: briefingCache.text, generated_at: new Date(briefingCache.at).toISOString() };
  }
  checkRateLimit(userId);
  const context = await adminContext();
  const text = await generateText({
    system: `${SYSTEM_RULES}\n\nLIVE DATA (JSON):\n${JSON.stringify(context)}`,
    messages: [{
      role: "user",
      text: "Give the operator a briefing of 3 to 5 bullet points: is water reaching the houses right now and if not exactly why, anything that needs attention (faults, offline devices, a house near its limit, leaks, unpaid bills), and one practical suggestion (for example a better schedule window from the usage-by-hour data). Start each bullet with a short bold label. No heading."
    }],
    temperature: 0.3
  });
  briefingCache = { at: Date.now(), text };
  return { text, generated_at: new Date(briefingCache.at).toISOString() };
}

async function householdContext(user) {
  const dayStart = startOfLocalDay(env.timeZone);
  const historyStart = new Date(dayStart.getTime() - (HISTORY_DAYS - 1) * 86400000);
  const [allowances, system, { data: usage }, { data: bills }, { data: requests }, { data: controller }] = await Promise.all([
    getHouseholdAllowances(),
    getSystemSnapshot(),
    supabaseAdmin.from("water_usage").select("liters_used, timestamp").eq("user_id", user.id).gte("timestamp", historyStart.toISOString()).order("timestamp", { ascending: true }).limit(2000),
    supabaseAdmin.from("billing").select("month, total_usage, total_amount, paid_status").eq("user_id", user.id),
    supabaseAdmin.from("lpcd_requests").select("requested_extra_liters, status, required_date").eq("user_id", user.id).order("requested_date", { ascending: false }).limit(5),
    supabaseAdmin.from("device_status").select("*").eq("device_key", CONTROLLER_DEVICE_KEY).maybeSingle()
  ]);
  const mine = allowances.find((house) => house.user_id === user.id);
  const houseIndex = byServiceNumber(allowances).findIndex((house) => house.user_id === user.id);
  const health = buildDeviceHealth(controller, 15);
  const target = houseIndex === 0 ? "house1" : houseIndex === 1 ? "house2" : null;

  return {
    time_now: localNow(),
    household: { name: user.name, service_number: user.service_number, family_members: mine?.family_members ?? user.family_members },
    today: { used_litres: mine?.liters_today ?? 0, daily_limit_litres: mine?.daily_limit_liters ?? null, extra_approved_litres: mine?.extra_liters ?? 0 },
    lpcd_limit_litres_per_person_per_day: system.lpcd_limit,
    tariff_rupees_per_litre: system.tariff,
    supply_now: health.is_online
      ? { controller_online: true, water_reaching_houses: Boolean(health.meta?.main_valve_open), status: health.meta?.supply_status }
      : { controller_online: false },
    supply_windows_for_this_house: (system.schedules || [])
      .filter((s) => s.is_active && (!s.target || s.target === "all" || s.target === target))
      .map((s) => ({ from: s.start_time?.slice(0, 5), to: s.end_time?.slice(0, 5), days: daysLabel(s.days_mask ?? 127) })),
    daily_usage_litres_last_14_days: summarizeDailyUsage(usage || []),
    bills: (bills || []).map((bill) => ({ month: bill.month, litres: bill.total_usage, rupees: bill.total_amount, paid: bill.paid_status })),
    recent_extra_water_requests: requests || []
  };
}

export async function askHousehold({ user, question, images = [], history }) {
  checkRateLimit(user.id);
  const context = await householdContext(user);
  return generateText({
    system: `${SYSTEM_RULES}\n\n${HOUSEHOLD_PERSONA}\n\nTHEIR DATA (JSON):\n${JSON.stringify(context)}`,
    messages: [...cleanHistory(history), { role: "user", text: question.slice(0, MAX_CHARS), images }],
    temperature: 0.5
  });
}
