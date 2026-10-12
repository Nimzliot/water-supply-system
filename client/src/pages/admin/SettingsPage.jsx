import { useEffect, useState } from "react";
import api from "../../lib/api";
import { errorMessage } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import Notice from "../../components/Notice";

const fields = [
  { key: "tariff", label: "Tariff per liter (Rs.)", step: "0.001", hint: "Used for bills generated from now on." },
  { key: "lpcd_limit", label: "Daily allowance per person (liters)", step: "1", hint: "A household's daily limit is this times its family members." },
  { key: "pump_on_threshold", label: "Pump starts below (%)", step: "1", hint: "The controller refills the tank when the level falls below this." },
  { key: "pump_off_threshold", label: "Pump stops at (%)", step: "1", hint: "Must be at least 5% above the start level." }
];

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/admin/settings")
      .then(({ data }) => setForm(data.settings))
      .catch((err) => setError(errorMessage(err, "Unable to load settings.")));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const payload = Object.fromEntries(fields.map(({ key }) => [key, Number(form[key])]));
      const { data } = await api.patch("/admin/settings", payload);
      setForm(data.settings);
      setMessage("Settings saved. The controller picks them up within a few seconds.");
    } catch (err) {
      setError(errorMessage(err, "Unable to save settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Settings" description="Tariff, daily allowance, and the tank levels that start and stop the pump." />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      {form ? (
        <form onSubmit={submit} className="panel max-w-2xl p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="field-label">{field.label}</label>
                <input
                  id={field.key}
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={field.step}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                />
                <p className="mt-1.5 text-xs text-slate-500">{field.hint}</p>
              </div>
            ))}
          </div>
          <button disabled={saving} className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </form>
      ) : !error ? (
        <p className="text-sm text-slate-500">Loading settings...</p>
      ) : null}
    </div>
  );
}
