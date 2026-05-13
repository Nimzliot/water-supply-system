import { Server } from "socket.io";
import { env } from "../config/env.js";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: env.clientOrigin,
      credentials: true
    }
  });

  io.use((socket, next) => {
    socket.join("operations");
    next();
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
