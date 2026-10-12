import { env } from "../config/env.js";
import { localHour } from "./time.js";

export function buildDemandPrediction(usageRows = []) {
  const grouped = new Map();

  usageRows.forEach((row) => {
    const hour = localHour(env.timeZone, new Date(row.timestamp));
    const slot = `${String(hour).padStart(2, "0")}:00`;
    const current = grouped.get(slot) || { total: 0, count: 0 };
    current.total += Number(row.liters_used || 0);
    current.count += 1;
    grouped.set(slot, current);
  });

  // Empty until real readings exist; no placeholder numbers.
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, value]) => ({
      slot,
      liters: Number((value.total / Math.max(value.count, 1)).toFixed(2)),
      total: Number(value.total.toFixed(2)),
      readings: value.count
    }));
}

// Expects rows in ascending timestamp order so the days come out oldest first.
export function summarizeDailyUsage(usageRows = []) {
  const grouped = new Map();

  usageRows.forEach((row) => {
    const day = new Date(row.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: env.timeZone });
    grouped.set(day, (grouped.get(day) || 0) + Number(row.liters_used || 0));
  });

  return Array.from(grouped.entries()).map(([day, liters]) => ({
    day,
    liters: Number(liters.toFixed(2))
  }));
}
