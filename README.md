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
2. Run `supabase/schema.sql`.
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
