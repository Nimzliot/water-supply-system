import { useAuth } from "../../lib/auth";
import PageHeader from "../../components/PageHeader";

export default function AdminProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Profile" title="Admin profile and access identity" description="Operator profile details for the command center." />
      <div className="panel max-w-2xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Name</p>
            <p className="mt-2 text-white">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Role</p>
            <p className="mt-2 text-white capitalize">{user?.role}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Email</p>
            <p className="mt-2 text-white">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mobile</p>
            <p className="mt-2 text-white">{user?.mobile}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
