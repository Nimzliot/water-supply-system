# Smart Automated Rural Water Distribution System

Production-ready monorepo for a rural water automation platform with:

- `client/`: React + Tailwind dashboard for admin and households
- `server/`: Node.js + Express + Socket.io API layer
- `supabase/`: PostgreSQL schema, RLS policies, and seed guidance
- `firmware/`: ESP32 Arduino firmware for sensors, pump, and valves

## Architecture

- Supabase Auth manages user sessions and password hashing
- `public.users` stores role and household profile data
- Express exposes REST APIs for admin, household, and ESP32 traffic
- Socket.io broadcasts live tank, pump, valve, and alert updates
- React renders role-based dashboards with analytics and realtime cards

## Quick Start

1. Create a Supabase project.
2. Run `supabase/schema.sql`. On a database created from an older copy of the schema, run
   the files in `supabase/migrations` in order instead (001, 002, 003; all are safe to run
   more than once).
3. Copy `server/.env.example` to `server/.env`.
4. Copy `client/.env.example` to `client/.env`.
5. Update the ESP32 firmware configuration before flashing:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
   - `API_BASE_URL`
   - `DEVICE_SECRET`
   - household `service_number` values
6. Install dependencies from the repo root:

```bash
npm install
```

7. Start the backend and frontend in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

## How the ESP32 and the Dashboard Share Control

- The firmware polls `POST /api/esp32/commands` every few seconds and receives the pump mode,
  pump thresholds, valve switches, active schedules, and each household's limit for today
  (LPCD limit x family members + extra water approved for that day).
- Heartbeats carry the live readings (tank, pump, flow, valves, usage against the limit) and are
  pushed to the dashboards over Socket.io as they arrive.
- Password reset emails are sent by Supabase Auth. Add `<CLIENT_ORIGIN>/reset-password` to the
  redirect URLs in the Supabase Auth settings.
- Control mode is `auto` or `manual`. In automatic mode the controller runs the supply cycle
  (schedules, tank level, daily limits) and a valve switch only enables that valve for the cycle.
  In manual mode the pump and every valve follow the dashboard switches at once. Emergency
  Supply switches to manual mode and opens every valve.
- Pump mode is `auto`, `on`, or `off` (Pump Control page). It is stored in `control_state`;
  `tank_status.pump_status` is only ever the state the device reports.
- Valve switches are matched by name: `Main Distribution Valve`, `House 1 Intake Valve`,
  `House 2 Intake Valve`. A valve that is open on the dashboard is enabled; the firmware still
  opens it only while it is distributing.
- Overflow, level-sensor fault, dry-run, and leak protection run on the ESP32 and override
  every dashboard command.
- `CLIENT_ORIGIN` accepts a comma-separated list of origins. `APP_TIMEZONE` (default
  `Asia/Kolkata`) decides where "today" starts for usage totals.

## Email

The server emails households their bills, payment receipts, request decisions, and support
replies, and emails admins about new requests, support messages, and leak alerts. It stays
switched off until `server/.env` has `MAIL_FROM` and one of:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for Gmail: `smtp.gmail.com`, `587`, your
  address, and an app password), or
- `BREVO_API_KEY` (an HTTP API, for hosts that block outbound SMTP).

Use "Send me a test email" on the admin Settings page to check it.

## Billing in a Prototype

A bill is the liters a household used in the month times the tariff on the Settings page. A
bench prototype moves only a few liters, so the Settings page has prototype rates (Rs. 10 or
Rs. 50 per liter) that turn a small test into a bill worth showing.

## Suggested Supabase Auth Flow

- Create the first admin account from the Supabase dashboard or a private script.
- Household users register through the app.
- The backend creates Auth users through the Supabase Admin API and stores the profile in `public.users`.

## Deployment

- Frontend: Vercel
- Backend: Render or Railway
- Database/Auth/Storage/Realtime: Supabase

## GitHub Safety

- Do not commit real `.env` files.
- Replace firmware demo credentials with your own local network and API settings before uploading to the ESP32.
- Keep the Supabase service role key private at all times.

## Notes

- The AI module uses lightweight heuristics over historical usage and schedule patterns so it can run without a separate ML service.
- `users.password_hash` is intentionally left unused because Supabase Auth stores hashed passwords securely in `auth.users`.
