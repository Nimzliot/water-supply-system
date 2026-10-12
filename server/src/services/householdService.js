import { supabaseAdmin } from "../lib/supabase.js";
import { env } from "../config/env.js";
import { localDateString, startOfLocalDay } from "../utils/time.js";
import { fetchAll } from "../utils/query.js";
import { getLatestTankStatus } from "./systemService.js";

// The ESP32 asks for this every few seconds, so the result is reused briefly.
const CACHE_MS = 20000;
let cache = { at: 0, data: null };

export function invalidateAllowances() {
  cache = { at: 0, data: null };
}

// Each household's water allowance for today and what it has used so far.
// daily_limit_liters = LPCD limit x family members + extra liters approved for today.
export async function getHouseholdAllowances({ fresh = false } = {}) {
  if (!fresh && cache.data && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const dayStart = startOfLocalDay(env.timeZone).toISOString();
  const today = localDateString(env.timeZone);

  const [{ data: users, error: usersError }, tank, usage, { data: requests, error: requestsError }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, service_number, family_members").eq("role", "user"),
    getLatestTankStatus(),
    fetchAll(() => supabaseAdmin.from("water_usage").select("user_id, liters_used").gte("timestamp", dayStart).order("timestamp", { ascending: true })),
    supabaseAdmin.from("lpcd_requests").select("user_id, requested_extra_liters").eq("status", "approved").eq("required_date", today)
  ]);

  if (usersError) throw usersError;
  // Before migration 002 there is no required_date column, so no request can apply to today.
  if (requestsError) console.warn("[households] Could not read approved extra-water requests:", requestsError.message);

  const lpcdLimit = Number(tank.lpcd_limit || env.defaultLpcdLimit);
  const usedByUser = new Map();
  for (const row of usage) {
    usedByUser.set(row.user_id, (usedByUser.get(row.user_id) || 0) + Number(row.liters_used || 0));
  }
  const extraByUser = new Map();
  for (const row of requests || []) {
    extraByUser.set(row.user_id, (extraByUser.get(row.user_id) || 0) + Number(row.requested_extra_liters || 0));
  }

  const data = (users || []).map((user) => {
    const familyMembers = Math.max(Number(user.family_members) || 1, 1);
    const extraLiters = extraByUser.get(user.id) || 0;
    return {
      user_id: user.id,
      name: user.name,
      service_number: user.service_number,
      family_members: familyMembers,
      lpcd_limit: lpcdLimit,
      extra_liters: Number(extraLiters.toFixed(2)),
      daily_limit_liters: Number((lpcdLimit * familyMembers + extraLiters).toFixed(2)),
      liters_today: Number((usedByUser.get(user.id) || 0).toFixed(2))
    };
  });

  cache = { at: Date.now(), data };
  return data;
}
