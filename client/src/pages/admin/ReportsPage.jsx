import { useState } from "react";
import { Download } from "lucide-react";
import api from "../../lib/api";
import { currentMonthValue } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import Notice from "../../components/Notice";

const reports = [
  { type: "usage", title: "Household usage", detail: "Liters used by each household, one line per day." },
  { type: "billing", title: "Billing", detail: "Every bill for the month with usage, tariff, amount, and payment status." },
  { type: "leakage", title: "Leak alerts", detail: "Each leak the controller reported and whether it was resolved." },
  { type: "tank", title: "Tank and pump log", detail: "Tank level and pump state for every reading the controller sent." }
];

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const download = async (type) => {
    try {
      setBusy(type);
      setError("");
      const { data } = await api.get(`/admin/reports/${type}`, { params: { month }, responseType: "blob" });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-${month}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Unable to build that report. Try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Reports"
        description="Download recorded data as CSV files that open in Excel."
        actions={
          <div>
            <label htmlFor="report-month" className="field-label">Month</label>
            <input id="report-month" type="month" className="input sm:w-48" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        }
      />
      <Notice tone="error">{error}</Notice>
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <div key={report.type} className="panel flex flex-col gap-4 p-4 sm:p-5">
            <div>
              <p className="panel-title">{report.title}</p>
              <p className="mt-1 text-sm text-slate-500">{report.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => download(report.type)}
              disabled={Boolean(busy) || !month}
              className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
            >
              <Download size={16} />
              {busy === report.type ? "Preparing..." : "Download CSV"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
