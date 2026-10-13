import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatDateTime, formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusPill from "../../components/StatusPill";
import PayBillButton from "../../components/PayBillButton";
import Notice from "../../components/Notice";

function methodLabel(bill) {
  if (bill.payment_method === "razorpay") return "Paid online";
  if (bill.payment_method === "cash") return "Paid to the administrator";
  return "Paid";
}

// The household's payments: what is due now, and a record of every payment made.
export default function UserPaymentsPage() {
  const [bills, setBills] = useState(null);
  const [payments, setPayments] = useState(null);
  const [message, setMessage] = useState("");

  const load = () =>
    api.get("/user/bills").then(({ data }) => {
      setBills(data.bills || []);
      setPayments(data.payments || null);
    });
  useLive(load, ["billing:update"], 60000);

  const handlePaid = (bill) => {
    setMessage(`Payment received for ${bill.month}. A receipt has been emailed to you.`);
    load();
  };

  const list = bills || [];
  const due = list.filter((bill) => !bill.paid_status);
  const paid = list.filter((bill) => bill.paid_status);
  const sum = (items) => items.reduce((total, bill) => total + Number(bill.total_amount || 0), 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Payments" description="What you owe now, and a record of every payment you have made." />
      <Notice>{message}</Notice>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Amount due" value={formatMoney(sum(due))} hint={due.length ? `${due.length} unpaid bill${due.length === 1 ? "" : "s"}` : "Nothing to pay"} accent={due.length ? "text-red-600" : undefined} />
        <StatCard label="Amount paid" value={formatMoney(sum(paid))} hint={`${paid.length} payment${paid.length === 1 ? "" : "s"} made`} />
      </div>

      <div>
        <p className="panel-title px-1">To pay</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {due.map((bill) => (
            <div key={bill.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{bill.month}</p>
                  <p className="text-xs text-slate-500">{bill.total_usage} L at Rs. {bill.tariff} per liter</p>
                </div>
                <p className="text-lg font-extrabold tracking-tight tabular-nums text-ink">{formatMoney(bill.total_amount)}</p>
              </div>
              <PayBillButton bill={bill} payments={payments} onPaid={handlePaid} className="mt-4" />
              <Link to={`/user/bill-details/${bill.id}`} className="mt-2 block text-center text-xs font-bold text-brand-600 hover:text-brand-700">View bill</Link>
            </div>
          ))}
        </div>
        {bills && !due.length ? <div className="panel mt-3 p-5 text-sm text-slate-500">You have no unpaid bills.</div> : null}
      </div>

      <div>
        <p className="panel-title px-1">Payment history</p>
        <div className="panel mt-3 divide-y divide-slate-100">
          {paid.map((bill) => (
            <Link key={bill.id} to={`/user/bill-details/${bill.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{bill.month}</p>
                <p className="truncate text-xs text-slate-500">
                  {methodLabel(bill)}
                  {bill.paid_at ? ` · ${formatDateTime(bill.paid_at)}` : ""}
                </p>
                {bill.payment_id ? <p className="truncate text-xs text-slate-400">Reference {bill.payment_id}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="text-sm font-extrabold tabular-nums text-ink">{formatMoney(bill.total_amount)}</p>
                <StatusPill color="green">Paid</StatusPill>
              </div>
            </Link>
          ))}
          {bills === null ? <p className="p-5 text-sm text-slate-500">Loading payments...</p> : null}
          {bills && !paid.length ? <p className="p-5 text-sm text-slate-500">No payments yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
