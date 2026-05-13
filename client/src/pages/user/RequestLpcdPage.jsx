import { useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function RequestLpcdPage() {
  const [requested_extra_liters, setRequestedExtraLiters] = useState(25);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
      await api.post("/user/lpcd-requests", { requested_extra_liters, reason: `${reason} | Requested date: ${date}` });
      setMessage("Request submitted to admin.");
      setReason("");
    };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Request Extra Water"
        title="Submit extra liters request"
        description="Provide extra liters, date, and reason for temporary approval."
      />
      <div className="panel p-5">
        <label className="text-sm text-slate-300">Extra liters requested</label>
        <input className="input mt-2" type="number" value={requested_extra_liters} onChange={(e) => setRequestedExtraLiters(Number(e.target.value))} />
        <label className="mt-4 block text-sm text-slate-300">Required date</label>
        <input className="input mt-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="mt-4 block text-sm text-slate-300">Reason</label>
        <textarea className="input mt-2 min-h-28" value={reason} onChange={(e) => setReason(e.target.value)} />
        {message ? <p className="mt-4 text-sm text-aqua">{message}</p> : null}
        <button className="btn-primary mt-5">Submit Request</button>
      </div>
    </form>
  );
}
