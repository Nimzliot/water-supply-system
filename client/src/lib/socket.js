import { io } from "socket.io-client";
import { getToken } from "./api";

export const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
  autoConnect: false,
  // Read the token on every (re)connect so a refreshed session is picked up.
  auth: (callback) => callback({ token: getToken() })
});
