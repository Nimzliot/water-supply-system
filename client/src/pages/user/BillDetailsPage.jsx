import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { Printer } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cartesianOptions } from "../../lib/charts";
import { errorMessage, formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";
import PayBillButton from "../../components/PayBillButton";

export default function BillDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const load = () =>
    api
      .get(`/user/bills/${id}`)
      .then(({ data }) => setDetails(data))
      .catch((err) => setError(errorMessage(err, "Unable to load this bill.")));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePaid = () => {
    setMessage("Payment received. A receipt has been emailed to you.");
    load();
  };

  if (!details) {
    return error ? <Notice tone="error">{error}</Notice> : <div className="text-sm text-slate-500">Loading bill...</div>;
  }

  const { bill, dailyUsage } = details;
  const rows = [
    ["Household", user?.name],
    ["Service number", user?.service_number],
    ["Billing month", bill.month],
    ["Water used", `${bill.total_usage} L`],
    ["Tariff", `Rs. ${bill.tariff} per liter`]
  ];
  const chart = {
    labels: dailyUsage.map((row) => row.day),
    datasets: [{ label: "Liters", data: dailyUsage.map((row) => row.liters), backgroundColor: "#e23744" }]
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow={`Bill for ${bill.month}`}
        description="Calculated from the readings your meter uploaded during the month."
        actions={
          <>
            <Link to="/user/bills" className="btn-secondary print:hidden">All bills</Link>
            <button type="button" onClick={() => window.print()} className="btn-primary print:hidden">
              <Printer size={16} />
              Print or save as PDF
            </button>
          </>
        }
      />

      <Notice>{message}</Notice>

      <div className="panel max-w-2xl p-4 sm:p-5">
        <dl className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-right text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm font-semibold text-ink">Amount</dt>
            <dd className="flex items-center gap-3">
              <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Pending"}</StatusPill>
              <span className="text-xl font-semibold tabular-nums text-ink">{formatMoney(bill.total_amount)}</span>
            </dd>
          </div>
          {bill.paid_status && bill.payment_method ? (
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-500">Paid</dt>
              <dd className="text-right text-sm font-medium text-ink">
                {bill.payment_method === "razorpay" ? "Online" : "To the administrator"}
                {bill.paid_at ? ` · ${new Date(bill.paid_at).toLocaleDateString()}` : ""}
                {bill.payment_id ? <span className="block text-xs font-normal text-slate-400">Reference {bill.payment_id}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
        <PayBillButton bill={bill} payments={details.payments} onPaid={handlePaid} className="mt-4 print:hidden" />
      </div>

      <div className="panel p-4 sm:p-5 print:hidden">
        <p className="panel-title">Usage by day (liters)</p>
        {dailyUsage.length ? (
          <div className="mt-4 h-56 sm:h-72">
            <Bar data={chart} options={cartesianOptions} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No readings were recorded in this month.</p>
        )}
      </div>
    </div>
  );
}
