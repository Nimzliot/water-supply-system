import { useState } from "react";
import { payBill } from "../lib/payments";
import { errorMessage, formatMoney } from "../lib/format";

// "Pay" for one unpaid bill. Shows why it cannot be paid online when that is the case.
export default function PayBillButton({ bill, payments, onPaid, className = "" }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  if (bill.paid_status) return null;

  if (!payments?.enabled) {
    return <p className={`text-xs text-slate-500 ${className}`}>Online payment is not set up yet. Pay the administrator directly.</p>;
  }

  if (Number(bill.total_amount) < (payments.minimum || 1)) {
    return <p className={`text-xs text-slate-500 ${className}`}>Bills under Rs. {payments.minimum || 1} cannot be paid online.</p>;
  }

  const pay = async () => {
    try {
      setPaying(true);
      setError("");
      const paid = await payBill(bill);
      if (paid) onPaid?.(paid);
    } catch (err) {
      setError(errorMessage(err, err.message || "The payment did not go through."));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className={className}>
      <button type="button" onClick={pay} disabled={paying} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
        {paying ? "Opening payment..." : `Pay ${formatMoney(bill.total_amount)}`}
      </button>
      {payments.test_mode ? <p className="mt-1.5 text-center text-xs text-slate-400">Test mode: no real money is taken.</p> : null}
      {error ? <p className="pop-in mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
