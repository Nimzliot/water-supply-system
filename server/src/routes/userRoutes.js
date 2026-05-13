import { Router } from "express";
import { getBills, getConsumptionHistory, getDashboard, getUsage, getUserDeviceStatus, submitLpcdRequest } from "../controllers/userController.js";

const router = Router();

router.get("/dashboard", getDashboard);
router.get("/device-status", getUserDeviceStatus);
router.get("/usage", getUsage);
router.get("/history", getConsumptionHistory);
router.get("/bills", getBills);
router.post("/lpcd-requests", submitLpcdRequest);

export default router;
