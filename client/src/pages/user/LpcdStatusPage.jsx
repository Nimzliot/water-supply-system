import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatLiters } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import AllowanceBar from "../../components/AllowanceBar";

export default function LpcdStatusPage() {
  const [dashboard, setDashboard] = useState(null);

  useLive(() => api.get("/user/dashboard").then(({ data }) => setDashboard(data)), ["usage:new", "request:update", "system:update"], 30000);

  if (!dashboard) {
    return <div className="text-sm text-slate-500">Loading allowance...</div>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="LPCD Status"
        description="LPCD is liters per person per day. Your household's daily limit is the allowance per person times your family members."
        actions={<Link to="/user/request-extra-water" className="btn-secondary">Request extra water</Link>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Allowance per person" value={`${dashboard.lpcdLimit} L`} hint={`${dashboard.familyMembers} family ${dashboard.familyMembers === 1 ? "member" : "members"}`} />
        <StatCard label="Used per person today" value={`${dashboard.lpcdUsed} L`} hint={`${formatLiters(dashboard.todayUsage)} for the household`} />
        <StatCard label="Household limit today" value={formatLiters(dashboard.dailyLimitLiters)} hint={dashboard.extraLitersToday > 0 ? `Includes ${formatLiters(dashboard.extraLitersToday)} extra` : "No extra water approved for today"} />
      </div>
      <AllowanceBar used={dashboard.todayUsage} limit={dashboard.dailyLimitLiters} extra={dashboard.extraLitersToday} />
    </div>
  );
}
