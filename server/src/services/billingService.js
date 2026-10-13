import { supabaseAdmin } from "../lib/supabase.js";
import { fetchAll } from "../utils/query.js";
import { monthLabelRange, monthRange } from "../utils/time.js";
import { getControlState } from "./systemService.js";

const PAYMENT_COLUMNS = ["paid_at", "payment_method", "payment_id", "payment_order_id"];

// Marks a bill paid or unpaid, recording how it was paid. On a database that has not had
// migration 005 yet the payment details are left out, so marking a bill paid still works.
export async function setBillPaid(billId, paid, payment = {}) {
  const details = paid
    ? { paid_at: new Date().toISOString(), payment_method: payment.method || "cash", payment_id: payment.paymentId || null, payment_order_id: payment.orderId || null }
    : { paid_at: null, payment_method: null, payment_id: null, payment_order_id: null };

  let result = await supabaseAdmin.from("billing").update({ paid_status: paid, ...details }).eq("id", billId).select().maybeSingle();

  if (result.error && ["PGRST204", "42703"].includes(result.error.code)) {
    console.warn(`[billing] Payment details not stored (${PAYMENT_COLUMNS.join(", ")} missing). Run supabase/migrations/005_payments.sql.`);
    result = await supabaseAdmin.from("billing").update({ paid_status: paid }).eq("id", billId).select().maybeSingle();
  }

  if (result.error) throw result.error;
  return result.data;
}

// Adds to each bill what its household's meter shows for that month now. An unpaid bill whose
// stored usage no longer matches is out of date: it was generated before those readings arrived.
export async function attachCurrentUsage(bills) {
  const monthLabels = [...new Set(bills.map((bill) => bill.month))];
  const usageByMonth = new Map();

  await Promise.all(
    monthLabels.map(async (label) => {
      const range = monthLabelRange(label);
      if (!range) return;
      const userIds = [...new Set(bills.filter((bill) => bill.month === label).map((bill) => bill.user_id))];
      const rows = await fetchAll(
        () =>
          supabaseAdmin
            .from("water_usage")
            .select("user_id, liters_used")
            .in("user_id", userIds)
            .gte("timestamp", range.start.toISOString())
            .lt("timestamp", range.end.toISOString())
            .order("timestamp", { ascending: true }),
        200000
      );
      const totals = new Map();
      for (const row of rows) totals.set(row.user_id, (totals.get(row.user_id) || 0) + Number(row.liters_used || 0));
      usageByMonth.set(label, totals);
    })
  );

  return bills.map((bill) => {
    const totals = usageByMonth.get(bill.month);
    if (!totals) return { ...bill, current_usage: null, out_of_date: false };
    const current_usage = Number((totals.get(bill.user_id) || 0).toFixed(2));
    return { ...bill, current_usage, out_of_date: !bill.paid_status && Math.abs(current_usage - Number(bill.total_usage)) > 0.005 };
  });
}

// Brings unpaid bills back in line with the meter readings, at the current rate.
// Paid bills are never touched. Returns the bills that changed.
export async function recalculateBills(billIds = null) {
  let query = supabaseAdmin.from("billing").select("*").eq("paid_status", false);
  if (billIds) query = query.in("id", billIds);

  const { data, error } = await query;
  if (error) throw error;

  const [{ tariff }, bills] = await Promise.all([getControlState(), attachCurrentUsage(data || [])]);
  const changed = [];

  for (const bill of bills) {
    if (bill.current_usage === null) continue;
    if (!bill.out_of_date && Number(bill.tariff) === Number(tariff)) continue;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("billing")
      .update({ total_usage: bill.current_usage, tariff })
      .eq("id", bill.id)
      .select()
      .single();
    if (updateError) throw updateError;
    changed.push(updated);
  }

  return changed;
}

// Works out every selected household's bill for a month: liters recorded by its meter in
// that month times the tariff. The preview and the real generation both use this, so what
// the admin sees before pressing Generate is exactly what gets stored.
export async function calculateBills({ month, userIds = null, tariff: tariffOverride }) {
  const { start, end, label } = monthRange(month);

  let usersQuery = supabaseAdmin.from("users").select("id, name, service_number, email").eq("role", "user");
  if (userIds) {
    usersQuery = usersQuery.in("id", userIds);
  }

  const { data: users, error: usersError } = await usersQuery.order("name", { ascending: true });
  if (usersError) throw usersError;
  if (!users?.length) return { label, tariff: tariffOverride ?? (await getControlState()).tariff, rows: [] };

  const ids = users.map((user) => user.id);
  const [usageRows, { data: existingBills, error: existingError }, control] = await Promise.all([
    fetchAll(
      () =>
        supabaseAdmin
          .from("water_usage")
          .select("user_id, liters_used")
          .in("user_id", ids)
          .gte("timestamp", start.toISOString())
          .lt("timestamp", end.toISOString())
          .order("timestamp", { ascending: true }),
      200000
    ),
    supabaseAdmin.from("billing").select("*").eq("month", label).in("user_id", ids),
    getControlState()
  ]);
  if (existingError) throw existingError;

  const tariff = Number(tariffOverride ?? control.tariff);
  const usageByUser = new Map();
  const readingsByUser = new Map();
  for (const row of usageRows) {
    usageByUser.set(row.user_id, (usageByUser.get(row.user_id) || 0) + Number(row.liters_used || 0));
    readingsByUser.set(row.user_id, (readingsByUser.get(row.user_id) || 0) + 1);
  }
  const existingByUser = new Map((existingBills || []).map((bill) => [bill.user_id, bill]));

  const rows = users.map((user) => {
    const existing = existingByUser.get(user.id) || null;
    const total_usage = Number((usageByUser.get(user.id) || 0).toFixed(2));
    // A paid bill keeps the tariff it was paid at.
    const rate = existing?.paid_status ? Number(existing.tariff) : tariff;
    return {
      user,
      existing,
      readings: readingsByUser.get(user.id) || 0,
      total_usage,
      tariff: rate,
      amount: Number((total_usage * rate).toFixed(2))
    };
  });

  return { label, tariff, rows };
}
