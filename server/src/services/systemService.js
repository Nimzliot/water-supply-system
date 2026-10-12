import { timingSafeEqual } from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitAlert, emitSystemUpdate } from "../lib/socket.js";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";
import { notifyAdminsLeak } from "./notifyService.js";

export const PUMP_MODES = ["auto", "on", "off"];
// auto: the controller runs its cycle. manual: the pump and valves follow the dashboard switches.
export const CONTROL_MODES = ["auto", "manual"];
export const CONTROLLER_DEVICE_KEY = "SYSTEM-ESP32";

const CONTROL_STATE_HELP = "The control_state table is missing. Run supabase/migrations/001_control_state.sql and 002_live_features.sql in the Supabase SQL editor.";
let warnedMissingControlState = false;

function isMissingTable(error) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export async function getLatestTankStatus() {
  const { data, error } = await supabaseAdmin
    .from("tank_status")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || { tank_percentage: 0, water_level: 0, pump_status: false, lpcd_limit: env.defaultLpcdLimit };
}

async function getValveStatuses() {
  const { data, error } = await supabaseAdmin
    .from("valve_status")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) throw error;

  const latestByValve = new Map();
  for (const valve of data || []) {
    if (!latestByValve.has(valve.valve_name)) {
      latestByValve.set(valve.valve_name, valve);
    }
  }

  return Array.from(latestByValve.values()).sort((a, b) => a.valve_name.localeCompare(b.valve_name));
}

async function getSchedules() {
  const { data, error } = await supabaseAdmin
    .from("distribution_schedules")
    .select("*")
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

// What the admin has set: the pump command ("auto" lets the firmware decide), the tariff, and the
// pump thresholds. tank_status.pump_status is only ever what the device reports, so a command
// and a report never overwrite each other.
export async function getControlState() {
  const { data, error } = await supabaseAdmin.from("control_state").select("*").eq("id", 1).maybeSingle();

  if (error) {
    if (!isMissingTable(error)) throw error;
    if (!warnedMissingControlState) {
      warnedMissingControlState = true;
      console.warn(`[system] ${CONTROL_STATE_HELP} Using default settings.`);
    }
  }

  return {
    pump_mode: PUMP_MODES.includes(data?.pump_mode) ? data.pump_mode : "auto",
    control_mode: CONTROL_MODES.includes(data?.control_mode) ? data.control_mode : "auto",
    tariff: Number(data?.tariff ?? env.defaultTariff),
    pump_on_threshold: Number(data?.pump_on_threshold ?? 75),
    pump_off_threshold: Number(data?.pump_off_threshold ?? 95)
  };
}

export async function updateControlState(changes) {
  const { data, error } = await supabaseAdmin
    .from("control_state")
    .upsert({ id: 1, ...changes, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  emitSystemUpdate({ type: "settings", data });
  return data;
}

export async function setPumpMode(pump_mode) {
  return updateControlState({ pump_mode });
}

async function getControllerDevice() {
  const { data, error } = await supabaseAdmin
    .from("device_status")
    .select("*")
    .eq("device_key", CONTROLLER_DEVICE_KEY)
    .maybeSingle();

  if (error) throw error;
  return buildDeviceHealth(data, 15);
}

export async function getSystemSnapshot() {
  const [system, valves, schedules, control, controller, { data: waterQuality }] = await Promise.all([
    getLatestTankStatus(),
    getValveStatuses(),
    getSchedules(),
    getControlState(),
    getControllerDevice(),
    supabaseAdmin.from("water_quality").select("*").order("timestamp", { ascending: false }).limit(1).maybeSingle()
  ]);
  return {
    ...system,
    lpcd_limit: Number(system.lpcd_limit || env.defaultLpcdLimit),
    ...control,
    controller,
    valves,
    schedules,
    waterQuality: waterQuality || null
  };
}

// Records the pump state reported by the device.
export async function setPumpState(pump_status) {
  const previous = await getLatestTankStatus();
  const payload = {
    tank_percentage: previous.tank_percentage,
    water_level: previous.water_level,
    pump_status,
    lpcd_limit: previous.lpcd_limit || env.defaultLpcdLimit
  };

  const { data, error } = await supabaseAdmin.from("tank_status").insert(payload).select().single();
  if (error) throw error;

  emitSystemUpdate({ type: "pump", data });
  return data;
}

export async function updateLpcdLimit(lpcd_limit) {
  const previous = await getLatestTankStatus();
  const payload = {
    tank_percentage: previous.tank_percentage,
    water_level: previous.water_level,
    pump_status: previous.pump_status,
    lpcd_limit
  };

  const { data, error } = await supabaseAdmin.from("tank_status").insert(payload).select().single();
  if (error) throw error;

  emitSystemUpdate({ type: "lpcd_limit", data });
  return data;
}

export async function setValveState(valve_name, status) {
  const { data, error } = await supabaseAdmin
    .from("valve_status")
    .insert({ valve_name, status })
    .select()
    .single();

  if (error) throw error;
  emitSystemUpdate({ type: "valve", data });
  return data;
}

export async function setControlMode(control_mode) {
  return updateControlState({ control_mode });
}

// open / close switch every valve. In automatic mode an open valve is supplied during the
// controller's cycle; in manual mode it opens at once. "emergency" switches to manual mode and
// opens everything, so water flows immediately whatever the schedule or daily limits say.
// The pump is left alone: the firmware keeps the tank inside its safe level thresholds.
export async function setDistributionState(mode) {
  const valves = await getValveStatuses();
  const shouldOpen = mode !== "close";

  if (mode === "emergency") {
    await setControlMode("manual");
  }

  if (valves.length) {
    const valveChanges = valves.map((valve) => ({
      valve_name: valve.valve_name,
      status: shouldOpen
    }));

    const { error } = await supabaseAdmin.from("valve_status").insert(valveChanges);
    if (error) throw error;
  }

  const snapshot = await getSystemSnapshot();
  emitSystemUpdate({
    type: mode === "emergency" ? "distribution_emergency" : "distribution",
    data: snapshot
  });

  return snapshot;
}

export async function handleTankLevel({ tank_percentage, water_level, pump_status }) {
  const previous = await getLatestTankStatus();

  const { data, error } = await supabaseAdmin
    .from("tank_status")
    .insert({
      tank_percentage,
      water_level,
      pump_status: pump_status ?? previous.pump_status,
      lpcd_limit: previous.lpcd_limit || env.defaultLpcdLimit
    })
    .select()
    .single();

  if (error) throw error;

  emitSystemUpdate({ type: "tank", data });
  return data;
}

export async function createLeakageAlert({ affected_house, severity }) {
  const { data, error } = await supabaseAdmin
    .from("leakage_alerts")
    .insert({ affected_house, severity, resolved: false })
    .select()
    .single();

  if (error) throw error;
  emitAlert(data);
  notifyAdminsLeak(data);
  return data;
}

export async function resolveLeakageAlert(id, resolved) {
  const { data, error } = await supabaseAdmin
    .from("leakage_alerts")
    .update({ resolved })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw httpError(StatusCodes.NOT_FOUND, "Alert not found");
  emitAlert(data);
  return data;
}

export async function verifyEsp32Secret(secret) {
  const given = Buffer.from(String(secret ?? ""));
  const expected = Buffer.from(env.esp32SharedSecret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw httpError(StatusCodes.UNAUTHORIZED, "Invalid device secret");
  }
}

export async function updateDistributionSchedule(id, changes) {
  const { data, error } = await supabaseAdmin.from("distribution_schedules").update(changes).eq("id", id).select().maybeSingle();

  if (error) throw error;
  if (!data) throw httpError(StatusCodes.NOT_FOUND, "Schedule not found");
  emitSystemUpdate({ type: "schedule", data });
  return data;
}

export async function deleteDistributionSchedule(id) {
  const { error } = await supabaseAdmin.from("distribution_schedules").delete().eq("id", id);

  if (error) throw error;
  emitSystemUpdate({ type: "schedule", data: { id, deleted: true } });
}

export async function upsertDistributionSchedule({ zone_name, start_time, end_time, is_active }) {
  const { data, error } = await supabaseAdmin
    .from("distribution_schedules")
    .insert({ zone_name, start_time, end_time, is_active })
    .select()
    .single();

  if (error) throw error;
  emitSystemUpdate({ type: "schedule", data });
  return data;
}

export async function handleWaterQuality({ tds_value, ph_value, turbidity_value, is_safe }) {
  const { data, error } = await supabaseAdmin
    .from("water_quality")
    .insert({
      tds_value,
      ph_value,
      turbidity_value,
      is_safe
    })
    .select()
    .single();

  if (error) throw error;

  emitSystemUpdate({ type: "water_quality", data });
  return data;
}
