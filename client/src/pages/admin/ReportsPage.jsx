import { useEffect, useState } from "react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function ReportsPage() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get("/admin/reports").then(({ data }) => setReport(data));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Downloadable utility reporting center"
        description="Monthly, leakage, usage, and pump runtime reports can be exported from here."
      />
      <div className="panel mt-6 max-w-3xl p-5">
        <p className="text-sm text-slate-300">
          This endpoint is prepared for PDF and CSV exports for monthly billing, leakage summaries, household usage, and pump runtime reports.
        </p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="font-semibold text-white">Latest report status</p>
          <p className="mt-2 text-sm text-slate-300">{report?.message || "Loading..."}</p>
          <p className="mt-2 text-xs text-slate-400">
            Generated at: {report?.generated_at ? new Date(report.generated_at).toLocaleString() : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}
