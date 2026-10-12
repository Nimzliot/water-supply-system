import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitHouseholdEvent } from "../lib/socket.js";
import { summarizeDailyUsage } from "../utils/aiPrediction.js";
import { env } from "../config/env.js";
import { buildDeviceHealth } from "../utils/deviceStatus.js";
import { httpError } from "../utils/httpError.js";
import { fetchAll } from "../utils/query.js";
import { monthLabelRange, startOfLocalDay } from "../utils/time.js";
import { CONTROLLER_DEVICE_KEY } from "../services/systemService.js";
import { getHouseholdAllowances } from "../services/householdService.js";

const HISTORY_DAYS = 14;

const lpcdRequestSchema = z.object({
  requested_extra_liters: z.number().min(1),
  required_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3)
});
const supportSchema = z.object({
  subject: z.string().min(3),
  message: z.string().min(5)
});

async function getAllowance(user) {
  const allowances = await getHouseholdAllowances({ fresh: true });
  return allowances.find((item) => item.user_id === user.id) || null;
}

export async function getDashboard(req, res, next) {
  try {
    const dayStart = startOfLocalDay(env.timeZone);
    const historyStart = new Date(dayStart.getTime() - (HISTORY_DAYS - 1) * 24 * 60 * 60 * 1000);

    const [{ data: usage }, { data: bills }, { data: deviceStatus }, { data: controllerStatus }, allowance] = await Promise.all([
      supabaseAdmin
        .from("water_usage")
        .select("liters_used, timestamp")
        .eq("user_id", req.user.id)
        .gte("timestamp", historyStart.toISOString())
        .order("timestamp", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("billing").select("*").eq("user_id", req.user.id),
      supabaseAdmin.from("device_status").select("*").eq("service_number", req.user.service_number).maybeSingle(),
      supabaseAdmin.from("device_status").select("*").eq("device_key", CONTROLLER_DEVICE_KEY).maybeSingle(),
      getAllowance(req.user)
    ]);

    const familyMembers = Math.max(req.user.family_members || 1, 1);
    const todayUsage = allowance?.liters_today || 0;
    const device = buildDeviceHealth(deviceStatus, 15);
    // Water reaches houses through the main valve; the pump only refills the overhead tank.
    const controller = buildDeviceHealth(controllerStatus, 15);
    const supplying = Boolean(controller.is_online && controller.meta?.main_valve_open);
    // Month labels are text ("September 2026"), so the newest bill is picked by date.
    const currentBill = (bills || []).slice().sort((a, b) => new Date(`1 ${b.month}`) - new Date(`1 ${a.month}`))[0] || null;

    res.json({
      todayUsage,
      currentBill,
      history: summarizeDailyUsage((usage || []).slice().reverse()),
      lpcdUsed: Number((todayUsage / familyMembers).toFixed(2)),
      lpcdLimit: allowance?.lpcd_limit ?? env.defaultLpcdLimit,
      dailyLimitLiters: allowance?.daily_limit_liters ?? env.defaultLpcdLimit * familyMembers,
      extraLitersToday: allowance?.extra_liters ?? 0,
      familyMembers,
      waterStatus: supplying ? "Supplying" : "Standby",
      controllerOnline: Boolean(controller.is_online),
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
      .order("timestamp", { ascending: false })
      .limit(500);

    if (error) throw error;
    res.json({ usage: data });
  } catch (error) {
    next(error);
  }
}

export async function getBills(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from("billing").select("*").eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ bills: (data || []).sort((a, b) => new Date(`1 ${b.month}`) - new Date(`1 ${a.month}`)) });
  } catch (error) {
    next(error);
  }
}

// One bill with the usage it was calculated from, day by day.
export async function getBillDetails(req, res, next) {
  try {
    const { data: bill, error } = await supabaseAdmin.from("billing").select("*").eq("id", req.params.id).eq("user_id", req.user.id).maybeSingle();

    if (error) throw error;
    if (!bill) throw httpError(StatusCodes.NOT_FOUND, "Bill not found");

    const range = monthLabelRange(bill.month);
    const usage = range
      ? await fetchAll(() =>
          supabaseAdmin
            .from("water_usage")
            .select("liters_used, timestamp")
            .eq("user_id", req.user.id)
            .gte("timestamp", range.start.toISOString())
            .lt("timestamp", range.end.toISOString())
            .order("timestamp", { ascending: true })
        )
      : [];

    res.json({ bill, dailyUsage: summarizeDailyUsage(usage) });
  } catch (error) {
    next(error);
  }
}

export async function getLpcdRequests(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("lpcd_requests")
      .select("*")
      .eq("user_id", req.user.id)
      .order("requested_date", { ascending: false });

    if (error) throw error;
    res.json({ requests: data });
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
    emitHouseholdEvent(req.user.service_number, "request:update", data);
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
    res.json({ device: buildDeviceHealth(data, 15) });
  } catch (error) {
    next(error);
  }
}

export async function getSupportTickets(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ tickets: data });
  } catch (error) {
    next(error);
  }
}

export async function submitSupportTicket(req, res, next) {
  try {
    const payload = supportSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ ...payload, user_id: req.user.id })
      .select()
      .single();

    if (error) throw error;
    emitHouseholdEvent(req.user.service_number, "support:update", data);
    res.status(StatusCodes.CREATED).json({ ticket: data });
  } catch (error) {
    next(error);
  }
}

// What this household should know right now, built from live records.
export async function getNotifications(req, res, next) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: bills }, { data: requests }, { data: tickets }, { data: deviceStatus }, { data: controllerStatus }, { data: alerts }, allowance] = await Promise.all([
      supabaseAdmin.from("billing").select("*").eq("user_id", req.user.id).eq("paid_status", false),
      supabaseAdmin.from("lpcd_requests").select("*").eq("user_id", req.user.id).gte("requested_date", weekAgo).order("requested_date", { ascending: false }),
      supabaseAdmin.from("support_tickets").select("*").eq("user_id", req.user.id).not("admin_reply", "is", null).order("updated_at", { ascending: false }).limit(5),
      supabaseAdmin.from("device_status").select("*").eq("service_number", req.user.service_number).maybeSingle(),
      supabaseAdmin.from("device_status").select("*").eq("device_key", CONTROLLER_DEVICE_KEY).maybeSingle(),
      supabaseAdmin.from("leakage_alerts").select("*").eq("resolved", false).order("detected_at", { ascending: false }),
      getAllowance(req.user)
    ]);

    const notifications = [];
    const device = buildDeviceHealth(deviceStatus, 15);
    const controller = buildDeviceHealth(controllerStatus, 15);

    for (const alert of alerts || []) {
      notifications.push({ id: `leak-${alert.id}`, level: "critical", title: "Leak detected on the network", detail: "Supply may be interrupted while it is inspected.", time: alert.detected_at });
    }
    if (allowance && allowance.liters_today >= allowance.daily_limit_liters) {
      notifications.push({
        id: "limit",
        level: "warning",
        title: "Today's water allowance is used up",
        detail: `${allowance.liters_today} L used of ${allowance.daily_limit_liters} L. Supply resumes tomorrow.`,
        time: new Date().toISOString(),
        link: "/user/lpcd-status"
      });
    }
    if (deviceStatus && !device.is_online) {
      notifications.push({ id: "device-offline", level: "warning", title: "Your meter is offline", detail: "No recent reading from your connection.", time: device.last_seen_at, link: "/user/live-usage" });
    }
    if (controller.is_online && controller.meta?.main_valve_open) {
      notifications.push({ id: "supply", level: "info", title: "Water supply is on", detail: "The village controller is distributing water now.", time: controller.last_seen_at });
    }
    for (const bill of bills || []) {
      notifications.push({ id: `bill-${bill.id}`, level: "info", title: `Bill for ${bill.month} is unpaid`, detail: `Rs. ${Number(bill.total_amount).toFixed(2)} for ${bill.total_usage} L`, time: null, link: `/user/bill-details/${bill.id}` });
    }
    for (const request of requests || []) {
      if (request.status === "pending") continue;
      notifications.push({
        id: `request-${request.id}`,
        level: request.status === "approved" ? "info" : "warning",
        title: `Extra water request ${request.status}`,
        detail: `${request.requested_extra_liters} L${request.required_date ? ` for ${request.required_date}` : ""}`,
        time: request.requested_date,
        link: "/user/request-extra-water"
      });
    }
    for (const ticket of tickets || []) {
      notifications.push({ id: `ticket-${ticket.id}`, level: "info", title: `Reply to "${ticket.subject}"`, detail: ticket.admin_reply, time: ticket.updated_at, link: "/user/support" });
    }

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}
