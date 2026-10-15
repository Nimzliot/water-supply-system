import { createHash } from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitSystemUpdate } from "../lib/socket.js";
import { httpError } from "../utils/httpError.js";

// Where each part of the network sits on the map, as [latitude, longitude]. Saved in
// control_state.map_layout (migration 007). The admin places the parts on the Live Map page.
export const MAP_POINTS = ["borewell", "pump", "tank", "mainValve", "house1", "house2"];

// The pipe runs, in the direction water flows.
export const PIPE_SEGMENTS = [
  { key: "suction", from: "borewell", to: "pump" },
  { key: "delivery", from: "pump", to: "tank" },
  { key: "outlet", from: "tank", to: "mainValve" },
  { key: "branch1", from: "mainValve", to: "house1" },
  { key: "branch2", from: "mainValve", to: "house2" }
];

const MAP_HELP = "Saving the map needs supabase/migrations/007_map_layout.sql. Run it in the Supabase SQL editor.";

// Central Rajapalayam (near T.P. Mills Road), Virudhunagar district, Tamil Nadu: a block where
// every pipe run can follow real streets.
const RAJAPALAYAM = [9.4535, 77.559];

// Used until the admin saves a layout: the parts spread over a few streets of Rajapalayam.
export function defaultLayout(center = RAJAPALAYAM) {
  const [lat, lng] = center;
  return {
    center,
    zoom: 17,
    points: {
      borewell: [lat - 0.0012, lng - 0.0016],
      pump: [lat - 0.00105, lng - 0.00128],
      tank: [lat - 0.0004, lng - 0.0006],
      mainValve: [lat, lng],
      house1: [lat + 0.001, lng + 0.0011],
      house2: [lat - 0.0009, lng + 0.0014]
    }
  };
}

// ---------------------------------------------------------------------------
// Pipe routes
// ---------------------------------------------------------------------------

// Metres between two [lat, lng] points.
function metres([lat1, lng1], [lat2, lng2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lineLength(line) {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += metres(line[i - 1], line[i]);
  return total;
}

// Two straight runs at a right angle, the way a pipe is laid where there is no road to follow.
function bendRoute(from, to) {
  return [from, [from[0], to[1]], to];
}

// The pipe follows the streets: from the part to the nearest road, along the roads, then off the
// road to the next part. Road geometry comes from OpenStreetMap through the public OSRM router.
async function roadRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const response = await fetch(url, { headers: { "User-Agent": "water-distribution-prototype" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`router ${response.status}`);
  const body = await response.json();
  const coordinates = body.routes?.[0]?.geometry?.coordinates;
  if (body.code !== "Ok" || !coordinates?.length) throw new Error(`router ${body.code}`);

  const road = coordinates.map(([lng, lat]) => [lat, lng]);
  const line = [from, ...road, to];
  // A road route far longer than the gap (a one-way loop, a far road) is not how a pipe is laid.
  const direct = metres(from, to);
  if (lineLength(line) > direct * 3 + 150) throw new Error("detour");
  return line;
}

async function routeSegment(from, to) {
  if (metres(from, to) < 25) return { line: bendRoute(from, to), source: "bend" };
  try {
    return { line: await roadRoute(from, to), source: "road" };
  } catch {
    return { line: bendRoute(from, to), source: "bend" };
  }
}

const routeCache = new Map();

// Every pipe's route for these positions. Cached, so the router is asked once per layout.
export async function buildRoutes(points) {
  const key = createHash("sha1").update(JSON.stringify(points)).digest("hex");
  if (routeCache.has(key)) return routeCache.get(key);

  const entries = await Promise.all(
    PIPE_SEGMENTS.map(async (segment) => [segment.key, await routeSegment(points[segment.from], points[segment.to])])
  );
  const routes = Object.fromEntries(entries);
  if (routeCache.size > 50) routeCache.clear();
  routeCache.set(key, routes);
  return routes;
}

// ---------------------------------------------------------------------------
// Stored layout
// ---------------------------------------------------------------------------

function isMissingColumn(error) {
  return ["42703", "PGRST204"].includes(error?.code);
}

function validPoints(points) {
  return points && MAP_POINTS.every((key) => Array.isArray(points[key]));
}

export async function getMapLayout() {
  const { data, error } = await supabaseAdmin.from("control_state").select("map_layout").eq("id", 1).maybeSingle();
  if (error && !isMissingColumn(error) && error.code !== "PGRST205" && error.code !== "42P01") throw error;

  const saved = data?.map_layout;
  const layout = validPoints(saved?.points) ? saved : defaultLayout();
  // Routes saved with the layout are reused; older layouts get theirs worked out now.
  const routes = saved?.routes && validPoints(saved?.points) ? saved.routes : await buildRoutes(layout.points);
  return { layout: { ...layout, routes }, saved: validPoints(saved?.points), can_save: !error, help: error ? MAP_HELP : "" };
}

// Routes for positions that are being edited, so the pipes follow the roads before saving.
export async function previewRoutes(points) {
  return { routes: await buildRoutes(points) };
}

export async function saveMapLayout({ center, zoom, points }) {
  const routes = await buildRoutes(points);
  const layout = { center, zoom, points, routes };
  const { data, error } = await supabaseAdmin
    .from("control_state")
    .upsert({ id: 1, map_layout: layout, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("map_layout")
    .single();

  if (error) {
    if (isMissingColumn(error)) throw httpError(StatusCodes.SERVICE_UNAVAILABLE, MAP_HELP);
    throw error;
  }
  emitSystemUpdate({ type: "map", data: data.map_layout });
  return { layout: data.map_layout, saved: true, can_save: true };
}
