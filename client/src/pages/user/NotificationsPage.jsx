import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import PageHeader from "../../components/PageHeader";
import NotificationList from "../../components/NotificationList";

export default function UserNotificationsPage() {
  const [notifications, setNotifications] = useState(null);

  useLive(
    () => api.get("/user/notifications").then(({ data }) => setNotifications(data.notifications || [])),
    ["alert:new", "billing:update", "request:update", "support:update", "usage:new"],
    30000
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Notifications" description="Supply updates, unpaid bills, and replies to your requests." />
      <NotificationList notifications={notifications || []} loading={notifications === null} />
    </div>
  );
}
