import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form className="panel w-full max-w-xl p-8">
        <p className="panel-title">Account Recovery</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Forgot your password?</h1>
        <p className="mt-3 text-sm text-slate-300">
          This screen is ready for Supabase reset-password integration. Connect it to `resetPasswordForEmail` when you configure your production auth flows.
        </p>
        <input className="input mt-6" placeholder="Enter your email" type="email" />
        <button type="button" className="btn-primary mt-5 w-full">Send Reset Link</button>
        <p className="mt-4 text-sm text-slate-300">
          Back to <Link to="/login" className="text-aqua">login</Link>
        </p>
      </form>
    </div>
  );
}

