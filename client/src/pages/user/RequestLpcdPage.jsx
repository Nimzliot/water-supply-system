import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime, todayValue } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

const statusColor = { pending: "amber", approved: "green", rejected: "rose" };

export default function RequestLpcdPage() {
  const [liters, setLiters] = useState(25);
  const [date, setDate] = useState(todayValue());
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState(null);

  const load = () => api.get("/user/lpcd-requests").then(({ data }) => setRequests(data.requests || []));
  useLive(load, ["request:update"], 30000);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!(Number(liters) >= 1)) {
      setError("Enter how many extra liters you need.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Tell the administrator why you need extra water.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/user/lpcd-requests", { requested_extra_liters: Number(liters), required_date: date, reason: reason.trim() });
      setMessage("Request sent to the administrator.");
      setReason("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to send the request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Request Extra Water" description="If the administrator approves, your limit is raised by this amount on the day you choose." />

      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={submit} className="panel space-y-4 self-start p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="liters" className="field-label">Extra liters</label>
              <input id="liters" className="input" type="number" inputMode="numeric" min="1" value={liters} onChange={(e) => setLiters(e.target.value)} />
            </div>
            <div>
              <label htmlFor="date" className="field-label">Needed on</label>
              <input id="date" className="input" type="date" min={todayValue()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="reason" className="field-label">Reason</label>
            <textarea id="reason" className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Notice>{message}</Notice>
          <Notice tone="error">{error}</Notice>
          <button disabled={saving} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {saving ? "Sending..." : "Send request"}
          </button>
        </form>

        <div className="panel self-start">
          <p className="panel-title px-4 pt-4 sm:px-5 sm:pt-5">Your requests</p>
          <div className="mt-2 divide-y divide-slate-100">
            {(requests || []).map((request) => (
              <div key={request.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {request.requested_extra_liters} L{request.required_date ? ` on ${request.required_date}` : ""}
                  </p>
                  <StatusPill color={statusColor[request.status]}>{request.status}</StatusPill>
                </div>
                <p className="mt-1 break-words text-sm text-slate-600">{request.reason}</p>
                <p className="mt-1 text-xs text-slate-400">Sent {formatDateTime(request.requested_date)}</p>
              </div>
            ))}
            {requests === null ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">Loading...</p> : null}
            {requests && !requests.length ? <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">You have not requested extra water yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
