import { useAuth } from "../../lib/auth";
import PageHeader from "../../components/PageHeader";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Profile"
        description="Your household account details."
      />
      <div className="panel max-w-2xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Name</p>
            <p className="mt-2 text-slate-900">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Service Number</p>
            <p className="mt-2 text-slate-900">{user?.service_number}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Mobile</p>
            <p className="mt-2 text-slate-900">{user?.mobile}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Family Members</p>
            <p className="mt-2 text-slate-900">{user?.family_members}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500">Address</p>
          <p className="mt-2 text-slate-900">{user?.address}</p>
        </div>
      </div>
    </div>
  );
}
