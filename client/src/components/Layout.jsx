import { Link, Outlet, useLocation } from "react-router-dom";
import { Activity, BellRing, Droplets, FileBarChart, Gauge, Receipt, Settings, Users } from "lucide-react";
import { useAuth } from "../lib/auth";

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: Gauge },
  { to: "/admin/households", label: "Households", icon: Users },
  { to: "/admin/billing", label: "Billing", icon: Receipt },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/alerts", label: "Alerts", icon: BellRing },
  { to: "/admin/requests", label: "LPCD Requests", icon: Activity },
  { to: "/admin/system", label: "System Controls", icon: Settings },
  { to: "/admin/analytics", label: "Analytics", icon: Droplets }
];

const userNav = [
  { to: "/app", label: "Dashboard", icon: Gauge },
  { to: "/app/history", label: "Usage History", icon: Activity },
  { to: "/app/bills", label: "Bills", icon: Receipt },
  { to: "/app/request", label: "Extra LPCD", icon: Droplets },
  { to: "/app/profile", label: "Profile", icon: Users }
];

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navItems = user?.role === "admin" ? adminNav : userNav;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 md:grid-cols-[260px_1fr]">
        <aside className="panel p-5">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-aqua">Smart Water Grid</p>
            <h1 className="mt-3 text-2xl font-bold text-white">Rural Distribution Control</h1>
            <p className="mt-2 text-sm text-slate-300">Reliable monitoring for tanks, pumps, leakage, and household supply.</p>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    active ? "bg-aqua text-ink" : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Signed in as</p>
            <p className="mt-2 font-semibold text-white">{user?.name}</p>
            <p className="text-sm text-slate-300">{user?.service_number || user?.email}</p>
            <button onClick={logout} className="btn-secondary mt-4 w-full">
              Logout
            </button>
          </div>
        </aside>

        <main className="panel overflow-hidden p-5 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
