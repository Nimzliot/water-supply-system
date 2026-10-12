import { useAuth } from "../../lib/auth";
import PageHeader from "../../components/PageHeader";
import ChangePasswordCard from "../../components/ChangePasswordCard";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const rows = [
    ["Name", user?.name],
    ["Role", "Administrator"],
    ["Email", user?.email],
    ["Mobile", user?.mobile]
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Profile" description="Your account details." />
      <div className="panel max-w-xl p-4 sm:p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm text-slate-900">{value || "--"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ChangePasswordCard />
    </div>
  );
}
