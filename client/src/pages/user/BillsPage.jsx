import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import PayBillButton from "../../components/PayBillButton";
import Notice from "../../components/Notice";

export default function BillsPage() {
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

  const due = (bills || []).filter((bill) => !bill.paid_status).reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Bills" description={bills?.length ? (due > 0 ? `${formatMoney(due)} to pay.` : "Everything is paid. Thank you.") : "Your monthly water bills."} />
      <Notice>{message}</Notice>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(bills || []).map((bill) => (
          <div key={bill.id} className="panel flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-ink">{bill.month}</p>
              <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Payment pending"}</StatusPill>
            </div>
            <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums text-ink">{formatMoney(bill.total_amount)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {bill.total_usage} L at Rs. {bill.tariff} per liter
            </p>
            {bill.paid_status && bill.payment_method ? (
              <p className="mt-1 text-xs text-slate-400">{bill.payment_method === "razorpay" ? "Paid online" : "Paid to the administrator"}</p>
            ) : null}
            <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
              <PayBillButton bill={bill} payments={payments} onPaid={handlePaid} />
              <Link to={`/user/bill-details/${bill.id}`} className="btn-secondary w-full">View bill</Link>
            </div>
          </div>
        ))}
      </div>
      {bills === null ? <p className="text-sm text-slate-500">Loading bills...</p> : null}
      {bills && !bills.length ? <div className="panel p-5 text-sm text-slate-500">No bill has been generated for your connection yet.</div> : null}
    </div>
  );
}
