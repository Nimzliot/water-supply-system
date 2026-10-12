import { useEffect, useState } from "react";
import api from "../../lib/api";
import { errorMessage, formatMoney } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

const fields = [
  { key: "lpcd_limit", label: "Daily allowance per person (liters)", step: "1", hint: "A household's daily limit is this times its family members." },
  { key: "pump_on_threshold", label: "Pump starts below (%)", step: "1", hint: "The controller refills the tank when the level falls below this." },
  { key: "pump_off_threshold", label: "Pump stops at (%)", step: "1", hint: "Must be at least 5% above the start level." }
];

// A prototype moves a few liters, not thousands, so a village-scale tariff gives bills of a
// few paise. These rates make a small test produce a bill worth looking at.
const tariffPresets = [
  { label: "Village rate", value: 0.02 },
  { label: "Prototype: Rs. 10 / L", value: 10 },
  { label: "Prototype: Rs. 50 / L", value: 50 }
];

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [email, setEmail] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    api
      .get("/admin/settings")
      .then(({ data }) => {
        setForm(data.settings);
        setEmail(data.email || null);
      })
      .catch((err) => setError(errorMessage(err, "Unable to load settings.")));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const payload = Object.fromEntries(["tariff", ...fields.map(({ key }) => key)].map((key) => [key, Number(form[key])]));
      const { data } = await api.patch("/admin/settings", payload);
      setForm(data.settings);
      setMessage("Settings saved. The controller picks them up within a few seconds.");
    } catch (err) {
      setError(errorMessage(err, "Unable to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    try {
      setTesting(true);
      setEmailMessage("");
      setEmailError("");
      const { data } = await api.post("/admin/email/test");
      setEmailMessage(data.message);
    } catch (err) {
      setEmailError(errorMessage(err, "The test email could not be sent."));
    } finally {
      setTesting(false);
    }
  };

  const tariff = Number(form?.tariff || 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Settings" description="Billing rate, daily allowance, pump levels, and email." />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      {form ? (
        <form onSubmit={submit} className="space-y-5 sm:space-y-6">
          <div className="panel max-w-2xl p-4 sm:p-6">
            <p className="panel-title">Billing rate</p>
            <p className="mt-1 text-sm text-slate-500">Each bill is the liters a household used in the month times this rate. It applies to bills generated from now on.</p>

            <div className="mt-4">
              <label htmlFor="tariff" className="field-label">Tariff per liter (Rs.)</label>
              <input id="tariff" className="input sm:max-w-xs" type="number" inputMode="decimal" min="0" step="0.001" value={form.tariff} onChange={(e) => setForm({ ...form, tariff: e.target.value })} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tariffPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setForm({ ...form, tariff: preset.value })}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${tariff === preset.value ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
              {[1, 5, 20].map((liters) => (
                <div key={liters}>
                  <p className="text-xs font-medium text-slate-500">{liters} L costs</p>
                  <p className="mt-0.5 text-sm font-extrabold tabular-nums text-ink">{formatMoney(liters * tariff)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel max-w-2xl p-4 sm:p-6">
            <p className="panel-title">Allowance and pump levels</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          </div>

          <button disabled={saving} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </form>
      ) : !error ? (
        <p className="text-sm text-slate-500">Loading settings...</p>
      ) : null}

      {email ? (
        <div className="panel max-w-2xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="panel-title">Email</p>
            <StatusPill color={email.configured ? "green" : "amber"} dot>{email.configured ? "Ready" : "Not set up"}</StatusPill>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {email.configured
              ? `Sending from ${email.from} through ${email.provider === "smtp" ? "SMTP" : "Brevo"}. Households get their bills, payment receipts, request decisions, and support replies by email. Admins get new requests, support messages, and leak alerts.`
              : "Email is switched off until the server is given an account to send from. Add MAIL_FROM and either the SMTP_ settings or BREVO_API_KEY to the server's environment, then restart it."}
          </p>
          <div className="mt-4 space-y-3">
            <Notice>{emailMessage}</Notice>
            <Notice tone="error">{emailError}</Notice>
            <button type="button" onClick={sendTest} disabled={testing || !email.configured} className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {testing ? "Sending..." : "Send me a test email"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
