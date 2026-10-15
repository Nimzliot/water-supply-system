import "dotenv/config";

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[env] Missing ${key}`);
  }
}

if (!process.env.ESP32_SHARED_SECRET || process.env.ESP32_SHARED_SECRET === "change-me") {
  console.warn("[env] ESP32_SHARED_SECRET is not set to a private value. Anyone can post device telemetry.");
}

const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: clientOrigins[0],
  clientOrigins,
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  esp32SharedSecret: process.env.ESP32_SHARED_SECRET || "change-me",
  defaultTariff: Number(process.env.DEFAULT_TARIFF || 0.02),
  defaultLpcdLimit: Number(process.env.DEFAULT_LPCD_LIMIT || 135),
  timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  brevoApiKey: process.env.BREVO_API_KEY || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  // Google Gemini, for the AI assistant. Get a key at https://aistudio.google.com/apikey
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash"
};
