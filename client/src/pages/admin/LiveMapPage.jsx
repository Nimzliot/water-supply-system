import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LayersControl, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import api from "../../lib/api";
import { MIN_FLOW_LPM, useController } from "../../lib/useController";
import { errorMessage, formatTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

// The network on a real map. The admin places each part once (Edit positions), and from then on
// the pins and pipes follow the hardware: water runs along a pipe only while it flows.

const ICONS = {
  fan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 12c0-3 1-6 4-7 2 3 0 6-4 7Z"/><path d="M12 12c3 0 6 1 7 4-3 2-6 0-7-4Z"/><path d="M12 12c0 3-1 6-4 7-2-3 0-6 4-7Z"/><path d="M12 12c-3 0-6-1-7-4 3-2 6 0 7 4Z"/></svg>',
  valve: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
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

// Fits the view to the network once, when it first loads.
function FitOnce({ points }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !points) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(Object.values(points)), { padding: [60, 60], maxZoom: 19 });
  }, [map, points]);
  return null;
}

function Recenter({ request }) {
  const map = useMap();
  useEffect(() => {
    if (request) map.setView(request.center, Math.max(map.getZoom(), 18));
  }, [map, request]);
  return null;
}

export default function LiveMapPage() {
  const { live, system } = useController();
  const [map, setMap] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recenter, setRecenter] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/map").then(({ data }) => setMap(data)).catch((err) => setError(errorMessage(err, "Could not load the map layout.")));
  }, []);

  const { online, meta, flows, houses, tankPercent, pumpRunning, controller } = live;
  const running = online && pumpRunning;
  const house1Flow = online && flows.house1 > MIN_FLOW_LPM;
  const house2Flow = online && flows.house2 > MIN_FLOW_LPM;
  const mainFlow = online && (flows.main > MIN_FLOW_LPM || house1Flow || house2Flow);
  const fault = Boolean(meta?.sensor_fault);
  const points = map?.layout?.points;

  const segments = [
    { key: "suction", from: "borewell", to: "pump", flowing: running, fast: true, text: running ? "Pumping from the borewell" : "Pump stopped" },
    { key: "delivery", from: "pump", to: "tank", flowing: running, fast: true, text: running ? "Filling the tank" : "Not filling" },
    { key: "outlet", from: "tank", to: "mainValve", flowing: mainFlow, fast: flows.main > 8, text: mainFlow ? `${flows.main.toFixed(1)} L/min leaving the tank` : "No flow from the tank" },
    { key: "branch1", from: "mainValve", to: "house1", flowing: house1Flow, fast: flows.house1 > 8, text: house1Flow ? `${flows.house1.toFixed(1)} L/min to house 1` : "No flow to house 1" },
    { key: "branch2", from: "mainValve", to: "house2", flowing: house2Flow, fast: flows.house2 > 8, text: house2Flow ? `${flows.house2.toFixed(1)} L/min to house 2` : "No flow to house 2" }
  ];

  const valveState = (open) => (!online ? "" : open ? "is-on" : "is-off");
  const icons = useMemo(
    () => ({
      borewell: nodeIcon({ svg: ICONS.well, state: running ? "is-water" : "" }),
      pump: nodeIcon({ svg: ICONS.fan, state: !online ? "" : running ? "is-on is-spinning" : "" }),
      tank: tankIcon(tankPercent, fault, online),
      mainValve: nodeIcon({ svg: ICONS.valve, state: valveState(meta?.main_valve_open), size: 38 }),
      house1: nodeIcon({ svg: ICONS.house, state: house1Flow ? "is-water" : houses[0]?.limitReached ? "is-off" : "" }),
      house2: nodeIcon({ svg: ICONS.house, state: house2Flow ? "is-water" : houses[1]?.limitReached ? "is-off" : "" })
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [online, running, Math.round(tankPercent), fault, meta?.main_valve_open, house1Flow, house2Flow, houses[0]?.limitReached, houses[1]?.limitReached]
  );

  const labelFor = (key) => {
    if (key === "house1" || key === "house2") {
      const house = houses[key === "house1" ? 0 : 1];
      const valveOpen = key === "house1" ? meta?.house1_valve_open : meta?.house2_valve_open;
      const name = house?.label || LABELS[key];
      if (!online) return `${name} · offline`;
      return `${name} · valve ${valveOpen ? "open" : "closed"} · ${(house?.litersToday ?? 0).toFixed(1)} L today`;
    }
    if (key === "tank") return !online ? "Tank · offline" : fault ? "Tank · sensor fault" : `Tank · ${Math.round(tankPercent)}%`;
    if (key === "pump") return !online ? "Pump · offline" : `Pump · ${running ? "running" : "stopped"}`;
    if (key === "mainValve") return !online ? "Main valve" : `Main valve · ${meta?.main_valve_open ? "open" : "closed"}`;
    return LABELS[key];
  };

  const movePoint = (key, latLng) => setMap((current) => ({ ...current, layout: { ...current.layout, points: { ...current.layout.points, [key]: [latLng.lat, latLng.lng] } } }));

  // Moves the whole network so its centre sits at this device's location.
  const useMyLocation = () => {
    setError("");
    if (!navigator.geolocation) return setError("This browser cannot share its location.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMap((current) => {
          const [lat0, lng0] = current.layout.center;
          const dLat = coords.latitude - lat0;
          const dLng = coords.longitude - lng0;
          const moved = Object.fromEntries(Object.entries(current.layout.points).map(([key, [lat, lng]]) => [key, [lat + dLat, lng + dLng]]));
          const center = [coords.latitude, coords.longitude];
          setRecenter({ center, at: Date.now() });
          return { ...current, layout: { ...current.layout, center, points: moved } };
        });
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
      const { data } = await api.put("/admin/map", { ...map.layout, center, zoom: map.layout.zoom || 18 });
      setMap(data);
      setEditing(false);
      setMessage("Layout saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save the layout."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Live Map"
        description="The borewell, pump, tank, valves and houses on the map. Water runs along a pipe only while it really flows."
        actions={
          <>
            <StatusPill color={online ? "green" : "rose"} dot>{online ? `Live · ${formatTime(controller.last_seen_at)}` : "Controller offline"}</StatusPill>
            {editing ? (
              <>
                <button type="button" onClick={useMyLocation} className="btn-secondary">Use my location</button>
                <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Saving..." : "Save layout"}</button>
              </>
            ) : (
              <button type="button" onClick={() => { setEditing(true); setMessage("Drag each part to where it really is, then press Save layout."); }} className="btn-secondary" disabled={!map}>
                Edit positions
              </button>
            )}
          </>
        }
      />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>
      {map && !map.saved ? (
        <Notice tone={map.can_save ? "info" : "error"}>
          {map.help || "These are placeholder positions. Press Edit positions, then Use my location or drag each part to its real place, and save."}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem] xl:gap-5">
        <div className="panel relative isolate z-0 overflow-hidden p-0">
          <div className="h-[440px] w-full sm:h-[580px]">
            {points ? (
              <MapContainer center={map.layout.center} zoom={map.layout.zoom || 18} maxZoom={21} scrollWheelZoom className="h-full w-full">
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Map">
                    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Satellite">
                    <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={21} />
                  </LayersControl.BaseLayer>
                </LayersControl>
                <FitOnce points={points} />
                <Recenter request={recenter} />

                {segments.map((segment) => {
                  const line = [points[segment.from], points[segment.to]];
                  return (
                    <Fragment key={segment.key}>
                      <Polyline positions={line} pathOptions={{ color: "#475569", weight: 9, opacity: 0.35, lineCap: "round" }}>
                        <Tooltip sticky>{segment.text}</Tooltip>
                      </Polyline>
                      {segment.flowing ? (
                        <Polyline
                          key={`${segment.key}-${segment.fast}`}
                          positions={line}
                          pathOptions={{ color: "#0ea5e9", weight: 5, opacity: 0.95, lineCap: "round", className: `map-water ${segment.fast ? "map-water-fast" : ""}` }}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}

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
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <p className="panel-title">Right now</p>
            <p className="mt-1 text-sm text-slate-600">{online ? meta?.supply_status || "Running" : "The controller is offline, so nothing is shown as flowing."}</p>
            <ul className="mt-3 space-y-2">
              {segments.map((segment) => (
                <li key={segment.key} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.flowing ? "bg-sky-500" : "bg-slate-300"}`} />
                  <span className={segment.flowing ? "font-semibold text-ink" : "text-slate-500"}>{segment.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-5">
            <p className="panel-title">Key</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><span className="h-1.5 w-8 rounded-full bg-sky-500" /> Water flowing</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-8 rounded-full bg-slate-400/60" /> Pipe, no flow</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-[3px] border-emerald-500" /> Running or open</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-[3px] border-red-500" /> Closed or limit reached</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Control mode: <b className="text-ink">{system?.control_mode === "manual" ? "Manual" : "Automatic"}</b> · pump <b className="text-ink">{system?.pump_mode || "auto"}</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
