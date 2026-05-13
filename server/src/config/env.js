import "dotenv/config";

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[env] Missing ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  esp32SharedSecret: process.env.ESP32_SHARED_SECRET || "change-me",
  defaultTariff: Number(process.env.DEFAULT_TARIFF || 0.02),
  defaultLpcdLimit: Number(process.env.DEFAULT_LPCD_LIMIT || 135)
};

