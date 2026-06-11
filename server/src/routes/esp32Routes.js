import { Router } from "express";
import { sendLeakageAlert, updatePumpState, uploadFlow, uploadHeartbeat, uploadTankLevel, uploadWaterQuality } from "../controllers/esp32Controller.js";

const router = Router();

router.post("/tank-level", uploadTankLevel);
router.post("/flow", uploadFlow);
router.post("/pump-state", updatePumpState);
router.post("/leakage", sendLeakageAlert);
router.post("/heartbeat", uploadHeartbeat);
router.post("/water-quality", uploadWaterQuality);

export default router;
