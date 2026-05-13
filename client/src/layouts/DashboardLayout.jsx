import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  BellRing,
  Bot,
  Cable,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  FileBarChart,
  Gauge,
  House,
  PanelLeft,
  Receipt,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Waves,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import StatusPill from "../components/StatusPill";
import api from "../lib/api";

const adminNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/admin/households", label: "Households", icon: House },
  { to: "/admin/tank-monitoring", label: "Tank Monitoring", icon: Waves },
  { to: "/admin/water-distribution", label: "Water Distribution", icon: Droplets },
  { to: "/admin/pump-control", label: "Pump Control", icon: Zap },
  { to: "/admin/valve-control", label: "Valve Control", icon: PanelLeft },
  { to: "/admin/leakage-alerts", label: "Leakage Alerts", icon: BellRing },
  { to: "/admin/billing", label: "Billing", icon: Receipt },
  { to: "/admin/analytics", label: "Analytics", icon: Activity },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/schedules", label: "Schedules", icon: Clock3 },
  { to: "/admin/lpcd-requests", label: "LPCD Requests", icon: Droplets },
  { to: "/admin/notifications", label: "Notifications", icon: BellRing },
  { to: "/admin/ai-predictions", label: "AI Predictions", icon: Bot },
  { to: "/admin/system-health", label: "System Health", icon: Cable },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/profile", label: "Profile", icon: UserCog }
];

const userNav = [
  { to: "/user/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/user/usage-history", label: "Usage History", icon: Activity },
  { to: "/user/live-usage", label: "Live Usage", icon: Waves },
  { to: "/user/bills", label: "Bills", icon: Receipt },
  { to: "/user/lpcd-status", label: "LPCD Status", icon: Droplets },
  { to: "/user/request-extra-water", label: "Extra Water", icon: BellRing },
  { to: "/user/notifications", label: "Notifications", icon: BellRing },
  { to: "/user/profile", label: "Profile", icon: UserCog },
  { to: "/user/support", label: "Support", icon: ShieldCheck },
  { to: "/user/settings", label: "Settings", icon: Settings }
];

export default function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const navItems = user?.role === "admin" ? adminNav : userNav;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) return;

    const endpoint = isAdmin ? "/admin/device-status" : "/user/device-status";
    const load = async () => {
      const { data } = await api.get(endpoint);
      setDeviceStatus(isAdmin ? data.devices?.[0] || null : data.device || null);
    };

    load();
    const interval = window.setInterval(load, isAdmin ? 15000 : 60000);
    return () => window.clearInterval(interval);
  }, [user, isAdmin]);

  return (
    <div className="min-h-screen p-3 md:p-4">
      <div className={`mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1880px] gap-4 ${collapsed ? "md:grid-cols-[96px_1fr]" : "md:grid-cols-[300px_1fr]"}`}>
        <aside className="panel sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {!collapsed ? (
                <>
                  <p className="text-xs uppercase tracking-[0.3em] text-aqua">Smart Water Grid</p>
                  <h1 className="mt-3 text-2xl font-bold text-white">{isAdmin ? "Village Command Center" : "Household Water Portal"}</h1>
                  <p className="mt-2 text-sm text-slate-300">
                    {isAdmin
                      ? "IoT operations, distribution controls, and village consumption oversight."
                      : "Your usage, bills, supply status, and service updates in one place."}
                  </p>
                </>
              ) : (
                <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-aqua">SWG</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="btn-secondary hidden shrink-0 md:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <nav className="space-y-2">
              {navItems.map(({ to, label, icon: Icon, badge }) => {
                const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                      active ? "bg-aqua text-ink" : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <span className={`flex items-center gap-3 ${collapsed ? "mx-auto" : ""}`}>
                      <Icon size={18} />
                      {!collapsed ? label : null}
                    </span>
                    {!collapsed && badge ? <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-ink/10 text-ink" : "bg-white/10 text-slate-200"}`}>{badge}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 rounded-3xl bg-slate-950/65 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                {!collapsed ? (
                  <>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Signed in as</p>
                    <p className="mt-2 font-semibold text-white">{user?.name}</p>
                    <p className="text-sm text-slate-300">{user?.service_number || user?.email}</p>
                  </>
                ) : null}
              </div>
              <StatusPill color={isAdmin ? "blue" : "green"}>{user?.role}</StatusPill>
            </div>
            {!collapsed ? <button onClick={logout} className="btn-secondary mt-4 w-full">Logout</button> : null}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col gap-4">
          <header className="panel sticky top-3 z-20 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live utility dashboard</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {isAdmin ? "Admin multi-page control platform" : "Household multi-page service dashboard"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill color={deviceStatus?.is_online ? "green" : "rose"}>
                {deviceStatus?.is_online ? "Device Online" : "Device Offline"}
              </StatusPill>
              <StatusPill color="blue">
                {isAdmin ? "Heartbeat 15s" : "Heartbeat 60s"}
              </StatusPill>
              <StatusPill color="amber">IoT Monitoring Active</StatusPill>
            </div>
          </header>

          <main className="panel min-h-0 flex-1 overflow-auto p-5 md:p-7">
            <Outlet />
          </main>

          <footer className="px-2 pb-2 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
            Smart Automated Rural Water Distribution System
          </footer>
        </div>
      </div>
    </div>
  );
}
