import { Server } from "socket.io";
import { env } from "../config/env.js";
import { supabase, supabaseAdmin } from "./supabase.js";

let io;

const ADMIN_ROOM = "admins";
const houseRoom = (serviceNumber) => `house:${serviceNumber}`;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: env.clientOrigins,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const { data, error } = token ? await supabase.auth.getUser(token) : { data: null, error: true };
      if (error || !data?.user) {
        return next(new Error("Unauthorized"));
      }

      const { data: profile } = await supabaseAdmin.from("users").select("role, service_number").eq("id", data.user.id).maybeSingle();
      if (!profile) {
        return next(new Error("Unauthorized"));
      }

      // Everyone gets system-wide updates. Household readings only reach the admins and that household.
      socket.join("operations");
      socket.join(profile.role === "admin" ? ADMIN_ROOM : houseRoom(profile.service_number));
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true });
  });

  return io;
}

export function getIo() {
  if (!io) {
    throw new Error("Socket.io has not been initialized");
  }
  return io;
}

export function emitSystemUpdate(payload) {
  if (io) {
    io.to("operations").emit("system:update", payload);
  }
}

export function emitAlert(payload) {
  if (io) {
    io.to("operations").emit("alert:new", payload);
  }
}

export function emitBillingUpdate(payload) {
  if (io) {
    io.to("operations").emit("billing:update", payload);
  }
}

// A heartbeat. The controller's goes to everyone; a household device's only to the admins and that household.
export function emitDeviceUpdate(device) {
  if (!io) return;
  if (device.service_number) {
    io.to(ADMIN_ROOM).to(houseRoom(device.service_number)).emit("device:update", device);
  } else {
    io.to("operations").emit("device:update", device);
  }
}

// Something changed for one household (a usage reading, a request decision, a support reply).
export function emitHouseholdEvent(serviceNumber, event, payload) {
  if (!io) return;
  const target = serviceNumber ? io.to(ADMIN_ROOM).to(houseRoom(serviceNumber)) : io.to(ADMIN_ROOM);
  target.emit(event, payload);
}
