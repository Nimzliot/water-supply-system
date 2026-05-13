import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="panel grid w-full max-w-5xl overflow-hidden md:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-slate-950/50 p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.28em] text-aqua">Water Intelligence</p>
          <h1 className="mt-4 text-4xl font-bold text-white">Keep every village connection visible, fair, and automated.</h1>
          <p className="mt-4 max-w-lg text-slate-300">
            Monitor tank levels, prevent overflow, control household supply, approve LPCD requests, and track billing from one live operations dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-white">Login</h2>
          <p className="mt-2 text-sm text-slate-300">Use your service number or email with your password.</p>
          <div className="mt-6 space-y-4">
            <input
              className="input"
              placeholder="Service number or email"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            />
            <div className="relative">
              <input
                className="input pr-12"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-aqua"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          <button className="btn-primary mt-6 w-full">Login</button>
          <Link to="/forgot-password" className="mt-4 inline-block text-sm text-slate-300 hover:text-aqua">
            Forgot password?
          </Link>
          <p className="mt-4 text-sm text-slate-300">
            New household? <Link to="/register" className="text-aqua">Register here</Link>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Admin accounts are created manually in Supabase only.
          </p>
        </form>
      </div>
    </div>
  );
}
