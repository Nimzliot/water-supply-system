import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { createLeakageAlert, handleTankLevel, setPumpState, verifyEsp32Secret } from "../services/systemService.js";

const tankSchema = z.object({
  tank_percentage: z.number().min(0).max(100),
  water_level: z.number().min(0),
  device_secret: z.string()
});

const flowSchema = z.object({
  service_number: z.string().min(3),
  flow_sensor_id: z.string().min(2),
  liters_used: z.number().min(0),
  lpcd_used: z.number().min(0),
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
      .single();

    if (userLookupError || !user) throw userLookupError || new Error("Service number not found");

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
    res.json({ device: data });
  } catch (error) {
    next(error);
  }
}
