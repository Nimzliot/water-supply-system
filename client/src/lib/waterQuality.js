// Turns the three sensor readings into one plain answer.
//   good       - inside normal drinking-water ranges, or no validated sensor says otherwise
//   acceptable - a little outside them, but inside what the prototype allows
//   unsafe     - outside what the prototype allows
//   unknown    - a validated sensor gives values no real water gives, so it is unplugged
//
// The water counts as good until a validated sensor says otherwise, the same rule the
// controller uses. A sensor is validated once it has been calibrated against a known sample
// (PH_SENSOR_VALIDATED and the others in the controller sketch). Until then its reading is
// shown but not used. Readings without the flags, from older firmware or stored history,
// count as not validated.
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

  const validated = {
    ph: reading.ph_validated === true,
    tds: reading.tds_validated === true,
    turbidity: reading.turbidity_validated === true
  };

  const part = (name, isValidated, level, text) =>
    isValidated ? { name, validated: true, level, text } : { name, validated: false, level: "good", text: "Not validated" };
  const rate = (value, good, allowed) => (value < good ? "good" : value < allowed ? "acceptable" : "unsafe");

  let acidityLevel = "unsafe";
  if (ph >= DRINKING.phMin && ph <= DRINKING.phMax) acidityLevel = "good";
  else if (ph >= ALLOWED.phMin && ph <= ALLOWED.phMax) acidityLevel = "acceptable";
  const acidityText = { good: "Normal", acceptable: ph < 7 ? "Slightly acidic" : "Slightly alkaline", unsafe: ph < 7 ? "Too acidic" : "Too alkaline" }[acidityLevel];
  const acidity = part("Acidity", validated.ph, acidityLevel, acidityText);

  const mineralLevel = rate(tds, DRINKING.tds, ALLOWED.tds);
  const minerals = part("Minerals", validated.tds, mineralLevel, { good: "Normal", acceptable: "A little high", unsafe: "Too high" }[mineralLevel]);

  const clarityLevel = rate(turbidity, DRINKING.turbidity, ALLOWED.turbidity);
  const clarity = part("Clarity", validated.turbidity, clarityLevel, { good: "Clear", acceptable: "Slightly cloudy", unsafe: "Cloudy" }[clarityLevel]);

  const parts = [acidity, minerals, clarity];
  const checked = parts.filter((item) => item.validated);
  const implausible = (validated.ph && (ph <= 0.5 || ph >= 13.5)) || (validated.tds && tds > 5000) || (validated.turbidity && turbidity > 800);
  const level = implausible ? "unknown" : checked.some((item) => item.level === "unsafe") ? "unsafe" : checked.some((item) => item.level === "acceptable") ? "acceptable" : "good";

  const problems = checked.filter((item) => item.level !== "good").map((item) => item.text.toLowerCase());
  const unchecked = parts.length - checked.length;
  let sentence = {
    good: "The water is fine to supply.",
    acceptable: `Fine for the prototype: ${problems.join(", ")}.`,
    unsafe: `Problem: ${problems.join(", ")}. Supply to the houses is held.`,
    unknown: "A validated sensor gives readings real water cannot. It is unplugged or needs calibrating again."
  }[level];
  if (!checked.length) {
    sentence = "Counted as good for the prototype. The sensors are not validated yet, so their readings are shown but not used.";
  } else if (unchecked && level === "good") {
    sentence = `The validated ${checked.length === 1 ? "sensor finds" : "sensors find"} the water fine to supply.`;
  }

  return { level, ...labels[level], sentence, parts, validatedCount: checked.length, numbers: { ph, tds, turbidity } };
}
