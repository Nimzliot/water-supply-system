import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import AuthShell from "../components/AuthShell";
import Notice from "../components/Notice";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      setError("");
      setMessage("");
      const { data } = await api.post("/auth/forgot-password", { identifier: identifier.trim() });
      setMessage(data.message);
    } catch (err) {
      setError(errorMessage(err, "Unable to send the reset link."));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We email a reset link to the address on your account. No email? Ask your water administrator to reset it."
      footer={<Link to="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="field-label">Service number or email</label>
          <input id="identifier" className="input" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <Notice>{message}</Notice>
        <Notice tone="error">{error}</Notice>
        <button disabled={sending || identifier.trim().length < 3} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
          {sending ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
