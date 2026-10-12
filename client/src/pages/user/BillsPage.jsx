import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";

export default function BillsPage() {
  const [bills, setBills] = useState(null);

  useLive(() => api.get("/user/bills").then(({ data }) => setBills(data.bills || [])), ["billing:update"], 60000);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Bills" description="Your monthly water bills." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(bills || []).map((bill) => (
          <div key={bill.id} className="panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{bill.month}</p>
              <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Pending"}</StatusPill>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">{formatMoney(bill.total_amount)}</p>
            <p className="mt-1 text-sm text-slate-500">{bill.total_usage} L used</p>
            <Link to={`/user/bill-details/${bill.id}`} className="btn-secondary mt-4 w-full">View bill</Link>
          </div>
        ))}
      </div>
      {bills === null ? <p className="text-sm text-slate-500">Loading bills...</p> : null}
      {bills && !bills.length ? <div className="panel p-5 text-sm text-slate-500">No bill has been generated for your connection yet.</div> : null}
    </div>
  );
}
