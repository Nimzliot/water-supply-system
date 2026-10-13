// Turns the three sensor readings into one plain answer.
//   good       - inside normal drinking-water ranges
//   acceptable - a little outside them, but inside what the prototype allows
//   unsafe     - outside what the prototype allows
//   unknown    - values no real water gives, so a sensor is unplugged or uncalibrated
const DRINKING = { phMin: 6.5, phMax: 8.5, tds: 500, turbidity: 5 };
const ALLOWED = { phMin: 5, phMax: 10, tds: 1000, turbidity: 50 };

const labels = {
  good: { title: "Good", color: "green" },
  acceptable: { title: "Acceptable", color: "amber" },
  unsafe: { title: "Not safe", color: "rose" },
  unknown: { title: "Check sensors", color: "slate" }
};

// Accepts either a stored reading (tds_value, ph_value, turbidity_value) or a heartbeat (tds, ph, turbidity).
export function describeWaterQuality(reading) {
  if (!reading) return null;

  const ph = Number(reading.ph_value ?? reading.ph);
  const tds = Number(reading.tds_value ?? reading.tds);
  const turbidity = Number(reading.turbidity_value ?? reading.turbidity);
  if (![ph, tds, turbidity].every(Number.isFinite)) return null;

  const part = (name, level, text) => ({ name, level, text });
  const rate = (value, good, allowed) => (value < good ? "good" : value < allowed ? "acceptable" : "unsafe");

  let acidity;
  if (ph >= DRINKING.phMin && ph <= DRINKING.phMax) acidity = part("Acidity", "good", "Normal");
  else if (ph >= ALLOWED.phMin && ph <= ALLOWED.phMax) acidity = part("Acidity", "acceptable", ph < 7 ? "Slightly acidic" : "Slightly alkaline");
  else acidity = part("Acidity", "unsafe", ph < 7 ? "Too acidic" : "Too alkaline");

  const mineralLevel = rate(tds, DRINKING.tds, ALLOWED.tds);
  const minerals = part("Minerals", mineralLevel, { good: "Normal", acceptable: "A little high", unsafe: "Too high" }[mineralLevel]);

  const clarityLevel = rate(turbidity, DRINKING.turbidity, ALLOWED.turbidity);
  const clarity = part("Clarity", clarityLevel, { good: "Clear", acceptable: "Slightly cloudy", unsafe: "Cloudy" }[clarityLevel]);

  const parts = [acidity, minerals, clarity];
  const implausible = ph <= 0.5 || ph >= 13.5 || tds > 5000 || turbidity > 800;
  const level = implausible ? "unknown" : parts.some((item) => item.level === "unsafe") ? "unsafe" : parts.some((item) => item.level === "acceptable") ? "acceptable" : "good";

  const problems = parts.filter((item) => item.level !== "good").map((item) => item.text.toLowerCase());
  const sentence = {
    good: "The water is fine to supply.",
    acceptable: `Fine for the prototype: ${problems.join(", ")}.`,
    unsafe: `Problem: ${problems.join(", ")}.`,
    unknown: "The readings are not ones real water gives. A sensor is unplugged or needs calibrating."
  }[level];

  return { level, ...labels[level], sentence, parts, numbers: { ph, tds, turbidity } };
}
