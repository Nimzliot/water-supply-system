import { Router } from "express";
import { sendLeakageAlert, updatePumpState, uploadFlow, uploadHeartbeat, uploadTankLevel } from "../controllers/esp32Controller.js";

const router = Router();

router.post("/tank-level", uploadTankLevel);
router.post("/flow", uploadFlow);
router.post("/pump-state", updatePumpState);
router.post("/leakage", sendLeakageAlert);
router.post("/heartbeat", uploadHeartbeat);

export default router;
