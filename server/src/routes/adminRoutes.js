import { Router } from "express";
import {
  controlPump,
  controlDistribution,
  controlValve,
  createSchedule,
  generateBilling,
  generateReport,
  getAlerts,
  getAllHouses,
  getAnalytics,
  getBilling,
  getAdminDeviceStatus,
  getLpcdRequests,
  getSystem,
  setLpcd,
  updateLpcdRequestStatus
} from "../controllers/adminController.js";

const router = Router();

router.get("/houses", getAllHouses);
router.get("/billing", getBilling);
router.get("/alerts", getAlerts);
router.get("/analytics", getAnalytics);
router.get("/device-status", getAdminDeviceStatus);
router.get("/lpcd-requests", getLpcdRequests);
router.get("/system", getSystem);
router.get("/reports", generateReport);
router.post("/billing/generate", generateBilling);
router.post("/distribution", controlDistribution);
router.post("/pump", controlPump);
router.post("/valves", controlValve);
router.post("/schedules", createSchedule);
router.patch("/lpcd", setLpcd);
router.patch("/lpcd-requests/:id", updateLpcdRequestStatus);

export default router;
