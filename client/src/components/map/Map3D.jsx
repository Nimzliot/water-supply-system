import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// The water network as 3D models standing on a tilted satellite map. The tank, pump house,
// borewell, valves and houses are extruded at their real positions; pipes follow the routed
// streets. Everything moves from the live state passed in: the tank water rises to the measured
// level, the pump fan spins while it runs, and droplets travel along every pipe that flows.

const METRES_PER_DEG = 111320;
// The models are drawn larger than life so they read clearly with the whole network on screen.
const MODEL_SCALE = 3.2;

// [lat, lng] moved by dx metres east and dy metres north, returned as [lng, lat] for MapLibre.
function offset([lat, lng], dx, dy) {
  return [lng + dx / (METRES_PER_DEG * Math.cos((lat * Math.PI) / 180)), lat + dy / METRES_PER_DEG];
}

function circle(center, size, steps = 36) {
  const radius = size * MODEL_SCALE;
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push(offset(center, Math.cos(a) * radius, Math.sin(a) * radius));
  }
  return ring;
}

function rect(center, w, d, angle = 0, ox = 0, oy = 0) {
  const [width, depth, dx, dy] = [w, d, ox, oy].map((value) => value * MODEL_SCALE);
  const corners = [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2], [-width / 2, -depth / 2]];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return corners.map(([x, y]) => offset(center, dx + x * cos - y * sin, dy + x * sin + y * cos));
}

const solid = (ring, color, base, height) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { color, base: base * MODEL_SCALE, height: height * MODEL_SCALE } });
const toLngLat = ([lat, lng]) => [lng, lat];

function metres([lat1, lng1], [lat2, lng2]) {
  const dy = (lat2 - lat1) * METRES_PER_DEG;
  const dx = (lng2 - lng1) * METRES_PER_DEG * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

function prepareRoute(line) {
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + metres(line[i - 1], line[i]));
  return { line, along, total: along[along.length - 1] };
}

function pointAt({ line, along }, distance) {
  let i = 1;
  while (i < along.length - 1 && along[i] < distance) i++;
  const span = along[i] - along[i - 1] || 1;
  const t = Math.min(Math.max((distance - along[i - 1]) / span, 0), 1);
  return [line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t, line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t];
}

// Everything that stands up on the map, rebuilt each frame for the moving parts.
function buildStructures(points, valvePoints, view, level, fanAngle) {
  const features = [];
  const glass = [];
  const water = [];
  const { online } = view;

  // Borewell: a stone ring with water inside.
  features.push(solid(circle(points.borewell, 1.8), "#78716c", 0, 1.1));
  water.push(solid(circle(points.borewell, 1.25), "#0369a1", 0, 1.15));

  // Pump house: a slab, the motor (red while running), and the impeller fan on top.
  features.push(solid(rect(points.pump, 7, 5), "#475569", 0, 0.6));
  features.push(solid(rect(points.pump, 4.2, 2.6), online && view.running ? "#e23744" : "#94a3b8", 0.6, 2.8));
  for (let blade = 0; blade < 3; blade++) {
    features.push(solid(rect(points.pump, 4.6, 0.6, fanAngle + (blade * Math.PI) / 3), "#f1f5f9", 2.9, 3.15));
  }

  // Overhead tank on four legs: platform, glass shell, and the water inside at the measured level.
  for (const [dx, dy] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]]) {
    features.push(solid(rect(points.tank, 0.9, 0.9, 0, dx, dy), "#475569", 0, 9));
  }
  features.push(solid(rect(points.tank, 10, 10), "#334155", 9, 9.6));
  glass.push(solid(circle(points.tank, 5.2), view.fault ? "#fca5a5" : "#e2e8f0", 9.6, 19.6));
  if (online && !view.fault) water.push(solid(circle(points.tank, 4.9), "#0ea5e9", 9.7, 9.7 + Math.max(0.15, (level / 100) * 9.7)));
  features.push(solid(circle(points.tank, 5.4), "#94a3b8", 19.6, 19.9));

  // Valves: a body on the pipe and a hand wheel, green when open and red when closed.
  const valve = (point, open) => {
    if (!point) return;
    const color = !online ? "#94a3b8" : open ? "#10b981" : "#ef4444";
    features.push(solid(rect(point, 2.2, 2.2), "#334155", 0, 1.2));
    features.push(solid(circle(point, 1.1, 16), color, 1.6, 1.9));
  };
  valve(points.mainValve, view.valves.main);
  valve(valvePoints.house1, view.valves.house1);
  valve(valvePoints.house2, view.valves.house2);

  // Houses: walls, a red roof slab, and the black water tank on the roof that glows blue while filling.
  [["house1", 0], ["house2", 1]].forEach(([key, index]) => {
    const house = view.houses[index] || {};
    features.push(solid(rect(points[key], 12, 9), "#f8fafc", 0, 6));
    features.push(solid(rect(points[key], 13, 10), house.limitReached ? "#d97706" : "#e23744", 6, 7));
    features.push(solid(circle(points[key], 1.4, 20), house.receiving ? "#0ea5e9" : "#1e293b", 7, 9.4));
  });

  return {
    solid: { type: "FeatureCollection", features },
    glass: { type: "FeatureCollection", features: glass },
    water: { type: "FeatureCollection", features: water }
  };
}

const EMPTY = { type: "FeatureCollection", features: [] };

// Ripples travelling along the water: one dash pattern per frame step.
const DASHES = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];

export default function Map3D({ layout, view, satellite = true, labels = {} }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const viewRef = useRef(view);
  const labelRefs = useRef({});
  const [ready, setReady] = useState(false);
  viewRef.current = view;

  const points = layout.points;
  const routes = layout.routes || {};

  // The map itself, created once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "Tiles &copy; Esri" },
          streets: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "&copy; OpenStreetMap contributors" }
        },
        layers: [
          { id: "satellite", type: "raster", source: "satellite" },
          { id: "streets", type: "raster", source: "streets", layout: { visibility: "none" } }
        ]
      },
      center: toLngLat(layout.center),
      zoom: 17.5,
      pitch: 60,
      bearing: -25,
      maxPitch: 78,
      antialias: true,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("pipes", { type: "geojson", data: EMPTY });
      map.addSource("drops", { type: "geojson", data: EMPTY });
      map.addSource("solid", { type: "geojson", data: EMPTY });
      map.addSource("glass", { type: "geojson", data: EMPTY });
      map.addSource("water", { type: "geojson", data: EMPTY });

      const width = (near, far) => ["interpolate", ["linear"], ["zoom"], 15, near, 20, far];
      map.addLayer({ id: "pipe-casing", type: "line", source: "pipes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0f172a", "line-opacity": 0.65, "line-width": width(4, 16) } });
      map.addLayer({ id: "pipe-body", type: "line", source: "pipes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["case", ["get", "flowing"], "#0284c7", "#94a3b8"], "line-width": width(2.5, 11) } });
      map.addLayer({ id: "pipe-flow", type: "line", source: "pipes", filter: ["==", ["get", "flowing"], true], layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#e0f2fe", "line-opacity": 0.9, "line-width": width(1.2, 5), "line-dasharray": DASHES[0] } });
      map.addLayer({ id: "drops", type: "circle", source: "drops", paint: { "circle-radius": width(1.6, 6.5), "circle-color": "#f0f9ff", "circle-stroke-color": "#0369a1", "circle-stroke-width": 1.2 } });
      map.addLayer({ id: "solid", type: "fill-extrusion", source: "solid", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.96 } });
      map.addLayer({ id: "water", type: "fill-extrusion", source: "water", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.88 } });
      map.addLayer({ id: "glass", type: "fill-extrusion", source: "glass", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.32 } });

      const bounds = new maplibregl.LngLatBounds();
      Object.values(points).forEach((point) => bounds.extend(toLngLat(point)));
      map.fitBounds(bounds, { padding: 70, pitch: 60, bearing: -25, duration: 0, maxZoom: 18.5 });
      setReady(true);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("satellite", "visibility", satellite ? "visible" : "none");
    map.setLayoutProperty("streets", "visibility", satellite ? "none" : "visible");
  }, [ready, satellite]);

  // Labels as DOM markers standing at each part.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return undefined;
    const markers = Object.keys(labels).map((key) => {
      const element = document.createElement("div");
      element.className = "map3d-label";
      labelRefs.current[key] = element;
      // The borewell stands next to the pump, so its label sits to the left to keep both readable.
      const anchor = key === "borewell" ? "right" : "bottom";
      const shift = key === "borewell" ? [-16, 0] : [0, key === "tank" ? -70 : -28];
      return new maplibregl.Marker({ element, anchor, offset: shift }).setLngLat(toLngLat(points[key])).addTo(map);
    });
    return () => markers.forEach((marker) => marker.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(points)]);

  useEffect(() => {
    Object.entries(labels).forEach(([key, text]) => {
      if (labelRefs.current[key]) labelRefs.current[key].textContent = text;
    });
  });

  // The animation: water level, fan, droplets and ripples, every frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return undefined;

    const segments = Object.entries(routes).map(([key, route]) => ({ key, ...prepareRoute(route.line) }));
    const valvePoints = {};
    for (const [key, routeKey] of [["house1", "branch1"], ["house2", "branch2"]]) {
      const segment = segments.find((item) => item.key === routeKey);
      if (segment) {
        const [lng, lat] = pointAt(segment, segment.total * 0.82);
        valvePoints[key] = [lat, lng];
      }
    }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let level = viewRef.current.tankPercent || 0;
    let fanAngle = 0;
    let dashStep = 0;
    let lastDash = 0;
    let lastFrame = performance.now();
    let frame;

    const tick = (now) => {
      const seconds = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      const current = viewRef.current;

      level += ((current.tankPercent || 0) - level) * Math.min(1, seconds * 1.5);
      if (current.online && current.running && !reduceMotion) fanAngle += seconds * 9;

      map.getSource("pipes")?.setData({
        type: "FeatureCollection",
        features: segments.map((segment) => ({ type: "Feature", geometry: { type: "LineString", coordinates: segment.line.map(toLngLat) }, properties: { flowing: Boolean(current.flows[segment.key]?.flowing) } }))
      });

      const drops = [];
      if (!reduceMotion) {
        for (const segment of segments) {
          const flow = current.flows[segment.key];
          if (!flow?.flowing || segment.total < 2) continue;
          const count = Math.min(18, Math.max(3, Math.round(segment.total / 14)));
          const speed = 9 + Math.min(Number(flow.lpm) || 4, 25) * 1.8;
          const shift = ((now / 1000) * speed) % segment.total;
          for (let i = 0; i < count; i++) {
            drops.push({ type: "Feature", geometry: { type: "Point", coordinates: pointAt(segment, (shift + (i * segment.total) / count) % segment.total) }, properties: {} });
          }
        }
      }
      map.getSource("drops")?.setData({ type: "FeatureCollection", features: drops });

      if (!reduceMotion && now - lastDash > 70) {
        lastDash = now;
        dashStep = (dashStep + 1) % DASHES.length;
        map.setPaintProperty("pipe-flow", "line-dasharray", DASHES[dashStep]);
      }

      const built = buildStructures(points, valvePoints, current, level, fanAngle);
      map.getSource("solid")?.setData(built.solid);
      map.getSource("glass")?.setData(built.glass);
      map.getSource("water")?.setData(built.water);

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(points), JSON.stringify(routes)]);

  return <div ref={container} className="h-full w-full" />;
}
