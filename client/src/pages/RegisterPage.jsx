import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import AuthShell from "../components/AuthShell";

const initialState = {
  name: "",
  email: "",
  mobile: "",
  address: "",
  family_members: 4,
  service_number: "",
  password: ""
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setSubmitting(true);
      await register(form);
      setMessage("Account created. Taking you to sign in...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to register. Check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      wide
      title="Register a household"
      subtitle="Your service number links this account to the meter on your connection."
      footer={
        <>
          Already registered? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="field-label">Owner name</label>
            <input id="name" className="input" autoComplete="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
          </div>
          <div>
            <label htmlFor="mobile" className="field-label">Mobile number</label>
            <input id="mobile" className="input" type="tel" inputMode="tel" autoComplete="tel" value={form.mobile} onChange={(e) => handleChange("mobile", e.target.value)} />
          </div>
          <div>
            <label htmlFor="service_number" className="field-label">Service number</label>
            <input id="service_number" className="input" autoCapitalize="characters" value={form.service_number} onChange={(e) => handleChange("service_number", e.target.value)} />
          </div>
          <div>
            <label htmlFor="family_members" className="field-label">Family members</label>
            <input
              id="family_members"
              className="input"
              type="number"
              inputMode="numeric"
              min="1"
              value={form.family_members}
              onChange={(e) => handleChange("family_members", Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input id="password" className="input" type="password" autoComplete="new-password" minLength={5} value={form.password} onChange={(e) => handleChange("password", e.target.value)} />
            <p className="mt-1.5 text-xs text-slate-500">At least 5 characters.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address" className="field-label">Address</label>
            <textarea id="address" className="input min-h-24" autoComplete="street-address" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
          </div>
        </div>
        {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button disabled={submitting} className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
