import { Router } from "express";
import {
  confirmBillPayment,
  startBillPayment,
  getBillDetails,
  getBills,
  getConsumptionHistory,
  getDashboard,
  getLpcdRequests,
  getNotifications,
  getSupportTickets,
  getUsage,
  getUserDeviceStatus,
  submitLpcdRequest,
  submitSupportTicket
} from "../controllers/userController.js";
import { getAiStatus, householdAsk } from "../controllers/aiController.js";

const router = Router();

router.get("/ai/status", getAiStatus);
router.post("/ai/ask", householdAsk);

router.get("/dashboard", getDashboard);
router.get("/device-status", getUserDeviceStatus);
router.get("/usage", getUsage);
router.get("/history", getConsumptionHistory);
router.get("/bills", getBills);
router.get("/bills/:id", getBillDetails);
router.post("/bills/:id/pay", startBillPayment);
router.post("/bills/:id/pay/confirm", confirmBillPayment);
router.get("/notifications", getNotifications);
router.get("/lpcd-requests", getLpcdRequests);
router.post("/lpcd-requests", submitLpcdRequest);
router.get("/support", getSupportTickets);
router.post("/support", submitSupportTicket);

export default router;
