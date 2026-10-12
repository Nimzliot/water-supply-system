import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Clock3,
  Droplets,
  FileText,
  Gauge,
  History,
  House,
  Inbox,
  LifeBuoy,
  LogOut,
  Menu,
  PlusCircle,
  Receipt,
  Settings,
  SlidersHorizontal,
  ToggleRight,
  TrendingUp,
  UserCog,
  Users,
  Waves,
  X,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import StatusPill from "../components/StatusPill";
import api from "../lib/api";
import { socket } from "../lib/socket";

const adminNav = [
  {
    heading: "Overview",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: Gauge },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/ai-predictions", label: "Demand Forecast", icon: TrendingUp }
    ]
  },
  {
    heading: "Operations",
    items: [
      { to: "/admin/tank-monitoring", label: "Tank Monitoring", icon: Waves },
      { to: "/admin/water-distribution", label: "Water Distribution", icon: Droplets },
      { to: "/admin/pump-control", label: "Pump Control", icon: Zap },
      { to: "/admin/valve-control", label: "Valve Control", icon: ToggleRight },
      { to: "/admin/schedules", label: "Schedules", icon: Clock3 },
      { to: "/admin/system-controls", label: "System Controls", icon: SlidersHorizontal }
    ]
  },
  {
    heading: "Households",
    items: [
      { to: "/admin/households", label: "Households", icon: House, match: ["/admin/household-details"] },
      { to: "/admin/billing", label: "Billing", icon: Receipt },
      { to: "/admin/lpcd-requests", label: "LPCD Requests", icon: Inbox },
      { to: "/admin/support", label: "Support", icon: LifeBuoy }
    ]
  },
  {
    heading: "Monitoring",
    items: [
      { to: "/admin/leakage-alerts", label: "Leakage Alerts", icon: AlertTriangle },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
      { to: "/admin/system-health", label: "System Health", icon: Activity },
      { to: "/admin/reports", label: "Reports", icon: FileText }
    ]
  },
  {
    heading: "Account",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/settings", label: "Settings", icon: Settings },
      { to: "/admin/profile", label: "Profile", icon: UserCog }
    ]
  }
];

const userNav = [
  {
    heading: "My Water",
    items: [
      { to: "/user/dashboard", label: "Dashboard", icon: Gauge },
      { to: "/user/live-usage", label: "Live Usage", icon: Waves },
      { to: "/user/usage-history", label: "Usage History", icon: History },
      { to: "/user/lpcd-status", label: "LPCD Status", icon: Droplets }
    ]
  },
  {
    heading: "Billing",
    items: [
      { to: "/user/bills", label: "Bills", icon: Receipt, match: ["/user/bill-details"] },
      { to: "/user/request-extra-water", label: "Request Extra Water", icon: PlusCircle }
    ]
  },
  {
    heading: "Account",
    items: [
      { to: "/user/notifications", label: "Notifications", icon: Bell },
      { to: "/user/profile", label: "Profile", icon: UserCog },
      { to: "/user/support", label: "Support", icon: LifeBuoy },
      { to: "/user/settings", label: "Settings", icon: Settings }
    ]
  }
];

function isActive(item, pathname) {
  return [item.to, ...(item.match || [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";
}

export default function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const isAdmin = user?.role === "admin";
  const navGroups = isAdmin ? adminNav : userNav;
  const currentItem = navGroups.flatMap((group) => group.items).find((item) => isActive(item, location.pathname));

  useEffect(() => {
    if (!user) return;

    const endpoint = isAdmin ? "/admin/device-status" : "/user/device-status";
    const load = async () => {
      try {
        const { data } = await api.get(endpoint);
        const controller = data.devices?.find((device) => device.device_key === "SYSTEM-ESP32") || data.devices?.[0];
        setDeviceStatus(isAdmin ? controller || null : data.device || null);
      } catch {
        setDeviceStatus(null);
      }
    };

    // Heartbeats arrive over the socket; the timer re-checks so the pill turns red when they stop.
    const handleDevice = (device) => {
      const mine = isAdmin ? device.device_key === "SYSTEM-ESP32" : device.service_number === user.service_number;
      if (mine) setDeviceStatus(device);
    };

    load();
    socket.on("device:update", handleDevice);
    const interval = window.setInterval(load, 20000);
    return () => {
      socket.off("device:update", handleDevice);
      window.clearInterval(interval);
    };
  }, [user, isAdmin]);

  // The drawer is only a drawer on small screens: close it on navigation and on Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const online = Boolean(deviceStatus?.is_online);
  const deviceName = isAdmin ? "Controller" : "Device";

  return (
    <div className="min-h-screen lg:pl-64 print:pl-0">
      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 print:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Droplets size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Water Distribution</p>
              <p className="truncate text-xs text-slate-500">{isAdmin ? "Operations console" : "Household portal"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.heading}>
              <p className="px-3 text-xs font-medium uppercase tracking-wide text-slate-400">{group.heading}</p>
              <div className="mt-1.5 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item, location.pathname);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[2.5rem] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon size={18} className={`shrink-0 ${active ? "text-brand-600" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.service_number || user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 print:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{currentItem?.label || "Details"}</p>
        <StatusPill color={online ? "green" : "rose"} dot>
          <span className="hidden sm:inline">{deviceName}:&nbsp;</span>
          {online ? "Online" : "Offline"}
        </StatusPill>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
