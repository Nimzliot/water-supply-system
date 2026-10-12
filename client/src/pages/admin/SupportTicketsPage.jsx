import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState(null);
  const [replies, setReplies] = useState({});
  const [error, setError] = useState("");

  const load = () =>
    api
      .get("/admin/support")
      .then(({ data }) => setTickets(data.tickets || []))
      .catch((err) => {
        setTickets([]);
        setError(errorMessage(err, "Unable to load support requests."));
      });
  useLive(load, ["support:update"], 30000);

  const update = async (ticket, changes) => {
    try {
      setError("");
      await api.patch(`/admin/support/${ticket.id}`, changes);
      setReplies((current) => ({ ...current, [ticket.id]: "" }));
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to update the request."));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Support" description="Problems reported by households. Your reply is shown to the household straight away." />
      <Notice tone="error">{error}</Notice>
      <div className="space-y-4">
        {(tickets || []).map((ticket) => {
          const reply = replies[ticket.id] || "";
          return (
            <div key={ticket.id} className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                <StatusPill color={ticket.status === "open" ? "amber" : "green"}>{ticket.status}</StatusPill>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {ticket.users?.name} · {ticket.users?.service_number} · {formatDateTime(ticket.created_at)}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{ticket.message}</p>
              {ticket.admin_reply ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Your reply</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{ticket.admin_reply}</p>
                </div>
              ) : null}
              <textarea
                className="input mt-3 min-h-20"
                placeholder="Write a reply"
                value={reply}
                onChange={(e) => setReplies((current) => ({ ...current, [ticket.id]: e.target.value }))}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={!reply.trim()} onClick={() => update(ticket, { admin_reply: reply.trim() })} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
                  Send reply
                </button>
                <button type="button" onClick={() => update(ticket, { status: ticket.status === "open" ? "resolved" : "open" })} className="btn-secondary flex-1 sm:flex-none">
                  {ticket.status === "open" ? "Mark resolved" : "Reopen"}
                </button>
              </div>
            </div>
          );
        })}
        {tickets === null ? <p className="text-sm text-slate-500">Loading support requests...</p> : null}
        {tickets && !tickets.length && !error ? <div className="panel p-5 text-sm text-slate-500">No support requests yet.</div> : null}
      </div>
    </div>
  );
}
