import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="System alerts, faults, and maintenance reminders"
        description="Unified inbox for leakage alerts, pump faults, distribution warnings, and operator reminders."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <FeatureListCard title="Critical Alerts" tone="alert" items={["Leakage detected in Street Zone A", "Tank nearing overflow threshold", "Valve response delay reported"]} />
        <FeatureListCard title="Warnings" tone="info" items={["Household 22 nearing LPCD limit", "Pump runtime higher than daily average", "Wi-Fi signal unstable at sensor node 3"]} />
        <FeatureListCard title="Maintenance" items={["Schedule ultrasonic sensor calibration", "Inspect relay panel enclosure", "Verify backup power for pump controller"]} />
      </div>
    </div>
  );
}

