import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import api from "../../lib/api";
import { errorMessage } from "../../lib/format";
import AiText from "./AiText";

// A chat with the Gemini assistant. The server adds the live data to every question, so answers
// are about this system right now. scope is "admin" or "user".
export default function AiChat({ scope = "admin", suggestions = [], title = "Ask the AI", placeholder = "Ask about the tank, pump, supply, usage or bills..." }) {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef(null);

  useEffect(() => {
    api.get(`/${scope}/ai/status`).then(({ data }) => setStatus(data.ai)).catch(() => setStatus({ configured: false, help: "" }));
  }, [scope]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const ask = async (text) => {
    const asked = text.trim();
    if (!asked || busy) return;
    const history = messages.map(({ role, text: said }) => ({ role, text: said }));
    setMessages((current) => [...current, { role: "user", text: asked }]);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/${scope}/ai/ask`, { question: asked, history });
      setMessages((current) => [...current, { role: "model", text: data.answer }]);
    } catch (err) {
      setError(errorMessage(err, "The AI could not answer."));
      setMessages((current) => current.slice(0, -1));
      setQuestion(asked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel flex flex-col p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <p className="panel-title">{title}</p>
          <p className="text-xs text-slate-500">Blesson AI · answers from your live data · it cannot switch anything</p>
        </div>
      </div>

      {status && !status.configured ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {scope === "admin" ? status.help || "The AI assistant is not set up on the server yet." : "The AI assistant is not switched on yet. Ask your administrator."}
        </p>
      ) : null}

      <div className="mt-4 max-h-[28rem] min-h-[6rem] space-y-3 overflow-y-auto">
        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={index} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-white">{message.text}</div>
          ) : (
            <div key={index} className="pop-in max-w-[95%] rounded-2xl rounded-bl-md bg-slate-50 px-4 py-3">
              <AiText text={message.text} />
            </div>
          )
        )}
        {busy ? (
          <div className="flex w-fit items-center gap-1.5 rounded-2xl bg-slate-50 px-4 py-3" aria-label="Thinking">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${dot * 0.15}s` }} />
            ))}
          </div>
        ) : null}
        {!messages.length && !busy && suggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => ask(suggestion)}
                disabled={status && !status.configured}
                className="rounded-full bg-slate-100 px-3.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={end} />
      </div>

      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <input
          className="input flex-1"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          aria-label="Question for the AI"
        />
        <button type="submit" disabled={busy || !question.trim() || (status && !status.configured)} className="btn-primary shrink-0 disabled:opacity-50" aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
