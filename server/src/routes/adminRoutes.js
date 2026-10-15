import { Router } from "express";
import {
  controlPump,
  controlMode,
  controlDistribution,
  controlValve,
  createSchedule,
  deleteSchedule,
  deleteUser,
  downloadReport,
  emailBill,
  sendTestEmail,
  generateBilling,
  previewBilling,
  recalculateBilling,
  resetUsageRecords,
  getAlerts,
  getAllHouses,
  getAnalytics,
  getBilling,
  getAdminDeviceStatus,
  getHouseDetails,
  getLpcdRequests,
  getNotifications,
  getSettings,
  getSupportTickets,
  getSystem,
  getUsers,
  setLpcd,
  updateAlert,
  updateBill,
  updateLpcdRequestStatus,
  updateSchedule,
  updateSettings,
  updateSupportTicket,
  updateUser
} from "../controllers/adminController.js";
import { adminAsk, adminInsight, getAiStatus, getMap, saveMap } from "../controllers/aiController.js";

const router = Router();

router.get("/ai/status", getAiStatus);
router.get("/ai/insight", adminInsight);
router.post("/ai/ask", adminAsk);
router.get("/map", getMap);
router.put("/map", saveMap);

router.get("/houses", getAllHouses);
router.get("/houses/:id", getHouseDetails);
router.get("/billing", getBilling);
router.get("/billing/preview", previewBilling);
router.get("/alerts", getAlerts);
router.get("/analytics", getAnalytics);
router.get("/device-status", getAdminDeviceStatus);
router.get("/lpcd-requests", getLpcdRequests);
router.get("/notifications", getNotifications);
router.get("/system", getSystem);
router.get("/settings", getSettings);
router.get("/reports/:type", downloadReport);
router.get("/users", getUsers);
router.get("/support", getSupportTickets);
router.post("/billing/generate", generateBilling);
router.post("/billing/recalculate", recalculateBilling);
router.post("/billing/:id/email", emailBill);
router.post("/email/test", sendTestEmail);
router.post("/usage/reset", resetUsageRecords);
router.post("/distribution", controlDistribution);
router.post("/pump", controlPump);
router.post("/control-mode", controlMode);
router.post("/valves", controlValve);
router.post("/schedules", createSchedule);
router.patch("/schedules/:id", updateSchedule);
router.delete("/schedules/:id", deleteSchedule);
router.patch("/settings", updateSettings);
router.patch("/lpcd", setLpcd);
router.patch("/alerts/:id", updateAlert);
router.patch("/billing/:id", updateBill);
router.patch("/lpcd-requests/:id", updateLpcdRequestStatus);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.patch("/support/:id", updateSupportTicket);

export default router;
