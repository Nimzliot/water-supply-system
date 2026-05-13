import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="Admin and platform user management"
        description="Create admin accounts, disable users, and manage role-based access."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <FeatureListCard
          title="Management Features"
          items={[
            "Create new admin operators",
            "Disable or re-enable user accounts",
            "Review current role assignments",
            "Audit privileged access changes"
          ]}
        />
        <FeatureListCard
          title="Recommended Backend Extensions"
          items={[
            "Private admin bootstrap route or script",
            "Role update endpoint",
            "User deactivation flag",
            "Access audit log table"
          ]}
          tone="info"
        />
      </div>
    </div>
  );
}

