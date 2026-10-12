import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import AuthShell from "../components/AuthShell";
import Notice from "../components/Notice";

// Landing page for the emailed reset link. Supabase puts the recovery token in the URL fragment.
export default function ResetPasswordPage() {
  const params = useMemo(() => new URLSearchParams(window.location.hash.replace(/^#/, "")), []);
  const accessToken = params.get("access_token");
  const linkError = params.get("error_description");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 5) {
      setError("The password must contain at least 5 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post("/auth/reset-password", { access_token: accessToken, password });
      setMessage(data.message);
    } catch (err) {
      setError(errorMessage(err, "Unable to reset the password."));
    } finally {
      setSaving(false);
    }
  };

  const footer = <Link to="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</Link>;

  if (!accessToken) {
    return (
      <AuthShell title="Reset link not valid" subtitle={linkError || "This reset link is invalid or has expired."} footer={footer}>
        <Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" footer={footer}>
      {message ? (
        <div className="space-y-4">
          <Notice>{message}</Notice>
          <Link to="/login" className="btn-primary w-full">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="password" className="field-label">New password</label>
            <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="confirm" className="field-label">Confirm new password</label>
            <input id="confirm" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Notice tone="error">{error}</Notice>
          <button disabled={saving} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Saving..." : "Set new password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
