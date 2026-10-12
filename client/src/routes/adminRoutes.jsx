import { Navigate, Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminDashboard from "../pages/admin/AdminDashboard";
import HouseholdsPage from "../pages/admin/HouseholdsPage";
import HouseholdDetailsPage from "../pages/admin/HouseholdDetailsPage";
import TankMonitoringPage from "../pages/admin/TankMonitoringPage";
import WaterDistributionPage from "../pages/admin/WaterDistributionPage";
import PumpControlPage from "../pages/admin/PumpControlPage";
import ValveControlPage from "../pages/admin/ValveControlPage";
import AlertsPage from "../pages/admin/AlertsPage";
import BillingPage from "../pages/admin/BillingPage";
import AnalyticsPage from "../pages/admin/AnalyticsPage";
import ReportsPage from "../pages/admin/ReportsPage";
import SchedulesPage from "../pages/admin/SchedulesPage";
import RequestsPage from "../pages/admin/RequestsPage";
import NotificationsPage from "../pages/admin/NotificationsPage";
import AiPredictionsPage from "../pages/admin/AiPredictionsPage";
import SupportTicketsPage from "../pages/admin/SupportTicketsPage";
import SystemControlsPage from "../pages/admin/SystemControlsPage";
import SystemHealthPage from "../pages/admin/SystemHealthPage";
import UsersPage from "../pages/admin/UsersPage";
import SettingsPage from "../pages/admin/SettingsPage";
import AdminProfilePage from "../pages/admin/ProfilePage";

export function renderAdminRoutes() {
  return (
    <Route path="admin" element={<ProtectedRoute role="admin" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="households" element={<HouseholdsPage />} />
      <Route path="household-details/:id" element={<HouseholdDetailsPage />} />
      <Route path="tank-monitoring" element={<TankMonitoringPage />} />
      <Route path="water-distribution" element={<WaterDistributionPage />} />
      <Route path="pump-control" element={<PumpControlPage />} />
      <Route path="valve-control" element={<ValveControlPage />} />
      <Route path="leakage-alerts" element={<AlertsPage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="schedules" element={<SchedulesPage />} />
      <Route path="lpcd-requests" element={<RequestsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="ai-predictions" element={<AiPredictionsPage />} />
      <Route path="support" element={<SupportTicketsPage />} />
      <Route path="system-controls" element={<SystemControlsPage />} />
      <Route path="system-health" element={<SystemHealthPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="profile" element={<AdminProfilePage />} />
    </Route>
  );
}

