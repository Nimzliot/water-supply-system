import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import PageHeader from "../../components/PageHeader";
import NotificationList from "../../components/NotificationList";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);

  useLive(
    () => api.get("/admin/notifications").then(({ data }) => setNotifications(data.notifications || [])),
    ["alert:new", "system:update", "request:update", "support:update"],
    30000
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Notifications" description="Everything that currently needs an operator: leaks, faults, offline devices, and household requests." />
      <NotificationList notifications={notifications || []} loading={notifications === null} />
    </div>
  );
}
