import { StatusCodes } from "http-status-codes";
import { supabaseAdmin } from "../lib/supabase.js";
import { emitSystemUpdate } from "../lib/socket.js";
import { httpError } from "../utils/httpError.js";

// Where each part of the network sits on the map, as [latitude, longitude]. Saved in
// control_state.map_layout (migration 007). The admin places the parts on the Live Map page.
export const MAP_POINTS = ["borewell", "pump", "tank", "mainValve", "house1", "house2"];

const MAP_HELP = "Saving the map needs supabase/migrations/007_map_layout.sql. Run it in the Supabase SQL editor.";

// Used until the admin saves a layout: the parts spread around a placeholder village centre,
// close enough together to read as one small network.
export function defaultLayout(center = [13.0827, 80.2707]) {
  const [lat, lng] = center;
  return {
    center,
    zoom: 18,
    points: {
      borewell: [lat - 0.00022, lng - 0.00062],
      pump: [lat - 0.00008, lng - 0.00046],
      tank: [lat + 0.00008, lng - 0.00024],
      mainValve: [lat + 0.00002, lng + 0.00006],
      house1: [lat + 0.00026, lng + 0.00044],
      house2: [lat - 0.00024, lng + 0.0005]
    }
  };
}

function isMissingColumn(error) {
  return ["42703", "PGRST204"].includes(error?.code);
}

export async function getMapLayout() {
  const { data, error } = await supabaseAdmin.from("control_state").select("map_layout").eq("id", 1).maybeSingle();
  if (error && !isMissingColumn(error) && error.code !== "PGRST205" && error.code !== "42P01") throw error;

  const saved = data?.map_layout;
  if (saved?.points && MAP_POINTS.every((key) => Array.isArray(saved.points[key]))) {
    return { layout: saved, saved: true, can_save: true };
  }
  return { layout: defaultLayout(), saved: false, can_save: !error, help: error ? MAP_HELP : "" };
}

export async function saveMapLayout(layout) {
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
