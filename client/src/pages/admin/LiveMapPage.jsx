import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LayersControl, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import api from "../../lib/api";
import { MIN_FLOW_LPM, useController } from "../../lib/useController";
import { errorMessage, formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

// The 3D map carries its own large library, so it loads only when chosen.
const Map3D = lazy(() => import("../../components/map/Map3D"));

const savedMode = () => {
  try {
    return localStorage.getItem("live_map_mode") === "2d" ? "2d" : "3d";
  } catch {
    return "3d";
  }
};

// The network on a real map of Rajapalayam. Pipes follow the streets (routed by the server from
// OpenStreetMap roads) with right-angle bends where there is no road. The admin places each part
// once (Edit positions); from then on everything follows the hardware: water runs along a pipe
// only while the controller reports it flowing, faster for a higher measured flow.

const ICONS = {
  fan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 12c0-3 1-6 4-7 2 3 0 6-4 7Z"/><path d="M12 12c3 0 6 1 7 4-3 2-6 0-7-4Z"/><path d="M12 12c0 3-1 6-4 7-2-3 0-6 4-7Z"/><path d="M12 12c-3 0-6-1-7-4 3-2 6 0 7 4Z"/></svg>',
  valve: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 7v10l8-5Z"/><path d="M20 7v10l-8-5Z"/><path d="M12 12V4"/><path d="M8 4h8"/></svg>',
  house: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  well: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/></svg>'
};

function nodeIcon({ svg, state = "", size = 44 }) {
  return L.divIcon({ className: "map-pin", html: `<div class="map-node ${state}">${svg}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function tankIcon(percent, fault, online) {
  const shown = online && !fault ? Math.round(percent) : null;
  return L.divIcon({
    className: "map-pin",
    html: `<div class="map-tank ${fault ? "is-fault" : ""}"><div class="map-tank-fill" style="height:${shown ?? 0}%"></div><span>${shown === null ? (fault ? "?" : "--") : `${shown}%`}</span></div>`,
    iconSize: [46, 56],
    iconAnchor: [23, 28]
  });
}

const LABELS = { borewell: "Borewell", pump: "Pump", tank: "Overhead tank", mainValve: "Main valve", house1: "House 1", house2: "House 2" };
const SEGMENTS = [
  { key: "suction", from: "borewell", to: "pump" },
  { key: "delivery", from: "pump", to: "tank" },
  { key: "outlet", from: "tank", to: "mainValve" },
  { key: "branch1", from: "mainValve", to: "house1" },
  { key: "branch2", from: "mainValve", to: "house2" }
];

// Distance along a route, and the point at a given distance along it.
function measure(map, line) {
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + map.distance(line[i - 1], line[i]));
  return along;
}

function pointAlong(line, along, distance) {
  let i = 1;
  while (i < along.length - 1 && along[i] < distance) i++;
  const span = along[i] - along[i - 1] || 1;
  const t = Math.min(Math.max((distance - along[i - 1]) / span, 0), 1);
  return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
}

// Water droplets travelling along a pipe while it flows. Speed follows the measured flow.
function FlowDroplets({ line, flowing, lpm }) {
  const map = useMap();
  const rate = Math.round(Number(lpm) || 0);

  useEffect(() => {
    if (!flowing || line.length < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const along = measure(map, line);
    const total = along[along.length - 1];
    if (total < 2) return undefined;

    const count = Math.min(16, Math.max(3, Math.round(total / 16)));
    const metresPerSecond = 10 + Math.min(rate || 4, 25) * 2;
    const drops = Array.from({ length: count }, () =>
      L.circleMarker(line[0], { radius: 3.4, color: "#0369a1", weight: 1.2, fillColor: "#e0f2fe", fillOpacity: 1, interactive: false }).addTo(map)
    );

    const started = performance.now();
    let frame;
    const tick = (now) => {
      const offset = (((now - started) / 1000) * metresPerSecond) % total;
      drops.forEach((drop, index) => drop.setLatLng(pointAlong(line, along, (offset + (index * total) / count) % total)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      drops.forEach((drop) => drop.remove());
    };
  }, [map, line, flowing, rate]);

  return null;
}

// A pipe: dark casing, a body that turns water-blue when full and flowing, and moving ripples.
function Pipe({ line, flowing, fast, lpm, tooltip }) {
  return (
    <>
      <Polyline positions={line} pathOptions={{ color: "#1e293b", weight: 12, opacity: 0.5, lineCap: "round", lineJoin: "round" }}>
        <Tooltip sticky>{tooltip}</Tooltip>
      </Polyline>
      <Polyline positions={line} pathOptions={{ color: flowing ? "#0284c7" : "#94a3b8", weight: 7, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }} />
      {flowing ? (
        <Polyline
          key={`ripple-${fast}`}
          positions={line}
          pathOptions={{ color: "#bae6fd", weight: 3, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false, className: `map-water ${fast ? "map-water-fast" : ""}` }}
        />
      ) : null}
      <FlowDroplets line={line} flowing={flowing} lpm={lpm} />
    </>
  );
}

// Fits the view to the network once, when it first loads.
function FitOnce({ points }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !points) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(Object.values(points)), { padding: [70, 70], maxZoom: 19 });
  }, [map, points]);
  return null;
}

function Recenter({ request }) {
  const map = useMap();
  useEffect(() => {
    if (request) map.setView(request.center, Math.max(map.getZoom(), 17));
  }, [map, request]);
  return null;
}

// The point a short way before the end of a route: where a house's own valve sits on its pipe.
function nearEnd(line) {
  if (!line || line.length < 2) return null;
  let total = 0;
  const along = [0];
  for (let i = 1; i < line.length; i++) {
    total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    along.push(total);
  }
  return pointAlong(line, along, total * 0.82);
}

export default function LiveMapPage() {
  const { live, system } = useController();
  const [map, setMap] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routing, setRouting] = useState(false);
  const [recenter, setRecenter] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState(savedMode);
  const [satellite, setSatellite] = useState(true);
  const [preview, setPreview] = useState(false);

  const chooseMode = (next) => {
    setMode(next);
    try {
      localStorage.setItem("live_map_mode", next);
    } catch {
      // Remembering the choice is only a convenience.
    }
  };

  useEffect(() => {
    api.get("/admin/map").then(({ data }) => setMap(data)).catch((err) => setError(errorMessage(err, "Could not load the map layout.")));
  }, []);

  // Preview plays the full animation with sample readings, clearly marked, so the movement can be
  // seen while the controller is offline. Live readings take over as soon as it is switched off.
  const { houses, controller } = live;
  const online = preview || live.online;
  const meta = preview
    ? { ...(live.meta || {}), main_valve_open: true, house1_valve_open: true, house2_valve_open: true, sensor_fault: false, supply_status: "Preview: supplying water" }
    : live.meta;
  const flows = preview ? { main: 14.6, house1: 8.4, house2: 6.2 } : live.flows;
  const tankPercent = preview ? 72 : live.tankPercent;
  const pumpRunning = preview || live.pumpRunning;
  const running = online && pumpRunning;
  const house1Flow = online && flows.house1 > MIN_FLOW_LPM;
  const house2Flow = online && flows.house2 > MIN_FLOW_LPM;
  const mainFlow = online && (flows.main > MIN_FLOW_LPM || house1Flow || house2Flow);
  const mainLpm = Math.max(flows.main, flows.house1 + flows.house2);
  const fault = Boolean(meta?.sensor_fault);
  const points = map?.layout?.points;
  const routes = map?.layout?.routes || {};

  const state = {
    suction: { flowing: running, lpm: 12, text: running ? "Pumping from the borewell" : "Pump stopped" },
    delivery: { flowing: running, lpm: 12, text: running ? "Filling the tank" : "Not filling" },
    outlet: { flowing: mainFlow, lpm: mainLpm, text: mainFlow ? `${mainLpm.toFixed(1)} L/min leaving the tank` : "No flow from the tank" },
    branch1: { flowing: house1Flow, lpm: flows.house1, text: house1Flow ? `${flows.house1.toFixed(1)} L/min to house 1` : "No flow to house 1" },
    branch2: { flowing: house2Flow, lpm: flows.house2, text: house2Flow ? `${flows.house2.toFixed(1)} L/min to house 2` : "No flow to house 2" }
  };
  const lineFor = (segment) => routes[segment.key]?.line || [points[segment.from], points[segment.to]];

  const valveState = (open) => (!online ? "" : open ? "is-on" : "is-off");
  const icons = useMemo(
    () => ({
      borewell: nodeIcon({ svg: ICONS.well, state: running ? "is-water" : "" }),
      pump: nodeIcon({ svg: ICONS.fan, state: !online ? "" : running ? "is-on is-spinning" : "" }),
      tank: tankIcon(tankPercent, fault, online),
      mainValve: nodeIcon({ svg: ICONS.valve, state: valveState(meta?.main_valve_open), size: 38 }),
      house1: nodeIcon({ svg: ICONS.house, state: house1Flow ? "is-water" : houses[0]?.limitReached ? "is-off" : "" }),
      house2: nodeIcon({ svg: ICONS.house, state: house2Flow ? "is-water" : houses[1]?.limitReached ? "is-off" : "" }),
      house1Valve: nodeIcon({ svg: ICONS.valve, state: valveState(meta?.house1_valve_open), size: 30 }),
      house2Valve: nodeIcon({ svg: ICONS.valve, state: valveState(meta?.house2_valve_open), size: 30 })
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [online, running, Math.round(tankPercent), fault, meta?.main_valve_open, meta?.house1_valve_open, meta?.house2_valve_open, house1Flow, house2Flow, houses[0]?.limitReached, houses[1]?.limitReached]
  );

  const labelFor = (key) => {
    if (key === "house1" || key === "house2") {
      const house = houses[key === "house1" ? 0 : 1];
      const name = house?.label || LABELS[key];
      if (!online) return `${name} · offline`;
      return `${name} · ${(house?.litersToday ?? 0).toFixed(1)} L today`;
    }
    if (key === "tank") return !online ? "Tank · offline" : fault ? "Tank · sensor fault" : `Tank · ${Math.round(tankPercent)}%`;
    if (key === "pump") return !online ? "Pump · offline" : `Pump · ${running ? "running" : "stopped"}`;
    if (key === "mainValve") return !online ? "Main valve" : `Main valve · ${meta?.main_valve_open ? "open" : "closed"}`;
    return LABELS[key];
  };

  // Re-routes the pipes along the roads for the new positions.
  const reroute = async (nextPoints) => {
    try {
      setRouting(true);
      const { data } = await api.post("/admin/map/routes", { points: nextPoints });
      setMap((current) => ({ ...current, layout: { ...current.layout, routes: data.routes } }));
    } catch (err) {
      setError(errorMessage(err, "Could not route the pipes along the roads."));
    } finally {
      setRouting(false);
    }
  };

  const movePoint = (key, latLng) => {
    const nextPoints = { ...map.layout.points, [key]: [latLng.lat, latLng.lng] };
    setMap((current) => ({ ...current, layout: { ...current.layout, points: nextPoints } }));
    reroute(nextPoints);
  };

  // Moves the whole network so its centre sits at this device's location.
  const useMyLocation = () => {
    setError("");
    if (!navigator.geolocation) return setError("This browser cannot share its location.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const [lat0, lng0] = map.layout.center;
        const dLat = coords.latitude - lat0;
        const dLng = coords.longitude - lng0;
        const moved = Object.fromEntries(Object.entries(map.layout.points).map(([key, [lat, lng]]) => [key, [lat + dLat, lng + dLng]]));
        const center = [coords.latitude, coords.longitude];
        setMap((current) => ({ ...current, layout: { ...current.layout, center, points: moved } }));
        setRecenter({ center, at: Date.now() });
        reroute(moved);
        setEditing(true);
        setMessage("The network was moved to your location. Drag each part to its real place, then press Save layout.");
      },
      () => setError("Location was not shared. Allow location access for this site, or drag the parts by hand."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      const lats = Object.values(map.layout.points).map(([lat]) => lat);
      const lngs = Object.values(map.layout.points).map(([, lng]) => lng);
      const center = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
      const { data } = await api.put("/admin/map", { center, zoom: map.layout.zoom || 17, points: map.layout.points });
      setMap(data);
      setEditing(false);
      setMessage("Layout saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save the layout."));
    } finally {
      setSaving(false);
    }
  };

  const valve1 = points ? nearEnd(lineFor(SEGMENTS[3])) : null;
  const valve2 = points ? nearEnd(lineFor(SEGMENTS[4])) : null;
  const roadCount = Object.values(routes).filter((route) => route.source === "road").length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Live Map"
        description="The water network in Rajapalayam. Pipes follow the streets, and water runs along a pipe only while the controller reports it flowing."
        actions={
          <>
            <StatusPill color={preview ? "amber" : live.online ? "green" : "rose"} dot>
              {preview ? "Preview, not live" : live.online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}
            </StatusPill>
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
              {[["3d", "3D"], ["2d", "2D"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseMode(value)}
                  disabled={editing && value === "3d"}
                  className={`rounded-lg px-3.5 py-1.5 disabled:opacity-40 ${mode === value ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPreview((current) => !current)} className={preview ? "btn-primary" : "btn-secondary"}>
              {preview ? "Stop preview" : "Preview flow"}
            </button>
            {editing ? (
              <>
                <button type="button" onClick={useMyLocation} className="btn-secondary">Use my location</button>
                <button type="button" onClick={save} disabled={saving || routing} className="btn-primary disabled:opacity-60">{saving ? "Saving..." : "Save layout"}</button>
              </>
            ) : (
              <button type="button" onClick={() => { chooseMode("2d"); setEditing(true); setMessage("Drag each part to where it really is. The pipes re-route along the roads; then press Save layout."); }} className="btn-secondary" disabled={!map}>
                Edit positions
              </button>
            )}
          </>
        }
      />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>
      {preview ? (
        <Notice tone="info">Preview: this shows how the water moves through the network. It is not live data. Press Stop preview to go back to the controller's readings.</Notice>
      ) : null}
      {map && !map.saved ? (
        <Notice tone={map.can_save ? "info" : "error"}>
          {map.help || "These are suggested positions in Rajapalayam. Press Edit positions and drag each part to its real place, then save."}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem] xl:gap-5">
        <div className="panel relative isolate z-0 overflow-hidden p-0">
          <div className="h-[460px] w-full sm:h-[600px]">
            {points && mode === "3d" ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading the 3D map...</div>}>
                <Map3D
                  layout={map.layout}
                  satellite={satellite}
                  labels={Object.fromEntries(Object.keys(LABELS).map((key) => [key, labelFor(key)]))}
                  view={{
                    online,
                    running,
                    fault,
                    tankPercent,
                    valves: { main: meta?.main_valve_open, house1: meta?.house1_valve_open, house2: meta?.house2_valve_open },
                    houses: [
                      { receiving: house1Flow, limitReached: houses[0]?.limitReached },
                      { receiving: house2Flow, limitReached: houses[1]?.limitReached }
                    ],
                    flows: state
                  }}
                />
              </Suspense>
            ) : points ? (
              <MapContainer center={map.layout.center} zoom={map.layout.zoom || 17} maxZoom={20} scrollWheelZoom className="h-full w-full">
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Map">
                    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={20} />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Satellite">
                    <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={18} maxZoom={20} />
                  </LayersControl.BaseLayer>
                </LayersControl>
                <FitOnce points={points} />
                <Recenter request={recenter} />

                {SEGMENTS.map((segment) => {
                  const now = state[segment.key];
                  return (
                    <Fragment key={segment.key}>
                      <Pipe line={lineFor(segment)} flowing={now.flowing} fast={now.lpm > 8} lpm={now.lpm} tooltip={now.text} />
                    </Fragment>
                  );
                })}

                {valve1 ? (
                  <Marker position={valve1} icon={icons.house1Valve} interactive={false}>
                    <Tooltip direction="top" offset={[0, -14]} className="map-label">House 1 valve · {!online ? "--" : meta?.house1_valve_open ? "open" : "closed"}</Tooltip>
                  </Marker>
                ) : null}
                {valve2 ? (
                  <Marker position={valve2} icon={icons.house2Valve} interactive={false}>
                    <Tooltip direction="top" offset={[0, -14]} className="map-label">House 2 valve · {!online ? "--" : meta?.house2_valve_open ? "open" : "closed"}</Tooltip>
                  </Marker>
                ) : null}

                {Object.keys(LABELS).map((key) => (
                  <Marker
                    key={`${key}-${editing}`}
                    position={points[key]}
                    icon={icons[key]}
                    draggable={editing}
                    eventHandlers={{ dragend: (event) => movePoint(key, event.target.getLatLng()) }}
                  >
                    <Tooltip permanent direction="bottom" offset={[0, key === "tank" ? 30 : 24]} className="map-label">
                      {labelFor(key)}
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading the map...</div>
            )}
          </div>
          {mode === "3d" && points ? (
            <div className="absolute left-3 top-3 z-[500] flex rounded-xl bg-white p-1 text-xs font-bold shadow">
              {[["Satellite", true], ["Streets", false]].map(([label, value]) => (
                <button key={label} type="button" onClick={() => setSatellite(value)} className={`rounded-lg px-3 py-1.5 ${satellite === value ? "bg-ink text-white" : "text-slate-600"}`}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {mode === "3d" && points ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow">
              Drag to move · right-drag or two fingers to tilt and turn
            </div>
          ) : null}
          {routing ? <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow">Routing pipes along the roads...</div> : null}
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <p className="panel-title">Right now</p>
            <p className="mt-1 text-sm text-slate-600">{online ? meta?.supply_status || "Running" : "The controller is offline, so nothing is shown as flowing."}</p>
            <ul className="mt-3 space-y-2">
              {SEGMENTS.map((segment) => (
                <li key={segment.key} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${state[segment.key].flowing ? "bg-sky-500" : "bg-slate-300"}`} />
                  <span className={state[segment.key].flowing ? "font-semibold text-ink" : "text-slate-500"}>{state[segment.key].text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-5">
            <p className="panel-title">Key</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><span className="h-2 w-8 rounded-full bg-sky-600" /> Pipe full, water flowing</li>
              <li className="flex items-center gap-2"><span className="h-2 w-8 rounded-full bg-slate-400" /> Pipe, no flow</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-[3px] border-emerald-500" /> Running or open</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-[3px] border-red-500" /> Closed or limit reached</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              {roadCount} of {SEGMENTS.length} pipes follow the roads; the rest bend at right angles where no road connects. Control mode{" "}
              <b className="text-ink">{system?.control_mode === "manual" ? "Manual" : "Automatic"}</b>, pump <b className="text-ink">{system?.pump_mode || "auto"}</b>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
