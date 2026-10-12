import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { StatusCodes } from "http-status-codes";
import { createLeakageAlert, handleTankLevel, setPumpState, verifyEsp32Secret, handleWaterQuality, getSystemSnapshot } from "../services/systemService.js";
import { getHouseholdAllowances } from "../services/householdService.js";
import { emitDeviceUpdate, emitHouseholdEvent } from "../lib/socket.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";
import { httpError } from "../utils/httpError.js";

const tankSchema = z.object({
  tank_percentage: z.number().min(0).max(100),
  water_level: z.number().min(0),
  pump_status: z.boolean().optional(),
  device_secret: z.string()
});

const waterQualitySchema = z.object({
  tds_value: z.number().min(0),
  ph_value: z.number().min(0).max(14),
  turbidity_value: z.number().min(0),
  is_safe: z.boolean(),
  device_secret: z.string()
});

const flowSchema = z.object({
  service_number: z.string().min(3),
  flow_sensor_id: z.string().min(2),
  liters_used: z.number().min(0),
  lpcd_used: z.number().min(0),
  device_secret: z.string()
});

const commandRequestSchema = z.object({
  // The households this controller serves; without it every household is returned.
  service_numbers: z.array(z.string()).optional(),
  device_secret: z.string()
});

const pumpSchema = z.object({
  pump_status: z.boolean(),
  device_secret: z.string()
});

const leakageSchema = z.object({
  affected_house: z.string().min(2),
  severity: z.enum(["low", "medium", "high"]),
  device_secret: z.string()
});

const heartbeatSchema = z.object({
  device_key: z.string().min(3),
  service_number: z.string().min(3).optional(),
  scope: z.enum(["admin", "user"]),
  device_label: z.string().min(3),
  status: z.enum(["online", "offline", "warning"]).default("online"),
  wifi_rssi: z.number().int().optional(),
  heartbeat_interval_seconds: z.number().int().min(1),
  meta: z.record(z.any()).optional(),
  device_secret: z.string()
});

export async function uploadTankLevel(req, res, next) {
  try {
    const payload = tankSchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);
    const data = await handleTankLevel(payload);
    res.json({ tank: data });
  } catch (error) {
    next(error);
  }
}

export async function uploadFlow(req, res, next) {
  try {
    const payload = flowSchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);

    const { data: user, error: userLookupError } = await supabaseAdmin
      .from("users")
      .select("id, service_number")
      .eq("service_number", payload.service_number)
      .maybeSingle();

    if (userLookupError) throw userLookupError;
    if (!user) throw httpError(StatusCodes.NOT_FOUND, `No household is registered with service number ${payload.service_number}`);

    const { data, error } = await supabaseAdmin
      .from("water_usage")
      .insert({
        user_id: user.id,
        flow_sensor_id: payload.flow_sensor_id,
        liters_used: payload.liters_used,
        lpcd_used: payload.lpcd_used
      })
      .select()
      .single();

    if (error) throw error;
    emitHouseholdEvent(user.service_number, "usage:new", data);
    res.json({ usage: data });
  } catch (error) {
    next(error);
  }
}

export async function updatePumpState(req, res, next) {
  try {
    const payload = pumpSchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);
    const data = await setPumpState(payload.pump_status);
    res.json({ tank: data });
  } catch (error) {
    next(error);
  }
}

export async function sendLeakageAlert(req, res, next) {
  try {
    const payload = leakageSchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);
    const data = await createLeakageAlert(payload);
    res.json({ alert: data });
  } catch (error) {
    next(error);
  }
}

export async function uploadHeartbeat(req, res, next) {
  try {
    const payload = heartbeatSchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);

    const { data, error } = await supabaseAdmin
      .from("device_status")
      .upsert(
        {
          device_key: payload.device_key,
          service_number: payload.service_number || null,
          scope: payload.scope,
          device_label: payload.device_label,
          status: payload.status,
          wifi_rssi: payload.wifi_rssi,
          heartbeat_interval_seconds: payload.heartbeat_interval_seconds,
          last_seen_at: new Date().toISOString(),
          meta: payload.meta || {}
        },
        { onConflict: "device_key" }
      )
      .select()
      .single();

    if (error) throw error;
    emitDeviceUpdate(buildDeviceHealth(data));
    res.json({ device: data });
  } catch (error) {
    next(error);
  }
}

export async function uploadWaterQuality(req, res, next) {
  try {
    const payload = waterQualitySchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);
    const data = await handleWaterQuality(payload);
    res.json({ water_quality: data });
  } catch (error) {
    next(error);
  }
}

export async function fetchCommands(req, res, next) {
  try {
    const payload = commandRequestSchema.parse(req.body);
    await verifyEsp32Secret(payload.device_secret);
    
    const [snapshot, allowances] = await Promise.all([getSystemSnapshot(), getHouseholdAllowances()]);
    const wanted = payload.service_numbers;

    res.json({
      control_mode: snapshot.control_mode,
      pump_mode: snapshot.pump_mode,
      pump_status: snapshot.pump_status,
      pump_on_threshold: snapshot.pump_on_threshold,
      pump_off_threshold: snapshot.pump_off_threshold,
      lpcd_limit: Number(snapshot.lpcd_limit),
      valves: (snapshot.valves || []).map(({ valve_name, status }) => ({ valve_name, status })),
      schedules: (snapshot.schedules || [])
        .filter((schedule) => schedule.is_active)
        .map(({ start_time, end_time }) => ({ start_time, end_time })),
      households: allowances
        .filter((house) => !wanted || wanted.includes(house.service_number))
        .map(({ service_number, family_members, daily_limit_liters, liters_today }) => ({ service_number, family_members, daily_limit_liters, liters_today }))
    });
  } catch (error) {
    next(error);
  }
}
