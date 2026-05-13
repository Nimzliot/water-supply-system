export function buildDemandPrediction(usageRows = []) {
  const grouped = new Map();

  usageRows.forEach((row) => {
    const hour = new Date(row.timestamp).getHours();
    const slot = `${String(hour).padStart(2, "0")}:00`;
    const current = grouped.get(slot) || { total: 0, count: 0 };
    current.total += Number(row.liters_used || 0);
    current.count += 1;
    grouped.set(slot, current);
  });

  const slots = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, value]) => ({
      slot,
      liters: Number((value.total / Math.max(value.count, 1)).toFixed(2))
    }));

  if (slots.length > 0) {
    return slots;
  }

  return [
    { slot: "06:00", liters: 120 },
    { slot: "09:00", liters: 85 },
    { slot: "12:00", liters: 50 },
    { slot: "18:00", liters: 160 },
    { slot: "21:00", liters: 110 }
  ];
}

export function summarizeDailyUsage(usageRows = []) {
  const grouped = new Map();

  usageRows.forEach((row) => {
    const day = new Date(row.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    grouped.set(day, (grouped.get(day) || 0) + Number(row.liters_used || 0));
  });

  return Array.from(grouped.entries()).map(([day, liters]) => ({
    day,
    liters: Number(liters.toFixed(2))
  }));
}

