import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitBillingUpdate, emitHouseholdEvent } from "../lib/socket.js";
import { buildDemandPrediction, summarizeDailyUsage } from "../utils/aiPrediction.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";
import { httpError } from "../utils/httpError.js";
import { fetchAll, toCsv } from "../utils/query.js";
import { monthRange } from "../utils/time.js";
import { env } from "../config/env.js";
import { getHouseholdAllowances, invalidateAllowances } from "../services/householdService.js";
import {
  PUMP_MODES,
  deleteDistributionSchedule,
  getControlState,
  getSystemSnapshot,
  resolveLeakageAlert,
  setDistributionState,
  setPumpMode,
  setValveState,
  updateControlState,
  updateDistributionSchedule,
  updateLpcdLimit,
  upsertDistributionSchedule
} from "../services/systemService.js";

const monthPattern = /^\d{4}-\d{2}$/;

// Either { mode: "auto" | "on" | "off" } or the older { pump_status: boolean }.
const pumpSchema = z
  .object({ mode: z.enum(PUMP_MODES).optional(), pump_status: z.boolean().optional() })
  .refine((value) => value.mode !== undefined || value.pump_status !== undefined, { message: "Provide mode or pump_status" });
const alertSchema = z.object({ resolved: z.boolean() });
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
const scheduleUpdateSchema = scheduleSchema.partial();
const generateBillingSchema = z.object({
  month: z.string().regex(monthPattern),
  apply_to: z.enum(["all", "selected"]).default("all"),
  user_ids: z.array(z.string().uuid()).default([])
});
const billUpdateSchema = z.object({ paid_status: z.boolean() });
const settingsSchema = z
  .object({
    tariff: z.number().min(0).optional(),
    lpcd_limit: z.number().min(1).optional(),
    pump_on_threshold: z.number().min(5).max(90).optional(),
    pump_off_threshold: z.number().min(10).max(98).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });
const userUpdateSchema = z
  .object({
    role: z.enum(["admin", "user"]).optional(),
    password: z.string().min(5).optional(),
    name: z.string().min(2).optional(),
    mobile: z.string().min(8).optional(),
    family_members: z.number().int().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });
const ticketUpdateSchema = z
  .object({ status: z.enum(["open", "resolved"]).optional(), admin_reply: z.string().min(1).optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export async function getAllHouses(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("role", "user").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ houses: data });
  } catch (error) {
    next(error);
  }
}

// One household with everything the details page shows: live device state, allowance, usage, and bills.
export async function getHouseDetails(req, res, next) {
  try {
    const key = req.params.id;
    const isUuid = z.string().uuid().safeParse(key).success;
    const { data: house, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq(isUuid ? "id" : "service_number", key)
      .eq("role", "user")
      .maybeSingle();

    if (error) throw error;
    if (!house) throw httpError(StatusCodes.NOT_FOUND, "Household not found");

    const [{ data: usage }, { data: bills }, { data: device }, allowances] = await Promise.all([
      supabaseAdmin.from("water_usage").select("*").eq("user_id", house.id).order("timestamp", { ascending: false }).limit(1000),
      supabaseAdmin.from("billing").select("*").eq("user_id", house.id).order("month", { ascending: false }),
      supabaseAdmin.from("device_status").select("*").eq("service_number", house.service_number).maybeSingle(),
      getHouseholdAllowances({ fresh: true })
    ]);

    res.json({
      house,
      allowance: allowances.find((item) => item.user_id === house.id) || null,
      device: buildDeviceHealth(device, 15),
      dailyUsage: summarizeDailyUsage((usage || []).slice().reverse()),
      recentUsage: (usage || []).slice(0, 20),
      // Month labels are text ("September 2026"), so the bills are ordered by date here.
      bills: (bills || []).sort((a, b) => new Date(`1 ${b.month}`) - new Date(`1 ${a.month}`))
    });
  } catch (error) {
    next(error);
  }
}

export async function getBilling(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("billing")
      .select("*, users!inner(name, role, service_number)")
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
    const { start, end, label: monthLabel } = monthRange(month);

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
    const [usageRows, { data: existingBills, error: existingError }, { tariff }] = await Promise.all([
      fetchAll(
        () =>
          supabaseAdmin
            .from("water_usage")
            .select("user_id, liters_used")
            .in("user_id", selectedUserIds)
            .gte("timestamp", start.toISOString())
            .lt("timestamp", end.toISOString())
            .order("timestamp", { ascending: true }),
        200000
      ),
      supabaseAdmin.from("billing").select("*").eq("month", monthLabel).in("user_id", selectedUserIds),
      getControlState()
    ]);

    if (existingError) throw existingError;

    const usageByUser = new Map();
    for (const row of usageRows) {
      const total = usageByUser.get(row.user_id) || 0;
      usageByUser.set(row.user_id, total + Number(row.liters_used || 0));
    }

    const existingBillByUser = new Map((existingBills || []).map((bill) => [bill.user_id, bill]));
    const generatedBills = [];

    for (const user of users) {
      const total_usage = Number((usageByUser.get(user.id) || 0).toFixed(2));
      const existingBill = existingBillByUser.get(user.id);

      if (existingBill) {
        // A paid bill keeps the tariff it was paid at.
        const changes = existingBill.paid_status ? { total_usage } : { total_usage, tariff };
        const { data, error } = await supabaseAdmin.from("billing").update(changes).eq("id", existingBill.id).select("*, users(name)").single();

        if (error) throw error;
        generatedBills.push(data);
        continue;
      }

      const { data, error } = await supabaseAdmin
        .from("billing")
        .insert({ user_id: user.id, month: monthLabel, total_usage, tariff })
        .select("*, users(name)")
        .single();

      if (error) throw error;
      generatedBills.push(data);
    }

    emitBillingUpdate({ month: monthLabel, user_ids: selectedUserIds, count: generatedBills.length });

    res.status(StatusCodes.CREATED).json({
      message: `Generated ${generatedBills.length} bill${generatedBills.length === 1 ? "" : "s"} for ${monthLabel}.`,
      billing: generatedBills
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBill(req, res, next) {
  try {
    const { paid_status } = billUpdateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("billing").update({ paid_status }).eq("id", req.params.id).select().maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(StatusCodes.NOT_FOUND, "Bill not found");
    emitBillingUpdate({ user_ids: [data.user_id], count: 1 });
    res.json({ bill: data });
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

export async function updateAlert(req, res, next) {
  try {
    const { resolved } = alertSchema.parse(req.body);
    const alert = await resolveLeakageAlert(req.params.id, resolved);
    res.json({ alert });
  } catch (error) {
    next(error);
  }
}

export async function getLpcdRequests(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("lpcd_requests")
      .select("*, users(name, service_number)")
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
      .select("*, users(name, service_number)")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(StatusCodes.NOT_FOUND, "Request not found");

    // The controller picks the new allowance up on its next sync.
    invalidateAllowances();
    emitHouseholdEvent(data.users?.service_number, "request:update", data);
    res.json({ request: data });
  } catch (error) {
    next(error);
  }
}

export async function controlPump(req, res, next) {
  try {
    const { mode, pump_status } = pumpSchema.parse(req.body);
    await setPumpMode(mode ?? (pump_status ? "on" : "off"));
    res.json({ system: await getSystemSnapshot() });
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
    invalidateAllowances();
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

export async function getSettings(req, res, next) {
  try {
    const system = await getSystemSnapshot();
    res.json({
      settings: {
        tariff: system.tariff,
        lpcd_limit: system.lpcd_limit,
        pump_on_threshold: system.pump_on_threshold,
        pump_off_threshold: system.pump_off_threshold
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const { lpcd_limit, ...control } = settingsSchema.parse(req.body);
    const current = await getControlState();
    const onThreshold = control.pump_on_threshold ?? current.pump_on_threshold;
    const offThreshold = control.pump_off_threshold ?? current.pump_off_threshold;

    if (onThreshold + 5 > offThreshold) {
      throw httpError(StatusCodes.BAD_REQUEST, "The pump must stop at least 5% above the level where it starts.");
    }

    if (Object.keys(control).length) {
      await updateControlState(control);
    }
    if (lpcd_limit !== undefined) {
      await updateLpcdLimit(lpcd_limit);
      invalidateAllowances();
    }

    return getSettings(req, res, next);
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

export async function updateSchedule(req, res, next) {
  try {
    const changes = scheduleUpdateSchema.parse(req.body);
    const schedule = await updateDistributionSchedule(req.params.id, changes);
    res.json({ schedule });
  } catch (error) {
    next(error);
  }
}

export async function deleteSchedule(req, res, next) {
  try {
    await deleteDistributionSchedule(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const [{ data: usage }, { data: alerts }, { data: houses }, { data: bills }, { data: devices }, system, { data: waterQuality }] = await Promise.all([
      supabaseAdmin.from("water_usage").select("*").order("timestamp", { ascending: false }).limit(1000),
      supabaseAdmin.from("leakage_alerts").select("*").order("detected_at", { ascending: false }).limit(20),
      supabaseAdmin.from("users").select("id").eq("role", "user"),
      supabaseAdmin.from("billing").select("*, users!inner(role)").eq("users.role", "user"),
      supabaseAdmin.from("device_status").select("*").order("device_key", { ascending: true }),
      getSystemSnapshot(),
      supabaseAdmin.from("water_quality").select("*").order("timestamp", { ascending: false }).limit(1).maybeSingle()
    ]);

    const dailyUsage = summarizeDailyUsage((usage || []).slice().reverse());
    const predictions = buildDemandPrediction(usage || []);

    // Billed amount per month, oldest first. Month labels are text, so they are ordered by date here.
    const billedByMonth = new Map();
    for (const bill of bills || []) {
      billedByMonth.set(bill.month, (billedByMonth.get(bill.month) || 0) + Number(bill.total_amount || 0));
    }
    const billingTrend = Array.from(billedByMonth.entries())
      .map(([month, amount]) => ({ month, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => new Date(`1 ${a.month}`) - new Date(`1 ${b.month}`))
      .slice(-12);

    const deviceStatuses = (devices || []).map((device) => buildDeviceHealth(device, 15));
    const onlineDeviceCount = deviceStatuses.filter((device) => device.is_online).length;

    res.json({
      system,
      dailyUsage,
      predictions,
      alerts: alerts || [],
      waterQuality: waterQuality || null,
      deviceStatuses,
      onlineDeviceCount,
      alertCount: (alerts || []).filter((alert) => !alert.resolved).length,
      householdCount: (houses || []).length,
      billingTrend
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

// Everything that currently needs an operator's attention, built from live records.
export async function getNotifications(req, res, next) {
  try {
    const [{ data: alerts }, { data: devices }, { data: requests }, { data: tickets }, system] = await Promise.all([
      supabaseAdmin.from("leakage_alerts").select("*").eq("resolved", false).order("detected_at", { ascending: false }),
      supabaseAdmin.from("device_status").select("*"),
      supabaseAdmin.from("lpcd_requests").select("*, users(name)").eq("status", "pending").order("requested_date", { ascending: false }),
      supabaseAdmin.from("support_tickets").select("*, users(name)").eq("status", "open").order("created_at", { ascending: false }),
      getSystemSnapshot()
    ]);

    const notifications = [];
    const controller = system.controller;

    for (const alert of alerts || []) {
      notifications.push({ id: `leak-${alert.id}`, level: "critical", title: "Leak detected", detail: alert.affected_house, time: alert.detected_at, link: "/admin/leakage-alerts" });
    }
    if (controller?.is_online && controller.meta?.dry_run_alert) {
      notifications.push({ id: "dry-run", level: "critical", title: "Pump dry-run protection tripped", detail: "The tank level did not rise while the pump was running.", time: controller.last_seen_at, link: "/admin/pump-control" });
    }
    if (controller?.is_online && controller.meta?.sensor_fault) {
      notifications.push({ id: "sensor-fault", level: "critical", title: "Tank level sensor fault", detail: "The controller has stopped the pump and closed the valves.", time: controller.last_seen_at, link: "/admin/system-health" });
    }
    if (system.waterQuality && system.waterQuality.is_safe === false) {
      notifications.push({
        id: "water-quality",
        level: "critical",
        title: "Water quality is outside safe limits",
        detail: `TDS ${system.waterQuality.tds_value}, pH ${system.waterQuality.ph_value}, turbidity ${system.waterQuality.turbidity_value}`,
        time: system.waterQuality.timestamp,
        link: "/admin/dashboard"
      });
    }
    for (const device of (devices || []).map((item) => buildDeviceHealth(item, 15))) {
      if (!device.is_online) {
        notifications.push({ id: `offline-${device.device_key}`, level: "warning", title: `${device.device_label} is offline`, detail: "No recent heartbeat.", time: device.last_seen_at, link: "/admin/system-health" });
      }
    }
    for (const request of requests || []) {
      notifications.push({
        id: `request-${request.id}`,
        level: "info",
        title: `Extra water request from ${request.users?.name || "a household"}`,
        detail: `${request.requested_extra_liters} L${request.required_date ? ` for ${request.required_date}` : ""}`,
        time: request.requested_date,
        link: "/admin/lpcd-requests"
      });
    }
    for (const ticket of tickets || []) {
      notifications.push({ id: `ticket-${ticket.id}`, level: "info", title: `Support request from ${ticket.users?.name || "a household"}`, detail: ticket.subject, time: ticket.created_at, link: "/admin/support" });
    }

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

const reportBuilders = {
  async usage({ start, end }) {
    const [rows, { data: users }] = await Promise.all([
      fetchAll(
        () =>
          supabaseAdmin
            .from("water_usage")
            .select("user_id, flow_sensor_id, liters_used, lpcd_used, timestamp")
            .gte("timestamp", start.toISOString())
            .lt("timestamp", end.toISOString())
            .order("timestamp", { ascending: true }),
        200000
      ),
      supabaseAdmin.from("users").select("id, name, service_number")
    ]);
    const userById = new Map((users || []).map((user) => [user.id, user]));

    // One line per household per day.
    const totals = new Map();
    for (const row of rows) {
      const day = new Date(row.timestamp).toLocaleDateString("en-CA", { timeZone: env.timeZone });
      const key = `${day}|${row.user_id}`;
      totals.set(key, (totals.get(key) || 0) + Number(row.liters_used || 0));
    }

    return toCsv(
      ["Date", "Service number", "Household", "Liters used"],
      Array.from(totals.entries()).map(([key, liters]) => {
        const [day, userId] = key.split("|");
        const user = userById.get(userId);
        return [day, user?.service_number || "", user?.name || "", liters.toFixed(2)];
      })
    );
  },

  async billing({ label }) {
    const { data, error } = await supabaseAdmin.from("billing").select("*, users(name, service_number)").eq("month", label);
    if (error) throw error;
    return toCsv(
      ["Month", "Service number", "Household", "Usage (L)", "Tariff per L", "Amount", "Status"],
      (data || []).map((bill) => [bill.month, bill.users?.service_number || "", bill.users?.name || "", bill.total_usage, bill.tariff, bill.total_amount, bill.paid_status ? "Paid" : "Pending"])
    );
  },

  async leakage({ start, end }) {
    const { data, error } = await supabaseAdmin
      .from("leakage_alerts")
      .select("*")
      .gte("detected_at", start.toISOString())
      .lt("detected_at", end.toISOString())
      .order("detected_at", { ascending: true });
    if (error) throw error;
    return toCsv(
      ["Detected at", "Description", "Severity", "Resolved"],
      (data || []).map((alert) => [alert.detected_at, alert.affected_house, alert.severity, alert.resolved ? "Yes" : "No"])
    );
  },

  async tank({ start, end }) {
    const rows = await fetchAll(
      () =>
        supabaseAdmin
          .from("tank_status")
          .select("timestamp, tank_percentage, water_level, pump_status")
          .gte("timestamp", start.toISOString())
          .lt("timestamp", end.toISOString())
          .order("timestamp", { ascending: true }),
      300000
    );
    return toCsv(
      ["Time", "Tank %", "Water level (cm)", "Pump"],
      rows.map((row) => [row.timestamp, row.tank_percentage, row.water_level, row.pump_status ? "On" : "Off"])
    );
  }
};

export async function downloadReport(req, res, next) {
  try {
    const build = reportBuilders[req.params.type];
    if (!build) throw httpError(StatusCodes.NOT_FOUND, "Unknown report");

    const month = z.string().regex(monthPattern).parse(req.query.month);
    const csv = await build(monthRange(month));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.type}-${month}.csv"`);
    res.send(`﻿${csv}`);
  } catch (error) {
    next(error);
  }
}

export async function getUsers(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").order("role", { ascending: true }).order("name", { ascending: true });
    if (error) throw error;
    res.json({ users: data });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { password, ...profile } = userUpdateSchema.parse(req.body);
    const id = req.params.id;

    if (profile.role && profile.role !== "admin" && id === req.user.id) {
      throw httpError(StatusCodes.BAD_REQUEST, "You cannot remove your own admin access.");
    }

    if (password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (error) throw httpError(StatusCodes.BAD_REQUEST, error.message);
    }

    let user;
    if (Object.keys(profile).length) {
      const { data, error } = await supabaseAdmin.from("users").update(profile).eq("id", id).select().maybeSingle();
      if (error) throw error;
      user = data;
    } else {
      const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user) throw httpError(StatusCodes.NOT_FOUND, "User not found");
    invalidateAllowances();
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      throw httpError(StatusCodes.BAD_REQUEST, "You cannot delete your own account.");
    }

    // Deleting the auth user removes the profile and its usage, bills, and requests with it.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw httpError(StatusCodes.BAD_REQUEST, error.message);

    invalidateAllowances();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getSupportTickets(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*, users(name, service_number)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ tickets: data });
  } catch (error) {
    next(error);
  }
}

export async function updateSupportTicket(req, res, next) {
  try {
    const changes = ticketUpdateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*, users(name, service_number)")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(StatusCodes.NOT_FOUND, "Ticket not found");
    emitHouseholdEvent(data.users?.service_number, "support:update", data);
    res.json({ ticket: data });
  } catch (error) {
    next(error);
  }
}
