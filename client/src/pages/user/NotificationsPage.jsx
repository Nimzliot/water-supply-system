import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";

export default function UserNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Bill alerts, leakage warnings, and supply updates"
        description="Household notification center for billing reminders and water distribution updates."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <FeatureListCard title="Bill Alerts" items={["April bill generated", "Payment due reminder scheduled", "New tariff update pending admin confirmation"]} />
        <FeatureListCard title="Leakage Warnings" tone="alert" items={["No active household leakage alerts", "System will notify if abnormal flow is detected", "Valve auto-isolation updates appear here"]} />
        <FeatureListCard title="Distribution Updates" tone="info" items={["Morning supply begins at 06:00", "Emergency shutdown alerts appear here", "Schedule changes are pushed in-app"]} />
      </div>
    </div>
  );
}

