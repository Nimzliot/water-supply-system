import { useAuth } from "../../lib/auth";
import PageHeader from "../../components/PageHeader";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Household account details"
        description="Service number, family members, address, and contact information."
      />
      <div className="panel mt-6 max-w-2xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Name</p>
            <p className="mt-2 text-white">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Service Number</p>
            <p className="mt-2 text-white">{user?.service_number}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mobile</p>
            <p className="mt-2 text-white">{user?.mobile}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Family Members</p>
            <p className="mt-2 text-white">{user?.family_members}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Address</p>
          <p className="mt-2 text-white">{user?.address}</p>
        </div>
      </div>
    </div>
  );
}
