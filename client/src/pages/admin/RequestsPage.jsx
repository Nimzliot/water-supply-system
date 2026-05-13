import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);

  const load = () => api.get("/admin/lpcd-requests").then(({ data }) => setRequests(data.requests));

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    await api.patch(`/admin/lpcd-requests/${id}`, { status });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="LPCD Requests"
        title="Approve or reject extra water requests"
        description="Review reasons, approve temporary limit increases, or reject requests with policy control."
      />
      <div className="mt-6 space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="panel p-5">
            <p className="font-semibold text-white">{request.users?.name}</p>
            <p className="mt-1 text-sm text-slate-300">{request.requested_extra_liters} extra liters requested</p>
            <p className="mt-1 text-sm text-slate-400">{request.reason}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => updateStatus(request.id, "approved")} className="btn-primary">Approve</button>
              <button onClick={() => updateStatus(request.id, "rejected")} className="btn-secondary">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
