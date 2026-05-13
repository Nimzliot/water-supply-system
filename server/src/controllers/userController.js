import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { summarizeDailyUsage } from "../utils/aiPrediction.js";
import { env } from "../config/env.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";

const lpcdRequestSchema = z.object({
  requested_extra_liters: z.number().min(1),
  reason: z.string().min(3)
});

export async function getDashboard(req, res, next) {
  try {
    const [{ data: usage }, { data: bills }, { data: tank }, { data: deviceStatus }] = await Promise.all([
      supabaseAdmin.from("water_usage").select("*").eq("user_id", req.user.id).order("timestamp", { ascending: false }).limit(50),
      supabaseAdmin.from("billing").select("*").eq("user_id", req.user.id).order("month", { ascending: false }).limit(6),
      supabaseAdmin.from("tank_status").select("*").order("timestamp", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("device_status").select("*").eq("service_number", req.user.service_number).maybeSingle()
    ]);

    const todayUsage = (usage || []).reduce((total, row) => {
      const isToday = new Date(row.timestamp).toDateString() === new Date().toDateString();
      return total + (isToday ? Number(row.liters_used || 0) : 0);
    }, 0);

    const history = summarizeDailyUsage((usage || []).slice().reverse());
    const latestTank = tank || { pump_status: false, lpcd_limit: env.defaultLpcdLimit };
    const lpcdUsed = Number((todayUsage / Math.max(req.user.family_members || 1, 1)).toFixed(2));
    const device = buildDeviceHealth(deviceStatus, 60);

    res.json({
      todayUsage: Number(todayUsage.toFixed(2)),
      currentBill: bills?.[0] || null,
      history,
      lpcdUsed,
      lpcdLimit: latestTank.lpcd_limit || env.defaultLpcdLimit,
      waterStatus: latestTank.pump_status ? "Supplying" : "Standby",
      deviceStatus: device
    });
  } catch (error) {
    next(error);
  }
}

export async function getUsage(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("water_usage")
      .select("*")
      .eq("user_id", req.user.id)
      .order("timestamp", { ascending: false });

    if (error) throw error;
    res.json({ usage: data });
  } catch (error) {
    next(error);
  }
}

export async function getBills(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("billing")
      .select("*")
      .eq("user_id", req.user.id)
      .order("month", { ascending: false });

    if (error) throw error;
    res.json({ bills: data });
  } catch (error) {
    next(error);
  }
}

export async function submitLpcdRequest(req, res, next) {
  try {
    const payload = lpcdRequestSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("lpcd_requests")
      .insert({ ...payload, user_id: req.user.id, status: "pending" })
      .select()
      .single();

    if (error) throw error;
    res.json({ request: data });
  } catch (error) {
    next(error);
  }
}

export async function getConsumptionHistory(req, res, next) {
  return getUsage(req, res, next);
}

export async function getUserDeviceStatus(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("device_status")
      .select("*")
      .eq("service_number", req.user.service_number)
      .maybeSingle();

    if (error) throw error;
    res.json({ device: buildDeviceHealth(data, 60) });
  } catch (error) {
    next(error);
  }
}
