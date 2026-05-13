import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";

export default function LpcdStatusPage() {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api.get("/user/dashboard").then(({ data }) => setDashboard(data));
  }, []);

  const allowed = dashboard?.lpcdLimit || 0;
  const used = dashboard?.lpcdUsed || 0;
  const remaining = Number((allowed - used).toFixed(2));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="LPCD Status"
        title="Allowed, used, and remaining LPCD"
        description="Track consumption against your household water allowance."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Allowed LPCD" value={allowed} hint="Configured daily limit" />
        <StatCard label="Used LPCD" value={used} hint="Current measured usage" accent="text-surge" />
        <StatCard label="Remaining LPCD" value={remaining} hint="Allowed LPCD minus used LPCD" accent="text-sand" />
      </div>
    </div>
  );
}

