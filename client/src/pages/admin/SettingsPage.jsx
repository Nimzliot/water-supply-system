import PageHeader from "../../components/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Global thresholds and utility configuration"
        description="Configure tariff rates, LPCD limits, overflow thresholds, and API-facing system settings."
      />
      <div className="panel max-w-3xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <input className="input" defaultValue="0.02" placeholder="Tariff per liter" />
          <input className="input" defaultValue="135" placeholder="Default LPCD limit" />
          <input className="input" defaultValue="70" placeholder="Pump ON threshold" />
          <input className="input" defaultValue="95" placeholder="Pump OFF threshold" />
        </div>
        <button className="btn-primary mt-5">Save Settings</button>
      </div>
    </div>
  );
}

