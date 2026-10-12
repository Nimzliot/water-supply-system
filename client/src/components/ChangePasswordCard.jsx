import { useState } from "react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import Notice from "./Notice";

const emptyForm = { current_password: "", new_password: "", confirm: "" };

export default function ChangePasswordCard() {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.new_password.length < 5) {
      setError("The new password must contain at least 5 characters.");
      return;
    }
    if (form.new_password !== form.confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/auth/change-password", { current_password: form.current_password, new_password: form.new_password });
      setMessage("Password changed.");
      setForm(emptyForm);
    } catch (err) {
      setError(errorMessage(err, "Unable to change the password."));
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, autoComplete) => (
    <div>
      <label htmlFor={key} className="field-label">{label}</label>
      <input
        id={key}
        className="input"
        type="password"
        autoComplete={autoComplete}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="panel max-w-xl space-y-4 p-4 sm:p-5">
      <p className="panel-title">Change password</p>
      {field("current_password", "Current password", "current-password")}
      {field("new_password", "New password", "new-password")}
      {field("confirm", "Confirm new password", "new-password")}
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>
      <button disabled={saving} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
        {saving ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
