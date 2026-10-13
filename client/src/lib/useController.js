import { useState } from "react";
import api from "./api";
import { useLive } from "./useLive";

// Below this a flow sensor's reading is treated as no flow.
export const MIN_FLOW_LPM = 0.05;

// Picks the live state the drawings need out of the system snapshot and the device list.
// Everything is null or false while the controller is offline, so nothing is drawn as
// running on the strength of an old reading.
export function describeLiveState(system, devices = []) {
  const controller = system?.controller || devices.find((device) => device.device_key === "SYSTEM-ESP32") || null;
  const online = Boolean(controller?.is_online);
  const meta = online ? controller.meta || {} : null;

  // The firmware's house 1 and house 2 are its two service numbers in order.
  const houses = devices
    .filter((device) => device.scope === "user" || device.service_number)
    .sort((a, b) => String(a.service_number).localeCompare(String(b.service_number)))
    .slice(0, 2)
    .map((device) => ({
      label: device.service_number,
      online: Boolean(device.is_online),
      flow: device.is_online ? Number(device.meta?.flow_lpm || 0) : 0,
      litersToday: device.is_online ? Number(device.meta?.liters_today || 0) : null,
      limitReached: Boolean(device.is_online && device.meta?.limit_reached)
    }));

  return {
    controller,
    online,
    meta,
    houses,
    tankPercent: Number(meta?.tank_percentage ?? system?.tank_percentage ?? 0),
    pumpRunning: Boolean(meta?.pump_status),
    flows: {
      main: meta ? Number(meta.main_flow_lpm || 0) : 0,
      house1: houses[0]?.flow || 0,
      house2: houses[1]?.flow || 0
    }
  };
}

// Loads the system snapshot and device list, and keeps both fresh from the controller's
// heartbeats so the drawings follow the hardware within a few seconds.
export function useController() {
  const [system, setSystem] = useState(null);
  const [devices, setDevices] = useState([]);

  const reload = () =>
    Promise.all([
      api.get("/admin/system").then(({ data }) => setSystem(data.system)),
      api.get("/admin/device-status").then(({ data }) => setDevices(data.devices || []))
    ]);

  useLive(reload, ["system:update", "device:update"], 10000);

  return { system, setSystem, devices, reload, live: describeLiveState(system, devices) };
}

// How fast water is drawn moving along a pipe: quicker for a higher measured flow.
export function flowDuration(litersPerMinute) {
  const seconds = 1.5 - Math.min(Number(litersPerMinute) || 0, 25) * 0.045;
  return `${Math.max(0.35, seconds).toFixed(2)}s`;
}
