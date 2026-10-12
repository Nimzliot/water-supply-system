import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tickets, setTickets] = useState(null);

  const load = () =>
    api
      .get("/user/support")
      .then(({ data }) => setTickets(data.tickets || []))
      .catch((err) => {
        setTickets([]);
        setError(errorMessage(err, "Unable to load your support requests."));
      });
  useLive(load, ["support:update"], 30000);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (subject.trim().length < 3 || body.trim().length < 5) {
      setError("Add a subject and describe the problem.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/user/support", { subject: subject.trim(), message: body.trim() });
      setMessage("Sent. The administrator's reply will appear below.");
      setSubject("");
      setBody("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to send your request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Support" description="Report a problem with your supply, meter, or bill." />

      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={submit} className="panel space-y-4 self-start p-4 sm:p-5">
          <div>
            <label htmlFor="subject" className="field-label">Subject</label>
            <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label htmlFor="body" className="field-label">What is the problem?</label>
            <textarea id="body" className="input min-h-32" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Notice>{message}</Notice>
          <Notice tone="error">{error}</Notice>
          <button disabled={saving} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {saving ? "Sending..." : "Send to administrator"}
          </button>
        </form>

        <div className="space-y-3">
          {(tickets || []).map((ticket) => (
            <div key={ticket.id} className="panel p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-semibold text-ink">{ticket.subject}</p>
                <StatusPill color={ticket.status === "open" ? "amber" : "green"}>{ticket.status}</StatusPill>
              </div>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(ticket.created_at)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{ticket.message}</p>
              {ticket.admin_reply ? (
                <div className="mt-3 rounded-xl bg-brand-50 p-3">
                  <p className="text-xs font-medium text-brand-700">Administrator's reply</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{ticket.admin_reply}</p>
                </div>
              ) : null}
            </div>
          ))}
          {tickets && !tickets.length && !error ? <div className="panel p-5 text-sm text-slate-500">You have not reported any problem yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
