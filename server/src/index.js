import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import esp32Routes from "./routes/esp32Routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";
import { requireRole } from "./middleware/requireRole.js";
import { initSocket } from "./lib/socket.js";

const app = express();

app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "smart-water-distribution-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", authenticate, requireRole("admin"), adminRoutes);
app.use("/api/user", authenticate, requireRole("user"), userRoutes);
app.use("/api/esp32", esp32Routes);

app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});

