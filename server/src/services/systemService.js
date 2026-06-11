import { StatusCodes } from "http-status-codes";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitAlert, emitSystemUpdate } from "../lib/socket.js";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";

async function getLatestTankStatus() {
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

  return Array.from(latestByValve.values());
}

async function getSchedules() {
  const { data, error } = await supabaseAdmin
    .from("distribution_schedules")
    .select("*")
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getSystemSnapshot() {
  const [system, valves, schedules, { data: waterQuality }] = await Promise.all([
    getLatestTankStatus(), 
    getValveStatuses(), 
    getSchedules(),
    supabaseAdmin.from("water_quality").select("*").order("timestamp", { ascending: false }).limit(1).maybeSingle()
  ]);
  return {
    ...system,
    lpcd_limit: system.lpcd_limit || env.defaultLpcdLimit,
    valves,
    schedules,
    waterQuality: waterQuality || null
  };
}

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

export async function setDistributionState(mode) {
  const valves = await getValveStatuses();
  const shouldOpen = mode !== "close";
  const pumpStatus = shouldOpen;

  if (valves.length) {
    const valveChanges = valves.map((valve) => ({
      valve_name: valve.valve_name,
      status: shouldOpen
    }));

    const { error } = await supabaseAdmin.from("valve_status").insert(valveChanges);
    if (error) throw error;
  }

  await setPumpState(pumpStatus);

  const snapshot = await getSystemSnapshot();
  emitSystemUpdate({
    type: mode === "emergency" ? "distribution_emergency" : "distribution",
    data: snapshot
  });

  return snapshot;
}

export async function handleTankLevel({ tank_percentage, water_level }) {
  const previous = await getLatestTankStatus();

  let pumpStatus = previous.pump_status;
  if (tank_percentage >= 95) pumpStatus = false;
  if (tank_percentage <= 70) pumpStatus = true;

  const { data, error } = await supabaseAdmin
    .from("tank_status")
    .insert({
      tank_percentage,
      water_level,
      pump_status: pumpStatus,
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
  return data;
}

export async function verifyEsp32Secret(secret) {
  if (secret !== env.esp32SharedSecret) {
    throw httpError(StatusCodes.UNAUTHORIZED, "Invalid device secret");
  }
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
