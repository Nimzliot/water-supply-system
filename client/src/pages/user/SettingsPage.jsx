import PageHeader from "../../components/PageHeader";

export default function UserSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Theme, notifications, and password preferences"
        description="Household preference settings for a simpler personalized experience."
      />
      <div className="panel max-w-3xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <select className="input" defaultValue="dark">
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </select>
          <select className="input" defaultValue="enabled">
            <option value="enabled">Notifications Enabled</option>
            <option value="disabled">Notifications Disabled</option>
          </select>
          <input className="input" type="password" placeholder="New password" />
          <input className="input" type="password" placeholder="Confirm password" />
        </div>
        <button className="btn-primary mt-5">Save Preferences</button>
      </div>
    </div>
  );
}

