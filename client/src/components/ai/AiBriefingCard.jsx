import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Sparkles } from "lucide-react";
import api from "../../lib/api";
import { errorMessage, formatTime } from "../../lib/format";
import AiText from "./AiText";

// Gemini's short read of the system right now, for the admin dashboard.
export default function AiBriefingCard() {
  const [status, setStatus] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (fresh = false) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get(`/admin/ai/insight${fresh ? "?fresh=1" : ""}`);
      setBriefing(data);
    } catch (err) {
      setError(errorMessage(err, "The AI briefing is not available."));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    api
      .get("/admin/ai/status")
      .then(({ data }) => {
        setStatus(data.ai);
        if (data.ai.configured) load();
      })
      .catch(() => setStatus({ configured: false }));
  }, [load]);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <p className="panel-title">AI briefing</p>
            <p className="truncate text-xs text-slate-500">{briefing ? `Gemini · ${formatTime(briefing.generated_at)}` : "Gemini reads the live system"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {status?.configured ? (
            <button type="button" onClick={() => load(true)} disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Refresh the briefing">
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            </button>
          ) : null}
          <Link to="/admin/ai-assistant" className="text-xs font-bold text-brand-600 hover:text-brand-700">Ask</Link>
        </div>
      </div>

      <div className="mt-4">
        {status && !status.configured ? (
          <p className="text-sm text-slate-500">{status.help || "The AI assistant is not set up on the server yet."}</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : briefing ? (
          <AiText text={briefing.text} />
        ) : (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${90 - row * 15}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
