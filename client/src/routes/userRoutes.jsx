import { Navigate, Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import UserDashboard from "../pages/user/UserDashboard";
import UsageHistoryPage from "../pages/user/UsageHistoryPage";
import LiveUsagePage from "../pages/user/LiveUsagePage";
import BillsPage from "../pages/user/BillsPage";
import BillDetailsPage from "../pages/user/BillDetailsPage";
import LpcdStatusPage from "../pages/user/LpcdStatusPage";
import RequestLpcdPage from "../pages/user/RequestLpcdPage";
import UserNotificationsPage from "../pages/user/NotificationsPage";
import ProfilePage from "../pages/user/ProfilePage";
import SupportPage from "../pages/user/SupportPage";
import UserSettingsPage from "../pages/user/SettingsPage";

export function renderUserRoutes() {
  return (
    <Route path="user" element={<ProtectedRoute role="user" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<UserDashboard />} />
      <Route path="usage-history" element={<UsageHistoryPage />} />
      <Route path="live-usage" element={<LiveUsagePage />} />
      <Route path="bills" element={<BillsPage />} />
      <Route path="bill-details/:id" element={<BillDetailsPage />} />
      <Route path="lpcd-status" element={<LpcdStatusPage />} />
      <Route path="request-extra-water" element={<RequestLpcdPage />} />
      <Route path="notifications" element={<UserNotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="support" element={<SupportPage />} />
      <Route path="settings" element={<UserSettingsPage />} />
    </Route>
  );
}

