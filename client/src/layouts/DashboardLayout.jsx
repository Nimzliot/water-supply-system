import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  Clock3,
  Droplets,
  FileText,
  Gauge,
  History,
  House,
  Inbox,
  LifeBuoy,
  LogOut,
  Map as MapIcon,
  Menu,
  PlusCircle,
  Receipt,
  Settings,
  SlidersHorizontal,
  Sparkles,
  ToggleRight,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
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
      { to: "/admin/ai-predictions", label: "Demand Forecast", icon: TrendingUp },
      { to: "/admin/ai-assistant", label: "AI Assistant", icon: Sparkles }
    ]
  },
  {
    heading: "Operations",
    items: [
      { to: "/admin/live-map", label: "Live Map", icon: MapIcon },
      { to: "/admin/plant-3d", label: "3D Plant", icon: Box },
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
      { to: "/admin/payments", label: "Payments", icon: Wallet },
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
      { to: "/user/lpcd-status", label: "LPCD Status", icon: Droplets },
      { to: "/user/ask-ai", label: "Ask AI", icon: Sparkles }
    ]
  },
  {
    heading: "Billing",
    items: [
      { to: "/user/bills", label: "Bills", icon: Receipt, match: ["/user/bill-details"] },
      { to: "/user/payments", label: "Payments", icon: Wallet },
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

// The four destinations used most, shown as tabs along the bottom on phones.
const adminTabs = [
  { to: "/admin/dashboard", label: "Home", icon: Gauge },
  { to: "/admin/water-distribution", label: "Supply", icon: Droplets },
  { to: "/admin/pump-control", label: "Pump", icon: Zap },
  { to: "/admin/billing", label: "Billing", icon: Receipt }
];

const userTabs = [
  { to: "/user/dashboard", label: "Home", icon: Gauge },
  { to: "/user/live-usage", label: "Live", icon: Waves },
  { to: "/user/bills", label: "Bills", icon: Receipt, match: ["/user/bill-details"] },
  { to: "/user/notifications", label: "Alerts", icon: Bell }
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
  const tabs = isAdmin ? adminTabs : userTabs;
  const currentItem = navGroups.flatMap((group) => group.items).find((item) => isActive(item, location.pathname));
  const onTab = tabs.some((tab) => isActive(tab, location.pathname));

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
    window.scrollTo(0, 0);
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
  const deviceName = isAdmin ? "Controller" : "Meter";

  return (
    <div className="min-h-screen lg:pl-[17rem] print:pl-0">
      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col bg-white transition-transform duration-200 lg:translate-x-0 lg:border-r lg:border-slate-100 print:hidden ${
          menuOpen ? "drawer-open translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Droplets size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] font-extrabold tracking-tight text-ink">Water Distribution</p>
              <p className="truncate text-xs font-medium text-slate-500">{isAdmin ? "Operations console" : "Household portal"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.heading}>
              <p className="px-3 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">{group.heading}</p>
              <div className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item, location.pathname);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[2.75rem] items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active ? "bg-brand-50 font-bold text-brand-700" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-ink"
                      }`}
                    >
                      <Icon size={19} className={`shrink-0 ${active ? "text-brand-600" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="m-3 flex shrink-0 items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.service_number || user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-ink"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white lg:hidden">
          <Droplets size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-500 lg:hidden">{isAdmin ? "Operations console" : `Hello, ${user?.name?.split(" ")[0] || "there"}`}</p>
          <p className="truncate text-[0.95rem] font-extrabold tracking-tight text-ink">{currentItem?.label || "Details"}</p>
        </div>
        <StatusPill color={online ? "green" : "rose"} dot>
          <span className="hidden sm:inline">{deviceName}&nbsp;</span>
          {online ? "Online" : "Offline"}
        </StatusPill>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-6 print:pb-0">
        {/* Keyed by path so each page eases in as it opens. */}
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* Phones: the four most-used pages as tabs, with the full menu behind "More". */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-white shadow-nav lg:hidden print:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab, location.pathname);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] transition-colors ${active ? "tab-active font-bold text-brand-600" : "font-medium text-slate-500"}`}
              >
                {active ? <span className="tab-bar absolute top-0 h-[3px] w-8 rounded-b-full bg-brand-600" /> : null}
                <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] ${onTab ? "font-medium text-slate-500" : "font-bold text-brand-600"}`}
            aria-label="Open the full menu"
          >
            <Menu size={22} strokeWidth={onTab ? 1.9 : 2.4} />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
