import { Link } from "react-router-dom";
import { AlertTriangle, Bell, Info } from "lucide-react";
import { formatDateTime } from "../lib/format";

const levels = {
  critical: { icon: AlertTriangle, style: "bg-red-50 text-red-600" },
  warning: { icon: AlertTriangle, style: "bg-amber-50 text-amber-600" },
  info: { icon: Info, style: "bg-brand-50 text-brand-600" }
};

export default function NotificationList({ notifications, loading }) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading notifications...</p>;
  }

  if (!notifications.length) {
    return (
      <div className="panel flex flex-col items-center gap-2 px-4 py-10 text-center">
        <Bell size={22} className="text-slate-300" />
        <p className="text-sm font-medium text-slate-900">Nothing needs your attention</p>
        <p className="text-sm text-slate-500">New alerts appear here as soon as they happen.</p>
      </div>
    );
  }

  return (
    <div className="panel divide-y divide-slate-100">
      {notifications.map((item) => {
        const level = levels[item.level] || levels.info;
        const Icon = level.icon;
        const body = (
          <>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${level.style}`}>
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{item.title}</p>
              {item.detail ? <p className="mt-0.5 break-words text-sm text-slate-600">{item.detail}</p> : null}
              {item.time ? <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.time)}</p> : null}
            </div>
          </>
        );

        return item.link ? (
          <Link key={item.id} to={item.link} className="flex gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
            {body}
          </Link>
        ) : (
          <div key={item.id} className="flex gap-3 px-4 py-3 sm:px-5">
            {body}
          </div>
        );
      })}
    </div>
  );
}
