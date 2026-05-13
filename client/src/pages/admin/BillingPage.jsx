import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { socket } from "../../lib/socket";

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function BillingPage() {
  const [bills, setBills] = useState([]);
  const [houses, setHouses] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [month, setMonth] = useState(getCurrentMonthValue());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: billingData }, { data: houseData }] = await Promise.all([
      api.get("/admin/billing"),
      api.get("/admin/houses")
    ]);
    setBills(billingData.billing || []);
    setHouses(houseData.houses || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    socket.on("billing:update", load);
    return () => socket.off("billing:update", load);
  }, []);

  const allSelected = houses.length > 0 && selectedIds.length === houses.length;

  const toggleHouse = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const handleSelectAll = () => {
    setSelectedIds(allSelected ? [] : houses.map((house) => house.id));
  };

  const generateBills = async (apply_to) => {
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      const payload = {
        month,
        apply_to,
        user_ids: apply_to === "selected" ? selectedIds : []
      };
      const { data } = await api.post("/admin/billing/generate", payload);
      setMessage(data.message || "Bills generated successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to generate bills.");
    } finally {
      setSubmitting(false);
    }
  };

  const monthSummary = useMemo(() => {
    const groups = new Map();
    for (const bill of bills) {
      const total = groups.get(bill.month) || 0;
      groups.set(bill.month, total + Number(bill.total_amount || 0));
    }
    return Array.from(groups.entries()).slice(0, 3);
  }, [bills]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Billing generation and payment overview"
        description="Generate monthly bills for all households at once or only for the selected households."
      />

      {message ? <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="panel-title">Generate Bills</p>
              <p className="mt-2 text-sm text-slate-300">Choose a billing month, then generate for everyone or only for selected households.</p>
            </div>
            <div className="w-full md:w-56">
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Billing Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => generateBills("all")} disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Generating..." : "Generate For All"}
            </button>
            <button onClick={() => generateBills("selected")} disabled={submitting || selectedIds.length === 0} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Generating..." : `Generate For Selected (${selectedIds.length})`}
            </button>
            <button onClick={handleSelectAll} type="button" className="btn-secondary">
              {allSelected ? "Clear Selection" : "Select All"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {houses.map((house) => (
              <label key={house.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(house.id)}
                  onChange={() => toggleHouse(house.id)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900"
                />
                <span>
                  <span className="block font-semibold text-white">{house.name}</span>
                  <span className="block text-slate-400">{house.service_number}</span>
                </span>
              </label>
            ))}
            {!houses.length && !loading ? <p className="text-sm text-slate-400">No households found.</p> : null}
          </div>
        </div>

        <div className="panel p-5">
          <p className="panel-title">Recent Billing Totals</p>
          <div className="mt-4 space-y-3">
            {monthSummary.map(([monthLabel, total]) => (
              <div key={monthLabel} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                <p className="font-semibold text-white">{monthLabel}</p>
                <p className="mt-1 text-sm text-slate-300">Total generated amount</p>
                <p className="mt-3 text-2xl font-bold text-aqua">Rs. {total.toFixed(2)}</p>
              </div>
            ))}
            {!monthSummary.length && !loading ? <p className="text-sm text-slate-400">No billing records generated yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bills.map((bill) => (
          <div key={bill.id} className="panel p-5">
            <p className="text-lg font-semibold text-white">{bill.users?.name || "Household"}</p>
            <p className="mt-2 text-slate-300">{bill.month}</p>
            <p className="mt-4 text-3xl font-bold text-aqua">Rs. {bill.total_amount}</p>
            <p className="mt-2 text-sm text-slate-300">
              Usage: {bill.total_usage} L | Tariff: {bill.tariff}/L
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">{bill.paid_status ? "Paid" : "Pending"}</p>
          </div>
        ))}
        {!bills.length && !loading ? <p className="text-sm text-slate-400">No bills generated yet.</p> : null}
      </div>
    </div>
  );
}
