import { useState } from "react";
import api from "../../lib/api";
import { useLive } from "../../lib/useLive";
import { errorMessage, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

const statusColor = { pending: "amber", approved: "green", rejected: "rose" };

export default function RequestsPage() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.get("/admin/lpcd-requests").then(({ data }) => setRequests(data.requests || []));
  useLive(load, ["request:update"], 30000);

  const updateStatus = async (id, status) => {
    try {
      setError("");
      await api.patch(`/admin/lpcd-requests/${id}`, { status });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to update the request."));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="LPCD Requests"
        description="Extra water requested by households. An approved request raises that household's limit on the requested day only."
      />
      <Notice tone="error">{error}</Notice>
      <div className="panel divide-y divide-slate-100">
        {(requests || []).map((request) => (
          <div key={request.id} className="flex flex-col gap-3 p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">
                  {request.users?.name || "Household"} · {request.requested_extra_liters} L
                </p>
                <StatusPill color={statusColor[request.status]}>{request.status}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
              <p className="mt-1 text-xs text-slate-500">
                {request.users?.service_number} · needed on {request.required_date || "no date given"} · requested {formatDateTime(request.requested_date)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateStatus(request.id, "approved")} disabled={request.status === "approved"} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
                Approve
              </button>
              <button onClick={() => updateStatus(request.id, "rejected")} disabled={request.status === "rejected"} className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
                Reject
              </button>
            </div>
          </div>
        ))}
        {requests === null ? <p className="p-5 text-sm text-slate-500">Loading requests...</p> : null}
        {requests && !requests.length ? <p className="p-5 text-sm text-slate-500">No extra water requests yet.</p> : null}
      </div>
    </div>
  );
}
