import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime, formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

const filters = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" }
];

const byMonthNewestFirst = (a, b) => new Date(`1 ${b.month}`) - new Date(`1 ${a.month}`);

function methodLabel(bill) {
  if (!bill.paid_status) return "Not paid yet";
  if (bill.payment_method === "razorpay") return "Online (Razorpay)";
  if (bill.payment_method === "cash") return "Cash, marked by admin";
  return "Paid";
}

// Every bill as a payment record: who owes what, what has been collected, and how it was paid.
export default function PaymentsPage() {
  const [bills, setBills] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get("/admin/billing").then(({ data }) => setBills((data.billing || []).slice().sort(byMonthNewestFirst)));
  useLive(load, ["billing:update"], 30000);

  const setPaid = async (bill, paid_status) => {
    try {
      setBusyId(bill.id);
      setError("");
      await api.patch(`/admin/billing/${bill.id}`, { paid_status });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to update the payment."));
    } finally {
      setBusyId("");
    }
  };

  const totals = useMemo(() => {
    const list = bills || [];
    const paid = list.filter((bill) => bill.paid_status);
    const pending = list.filter((bill) => !bill.paid_status);
    const sum = (items) => items.reduce((total, bill) => total + Number(bill.total_amount || 0), 0);
    return {
      collected: sum(paid),
      outstanding: sum(pending),
      online: paid.filter((bill) => bill.payment_method === "razorpay").length,
      paidCount: paid.length,
      pendingCount: pending.length
    };
  }, [bills]);

  const shown = (bills || []).filter((bill) => filter === "all" || (filter === "paid" ? bill.paid_status : !bill.paid_status));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Payments"
        description="What has been collected, what is still owed, and how each bill was paid."
        actions={<Link to="/admin/billing" className="btn-secondary">Generate bills</Link>}
      />
      <Notice tone="error">{error}</Notice>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Amount collected" value={formatMoney(totals.collected)} hint={`${totals.paidCount} paid bill${totals.paidCount === 1 ? "" : "s"}`} />
        <StatCard label="Amount outstanding" value={formatMoney(totals.outstanding)} hint={`${totals.pendingCount} pending bill${totals.pendingCount === 1 ? "" : "s"}`} accent={totals.outstanding > 0 ? "text-red-600" : undefined} />
        <StatCard label="Bills paid online" value={totals.online} hint="Through Razorpay" />
        <StatCard label="Bills paid in cash" value={totals.paidCount - totals.online} hint="Marked paid by an admin" />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === item.value ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-black/[0.06] hover:bg-slate-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="panel divide-y divide-slate-100">
        {shown.map((bill) => (
          <div key={bill.id} className="flex flex-col gap-3 p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-ink">{bill.users?.name || "Household"}</p>
                <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Pending"}</StatusPill>
                {bill.out_of_date ? <StatusPill color="rose">Out of date</StatusPill> : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {bill.users?.service_number} · {bill.month} · {bill.total_usage} L at Rs. {bill.tariff} per liter
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {methodLabel(bill)}
                {bill.paid_at ? ` · ${formatDateTime(bill.paid_at)}` : ""}
                {bill.payment_id ? ` · reference ${bill.payment_id}` : ""}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 lg:justify-end">
              <p className="text-lg font-extrabold tracking-tight tabular-nums text-ink">{formatMoney(bill.total_amount)}</p>
              <button type="button" onClick={() => setPaid(bill, !bill.paid_status)} disabled={busyId === bill.id} className={`${bill.paid_status ? "btn-secondary" : "btn-primary"} disabled:cursor-not-allowed disabled:opacity-60`}>
                {busyId === bill.id ? "Saving..." : bill.paid_status ? "Mark unpaid" : "Mark paid"}
              </button>
            </div>
          </div>
        ))}
        {bills === null ? <p className="p-5 text-sm text-slate-500">Loading payments...</p> : null}
        {bills && !shown.length ? <p className="p-5 text-sm text-slate-500">{bills.length ? "No bills match this filter." : "No bills have been generated yet."}</p> : null}
      </div>
    </div>
  );
}
