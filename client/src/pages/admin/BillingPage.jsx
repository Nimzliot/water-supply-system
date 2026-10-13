import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { socket } from "../../lib/socket";
import { currentMonthValue, errorMessage, formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";
import ResetUsageCard from "../../components/ResetUsageCard";

// A prototype moves a few liters, so these rates turn a small test into a bill worth showing.
const ratePresets = [
  { label: "Village rate", value: 0.02 },
  { label: "Rs. 10 / L", value: 10 },
  { label: "Rs. 50 / L", value: 50 },
  { label: "Rs. 100 / L", value: 100 }
];

export default function BillingPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [preview, setPreview] = useState(null);
  const [rate, setRate] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bills, setBills] = useState(null);
  const [submitting, setSubmitting] = useState("");
  const [emailingId, setEmailingId] = useState("");
  const [recalculating, setRecalculating] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBills = () => api.get("/admin/billing").then(({ data }) => setBills(data.billing || []));

  const loadPreview = async (keepRate = false) => {
    try {
      const { data } = await api.get("/admin/billing/preview", { params: { month } });
      setPreview(data);
      if (!keepRate) setRate(String(data.tariff));
    } catch (err) {
      setPreview(null);
      setError(errorMessage(err, "Unable to work out the bills for that month."));
    }
  };

  useEffect(() => {
    setError("");
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    loadBills().catch(() => setBills([]));
    const refresh = () => {
      loadBills().catch(() => {});
      loadPreview(true);
    };
    socket.on("billing:update", refresh);
    return () => socket.off("billing:update", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rateNumber = Number(rate);
  const rateValid = rate !== "" && Number.isFinite(rateNumber) && rateNumber >= 0;

  // The amounts follow the rate as it is typed. A paid bill keeps the rate it was paid at.
  const rows = useMemo(
    () =>
      (preview?.rows || []).map((row) => {
        const locked = Boolean(row.bill?.paid_status);
        const usedRate = locked || !rateValid ? row.tariff : rateNumber;
        return { ...row, locked, usedRate, amount: Number((row.total_usage * usedRate).toFixed(2)) };
      }),
    [preview, rateNumber, rateValid]
  );

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalUsage = rows.reduce((sum, row) => sum + row.total_usage, 0);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const generate = async (apply_to) => {
    if (!rateValid) {
      setError("Enter a rate per liter first.");
      return;
    }

    try {
      setSubmitting(apply_to);
      setError("");
      setMessage("");
      const { data } = await api.post("/admin/billing/generate", {
        month,
        apply_to,
        user_ids: apply_to === "selected" ? selectedIds : [],
        tariff: rateNumber
      });
      setMessage(data.message || "Bills generated.");
      setSelectedIds([]);
      await Promise.all([loadBills(), loadPreview(true)]);
    } catch (err) {
      setError(errorMessage(err, "Unable to generate bills."));
    } finally {
      setSubmitting("");
    }
  };

  const outOfDate = (bills || []).filter((bill) => bill.out_of_date);

  // Brings one bill, or every out-of-date bill, back in line with the meter readings.
  const recalculate = async (bill) => {
    try {
      setRecalculating(bill ? bill.id : "all");
      setError("");
      setMessage("");
      // Save the rate on screen first so the recalculation uses it.
      if (rateValid && preview && rateNumber !== Number(preview.tariff)) {
        await api.patch("/admin/settings", { tariff: rateNumber });
      }
      const { data } = await api.post("/admin/billing/recalculate", bill ? { bill_ids: [bill.id] } : {});
      setMessage(data.message);
      await Promise.all([loadBills(), loadPreview(true)]);
    } catch (err) {
      setError(errorMessage(err, "Unable to recalculate."));
    } finally {
      setRecalculating("");
    }
  };

  const setPaid = async (bill, paid_status) => {
    try {
      setError("");
      await api.patch(`/admin/billing/${bill.id}`, { paid_status });
      await Promise.all([loadBills(), loadPreview(true)]);
    } catch (err) {
      setError(errorMessage(err, "Unable to update the bill."));
    }
  };

  const emailBill = async (bill) => {
    try {
      setEmailingId(bill.id);
      setError("");
      setMessage("");
      const { data } = await api.post(`/admin/billing/${bill.id}/email`);
      setMessage(data.message);
    } catch (err) {
      setError(errorMessage(err, "The bill could not be emailed."));
    } finally {
      setEmailingId("");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Billing" description="A bill is the liters a household's meter recorded in the month, times the rate per liter." />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      <div className="panel p-5 sm:p-6">
        <p className="panel-title">Generate bills</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[14rem_14rem_1fr] lg:items-end">
          <div>
            <label htmlFor="billing-month" className="field-label">Billing month</label>
            <input id="billing-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="billing-rate" className="field-label">Rate per liter (Rs.)</label>
            <input id="billing-rate" type="number" inputMode="decimal" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="input" />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
            {ratePresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setRate(String(preset.value))}
                className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${rateNumber === preset.value ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-black/[0.06]">
          <div className="hidden grid-cols-[2.5rem_1.6fr_1fr_1fr_1fr] gap-3 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-500 sm:grid">
            <span />
            <span>Household</span>
            <span className="text-right">Water used</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Bill amount</span>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <label key={row.user_id} className="grid cursor-pointer grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[2.5rem_1.6fr_1fr_1fr_1fr]">
                <input type="checkbox" checked={selectedIds.includes(row.user_id)} onChange={() => toggle(row.user_id)} className="h-4 w-4 accent-[#e23744]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{row.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {row.service_number} · {row.readings} {row.readings === 1 ? "reading" : "readings"}
                    <span className="sm:hidden"> · {row.total_usage} L at Rs. {row.usedRate}</span>
                  </span>
                  {row.bill ? (
                    <span className="mt-1 inline-flex">
                      <StatusPill color={row.bill.paid_status ? "green" : "amber"}>{row.bill.paid_status ? "Paid" : `Billed ${formatMoney(row.bill.total_amount)}`}</StatusPill>
                    </span>
                  ) : null}
                </span>
                <span className="hidden text-right text-sm tabular-nums text-slate-700 sm:block">{row.total_usage} L</span>
                <span className="hidden text-right text-sm tabular-nums text-slate-700 sm:block">Rs. {row.usedRate}</span>
                <span className="text-right text-sm font-extrabold tabular-nums text-ink">{formatMoney(row.amount)}</span>
              </label>
            ))}
            {preview && !rows.length ? <p className="px-4 py-5 text-sm text-slate-500">No households are registered yet.</p> : null}
            {!preview && !error ? <p className="px-4 py-5 text-sm text-slate-500">Working out the bills...</p> : null}
          </div>
          {rows.length ? (
            <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
              <span className="text-sm font-bold text-ink">
                {preview.month} · {totalUsage.toFixed(2)} L
              </span>
              <span className="text-base font-extrabold tabular-nums text-ink">{formatMoney(total)}</span>
            </div>
          ) : null}
        </div>

        {rows.length && totalUsage === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No meter readings were recorded in this month, so every bill would be Rs. 0.00. Pick a month in which water was used.</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button onClick={() => generate("all")} disabled={Boolean(submitting) || !rows.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
            {submitting === "all" ? "Generating..." : `Generate for all (${rows.length})`}
          </button>
          <button onClick={() => generate("selected")} disabled={Boolean(submitting) || !selectedIds.length} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
            {submitting === "selected" ? "Generating..." : `Generate for selected (${selectedIds.length})`}
          </button>
          <button type="button" onClick={() => setSelectedIds(allSelected ? [] : rows.map((row) => row.user_id))} disabled={!rows.length} className="btn-secondary disabled:opacity-60">
            {allSelected ? "Clear selection" : "Select all"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Generating again for the same month updates the existing bills. A bill already marked paid keeps its rate.</p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="panel-title">All bills</p>
          {outOfDate.length ? (
            <button type="button" onClick={() => recalculate()} disabled={recalculating === "all"} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {recalculating === "all" ? "Recalculating..." : `Recalculate ${outOfDate.length} out-of-date bill${outOfDate.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
        {outOfDate.length ? (
          <p className="mt-2 px-1 text-sm text-slate-500">
            An out-of-date bill was generated before all of its month's meter readings arrived, so its amount no longer matches what the meter recorded.
          </p>
        ) : null}
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(bills || []).map((bill) => (
            <div key={bill.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{bill.users?.name || "Household"}</p>
                  <p className="text-xs text-slate-500">{bill.month}</p>
                </div>
                <StatusPill color={bill.paid_status ? "green" : "amber"}>{bill.paid_status ? "Paid" : "Pending"}</StatusPill>
              </div>
              <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums text-ink">{formatMoney(bill.total_amount)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {bill.total_usage} L at Rs. {bill.tariff} per liter
              </p>
              {bill.paid_status && bill.payment_method ? (
                <p className="mt-1 text-xs text-slate-400">
                  {bill.payment_method === "razorpay" ? `Paid online · ${bill.payment_id}` : "Marked paid by an administrator"}
                </p>
              ) : null}
              {bill.out_of_date ? (
                <div className="pop-in mt-3 rounded-xl bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Out of date: the meter recorded {bill.current_usage} L in {bill.month}, which is {formatMoney(bill.current_usage * Number(rateValid ? rateNumber : bill.tariff))} at the current rate.
                  </p>
                  <button type="button" onClick={() => recalculate(bill)} disabled={recalculating === bill.id} className="mt-2 text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-60">
                    {recalculating === bill.id ? "Recalculating..." : "Recalculate this bill"}
                  </button>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaid(bill, !bill.paid_status)} className={bill.paid_status ? "btn-secondary" : "btn-primary"}>
                  {bill.paid_status ? "Mark unpaid" : "Mark paid"}
                </button>
                <button type="button" onClick={() => emailBill(bill)} disabled={emailingId === bill.id} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
                  {emailingId === bill.id ? "Sending..." : "Email bill"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {bills === null ? <p className="mt-3 text-sm text-slate-500">Loading bills...</p> : null}
        {bills && !bills.length ? <div className="panel mt-3 p-5 text-sm text-slate-500">No bills have been generated yet.</div> : null}
      </div>

      <ResetUsageCard onReset={() => Promise.all([loadBills(), loadPreview(true)]).catch(() => {})} />
    </div>
  );
}
