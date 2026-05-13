import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

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

  const handleChange = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    await register(form);
    setMessage("Registration submitted. You can now login with your household account.");
    setTimeout(() => navigate("/login"), 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="panel w-full max-w-3xl p-8">
        <h1 className="text-3xl font-bold text-white">Household Registration</h1>
        <p className="mt-2 text-sm text-slate-300">Simple onboarding for rural households and field operators.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input className="input" placeholder="Owner name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
          <input className="input" placeholder="Mobile number" value={form.mobile} onChange={(e) => handleChange("mobile", e.target.value)} />
          <input className="input" placeholder="Service number" value={form.service_number} onChange={(e) => handleChange("service_number", e.target.value)} />
          <input
            className="input"
            placeholder="Family members"
            type="number"
            min="1"
            value={form.family_members}
            onChange={(e) => handleChange("family_members", Number(e.target.value))}
          />
          <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => handleChange("password", e.target.value)} />
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Your service number is the household connection ID used to link your dashboard with field hardware data.
        </p>
        <textarea className="input mt-4 min-h-28" placeholder="Address" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
        {message ? <p className="mt-4 text-sm text-aqua">{message}</p> : null}
        <div className="mt-6 flex gap-3">
          <button className="btn-primary">Create Account</button>
          <Link to="/login" className="btn-secondary">Back to login</Link>
        </div>
      </form>
    </div>
  );
}
