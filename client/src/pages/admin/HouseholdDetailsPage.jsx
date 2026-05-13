import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";
import StatCard from "../../components/StatCard";
import api from "../../lib/api";

export default function HouseholdDetailsPage() {
  const { id } = useParams();
  const [households, setHouseholds] = useState([]);
  const [usageRows, setUsageRows] = useState([]);
  const [bills, setBills] = useState([]);

  useEffect(() => {
    api.get("/admin/houses").then(({ data }) => setHouseholds(data.houses || []));
    api.get("/admin/analytics").then(({ data }) => {
      setUsageRows(data.rawUsage || []);
      setBills(data.rawBills || []);
    });
  }, []);

  const household = useMemo(
    () => households.find((item) => item.service_number === id || item.id === id),
    [households, id]
  );

  const householdUsage = useMemo(
    () => usageRows.filter((row) => row.user_id === household?.id),
    [usageRows, household]
  );

  const latestUsage = householdUsage[0];
  const householdBill = bills.find((bill) => bill.user_id === household?.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Household Details"
        title={`Service Connection ${id}`}
        description="Deep-dive view for service number, usage history, billing timeline, valve state, and LPCD performance."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current Flow" value={latestUsage ? `${latestUsage.liters_used} L` : "--"} hint={latestUsage ? "Latest uploaded household reading" : "No household reading yet"} />
        <StatCard label="Valve Status" value="Pending Live Signal" hint="House-level actuator feedback is not yet exposed here" accent="text-surge" />
        <StatCard label="LPCD Used" value={latestUsage ? latestUsage.lpcd_used : "--"} hint="Latest uploaded LPCD value" accent="text-sand" />
        <StatCard label="Last Bill" value={householdBill ? `Rs. ${householdBill.total_amount}` : "--"} hint={householdBill?.month || "No bill generated yet"} accent="text-aqua" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <FeatureListCard
          title="Monitoring Data"
          items={[
            household ? `Owner: ${household.name}` : "Owner profile will appear after household lookup",
            household ? `Service number: ${household.service_number}` : "Service number linked to hardware uploads",
            household ? `Family members: ${household.family_members}` : "Family size used for LPCD view",
            latestUsage ? `Latest usage timestamp: ${new Date(latestUsage.timestamp).toLocaleString()}` : "No usage history yet",
            householdBill ? `Billing month: ${householdBill.month}` : "No billing history yet"
          ]}
          tone="info"
        />
        <FeatureListCard
          title="Control Insights"
          items={[
            "Valve status should come from house-level actuator feedback",
            latestUsage ? "Usage data is arriving from the mapped service connection" : "Waiting for first hardware upload",
            "LPCD over-limit logic is enforced in firmware",
            "Field operator action can be based on live telemetry once more endpoints are added"
          ]}
        />
      </div>
    </div>
  );
}
