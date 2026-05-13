import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitBillingUpdate } from "../lib/socket.js";
import { buildDemandPrediction, summarizeDailyUsage } from "../utils/aiPrediction.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";
import { getSystemSnapshot, setDistributionState, setPumpState, setValveState, updateLpcdLimit, upsertDistributionSchedule } from "../services/systemService.js";

const pumpSchema = z.object({ pump_status: z.boolean() });
const distributionSchema = z.object({ mode: z.enum(["open", "close", "emergency"]) });
const valveSchema = z.object({ valve_name: z.string().min(2), status: z.boolean() });
const lpcdSchema = z.object({ lpcd_limit: z.number().min(1) });
const requestStatusSchema = z.object({ status: z.enum(["approved", "rejected", "pending"]) });
const scheduleSchema = z.object({
  zone_name: z.string().min(2),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  is_active: z.boolean().default(true)
});
const generateBillingSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  apply_to: z.enum(["all", "selected"]).default("all"),
  user_ids: z.array(z.string().uuid()).default([])
});

export async function getAllHouses(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("role", "user").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ houses: data });
  } catch (error) {
    next(error);
  }
}

export async function getBilling(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("billing")
      .select("*, users!inner(name, role)")
      .eq("users.role", "user")
      .order("month", { ascending: false });
    if (error) throw error;
    res.json({ billing: data });
  } catch (error) {
    next(error);
  }
}

export async function generateBilling(req, res, next) {
  try {
    const { month, apply_to, user_ids } = generateBillingSchema.parse(req.body);
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 1));
    const monthLabel = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    let usersQuery = supabaseAdmin.from("users").select("id, name, service_number").eq("role", "user");
    if (apply_to === "selected") {
      usersQuery = usersQuery.in("id", user_ids);
    }

    const { data: users, error: usersError } = await usersQuery.order("name", { ascending: true });
    if (usersError) throw usersError;

    if (!users?.length) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "No households selected for bill generation." });
    }

    const selectedUserIds = users.map((user) => user.id);
    const [{ data: usageRows, error: usageError }, { data: existingBills, error: existingError }] = await Promise.all([
      supabaseAdmin
        .from("water_usage")
        .select("user_id, liters_used, timestamp")
        .in("user_id", selectedUserIds)
        .gte("timestamp", start.toISOString())
        .lt("timestamp", end.toISOString()),
      supabaseAdmin.from("billing").select("*").eq("month", monthLabel).in("user_id", selectedUserIds)
    ]);

    if (usageError) throw usageError;
    if (existingError) throw existingError;

    const usageByUser = new Map();
    for (const row of usageRows || []) {
      const total = usageByUser.get(row.user_id) || 0;
      usageByUser.set(row.user_id, total + Number(row.liters_used || 0));
    }

    const existingBillByUser = new Map((existingBills || []).map((bill) => [bill.user_id, bill]));
    const generatedBills = [];

    for (const user of users) {
      const total_usage = Number((usageByUser.get(user.id) || 0).toFixed(2));
      const existingBill = existingBillByUser.get(user.id);

      if (existingBill) {
        const { data, error } = await supabaseAdmin
          .from("billing")
          .update({ total_usage })
          .eq("id", existingBill.id)
          .select("*, users(name)")
          .single();

        if (error) throw error;
        generatedBills.push(data);
        continue;
      }

      const { data, error } = await supabaseAdmin
        .from("billing")
        .insert({
          user_id: user.id,
          month: monthLabel,
          total_usage
        })
        .select("*, users(name)")
        .single();

      if (error) throw error;
      generatedBills.push(data);
    }

    emitBillingUpdate({
      month: monthLabel,
      user_ids: selectedUserIds,
      count: generatedBills.length
    });

    res.status(StatusCodes.CREATED).json({
      message: `Generated ${generatedBills.length} bill${generatedBills.length === 1 ? "" : "s"} for ${monthLabel}.`,
      billing: generatedBills
    });
  } catch (error) {
    next(error);
  }
}

export async function getAlerts(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from("leakage_alerts").select("*").order("detected_at", { ascending: false });
    if (error) throw error;
    res.json({ alerts: data });
  } catch (error) {
    next(error);
  }
}

export async function getLpcdRequests(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("lpcd_requests")
      .select("*, users(name)")
      .order("requested_date", { ascending: false });
    if (error) throw error;
    res.json({ requests: data });
  } catch (error) {
    next(error);
  }
}

export async function updateLpcdRequestStatus(req, res, next) {
  try {
    const { status } = requestStatusSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("lpcd_requests")
      .update({ status })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ request: data });
  } catch (error) {
    next(error);
  }
}

export async function controlPump(req, res, next) {
  try {
    const { pump_status } = pumpSchema.parse(req.body);
    const data = await setPumpState(pump_status);
    res.json({ tank: data });
  } catch (error) {
    next(error);
  }
}

export async function controlDistribution(req, res, next) {
  try {
    const { mode } = distributionSchema.parse(req.body);
    const system = await setDistributionState(mode);
    res.json({ system });
  } catch (error) {
    next(error);
  }
}

export async function controlValve(req, res, next) {
  try {
    const { valve_name, status } = valveSchema.parse(req.body);
    const data = await setValveState(valve_name, status);
    res.json({ valve: data });
  } catch (error) {
    next(error);
  }
}

export async function setLpcd(req, res, next) {
  try {
    const { lpcd_limit } = lpcdSchema.parse(req.body);
    const data = await updateLpcdLimit(lpcd_limit);
    res.json({ tank: data });
  } catch (error) {
    next(error);
  }
}

export async function getSystem(req, res, next) {
  try {
    const system = await getSystemSnapshot();
    res.json({ system });
  } catch (error) {
    next(error);
  }
}

export async function createSchedule(req, res, next) {
  try {
    const payload = scheduleSchema.parse(req.body);
    const schedule = await upsertDistributionSchedule(payload);
    res.status(StatusCodes.CREATED).json({ schedule });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const [{ data: usage }, { data: alerts }, { data: houses }, { data: bills }, { data: devices }, system] = await Promise.all([
      supabaseAdmin.from("water_usage").select("*").order("timestamp", { ascending: false }).limit(200),
      supabaseAdmin.from("leakage_alerts").select("*").order("detected_at", { ascending: false }).limit(20),
      supabaseAdmin.from("users").select("id").eq("role", "user"),
      supabaseAdmin.from("billing").select("*, users!inner(role)").eq("users.role", "user").order("month", { ascending: true }).limit(12),
      supabaseAdmin.from("device_status").select("*").order("device_key", { ascending: true }),
      getSystemSnapshot()
    ]);

    const dailyUsage = summarizeDailyUsage(usage || []);
    const predictions = buildDemandPrediction(usage || []);
    const billingTrend = (bills || []).map((bill) => ({ month: bill.month, amount: Number(bill.total_amount || 0) }));

    const deviceStatuses = (devices || []).map((device) => buildDeviceHealth(device, 15));
    const onlineDeviceCount = deviceStatuses.filter((device) => device.is_online).length;

    res.json({
      system,
      dailyUsage,
      predictions,
      alerts: alerts || [],
      deviceStatuses,
      onlineDeviceCount,
      alertCount: (alerts || []).filter((alert) => !alert.resolved).length,
      householdCount: (houses || []).length,
      runtimeHours: Number((((usage || []).length * 5) / 60).toFixed(1)),
      billingTrend,
      rawUsage: usage || [],
      rawBills: bills || []
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminDeviceStatus(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from("device_status").select("*").order("scope", { ascending: true });
    if (error) throw error;

    res.json({
      devices: (data || []).map((device) => buildDeviceHealth(device, 15))
    });
  } catch (error) {
    next(error);
  }
}

export async function generateReport(req, res) {
  res.status(StatusCodes.OK).json({
    generated_at: new Date().toISOString(),
    message: "Report generation endpoint ready for PDF/CSV export integration."
  });
}
