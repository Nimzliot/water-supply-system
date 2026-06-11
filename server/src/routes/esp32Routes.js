import { Router } from "express";
import { sendLeakageAlert, updatePumpState, uploadFlow, uploadHeartbeat, uploadTankLevel, uploadWaterQuality, fetchCommands } from "../controllers/esp32Controller.js";

const router = Router();

router.post("/tank-level", uploadTankLevel);
router.post("/flow", uploadFlow);
router.post("/pump-state", updatePumpState);
router.post("/leakage", sendLeakageAlert);
router.post("/heartbeat", uploadHeartbeat);
router.post("/water-quality", uploadWaterQuality);
router.post("/commands", fetchCommands);

export default router;
