function zoneOffsetMs(timeZone, date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function startOfLocalDay(timeZone, date = new Date()) {
  const offset = zoneOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + offset);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocal - offset);
}

// "2026-10-12" for the calendar day it currently is in the given time zone.
export function localDateString(timeZone, date = new Date()) {
  return new Date(date.getTime() + zoneOffsetMs(timeZone, date)).toISOString().slice(0, 10);
}

export function localHour(timeZone, date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit" }).format(date));
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-09" -> { start, end, label: "September 2026" }
export function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
    label: `${MONTH_NAMES[monthNumber - 1]} ${year}`
  };
}

// "September 2026" -> { start, end }, or null when the label is not a month.
export function monthLabelRange(label) {
  const [name, year] = String(label).split(" ");
  const index = MONTH_NAMES.indexOf(name);
  if (index < 0 || !Number(year)) return null;
  return { start: new Date(Date.UTC(Number(year), index, 1)), end: new Date(Date.UTC(Number(year), index + 1, 1)) };
}
