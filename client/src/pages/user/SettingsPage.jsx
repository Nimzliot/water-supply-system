import PageHeader from "../../components/PageHeader";
import ChangePasswordCard from "../../components/ChangePasswordCard";

export default function UserSettingsPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Settings" description="Change the password you sign in with." />
      <ChangePasswordCard />
    </div>
  );
}
