import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";

const initialForm = {
  name: "",
  email: "",
  mobile: "",
  address: "",
  family_members: 4,
  service_number: "",
  password: ""
};

export default function HouseholdsPage() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/admin/houses");
    setRows(data.houses || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((house) =>
      [house.name, house.service_number, house.mobile, house.email]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(value))
    );
  }, [query, rows]);

  const handleChange = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await api.post("/auth/register", form);
      setMessage("Household added successfully.");
      setForm(initialForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add household.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Households"
        description="All registered household connections."
        actions={
          <>
            <input className="input w-full sm:w-64" placeholder="Search households" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" onClick={() => setShowForm((current) => !current)} className="btn-primary">
              {showForm ? "Close Form" : "Add Household"}
            </button>
          </>
        }
      />
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {showForm ? (
        <form onSubmit={handleSubmit} className="panel grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          <input className="input" placeholder="Owner name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
          <input className="input" placeholder="Mobile number" value={form.mobile} onChange={(e) => handleChange("mobile", e.target.value)} />
          <input className="input" placeholder="Service number" value={form.service_number} onChange={(e) => handleChange("service_number", e.target.value)} />
          <input className="input" placeholder="Family members" type="number" min="1" value={form.family_members} onChange={(e) => handleChange("family_members", Number(e.target.value))} />
          <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => handleChange("password", e.target.value)} />
          <textarea className="input md:col-span-2 min-h-28" placeholder="Address" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button disabled={saving} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : "Create Household"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      ) : null}
      {/* Phones get a stacked list; the table needs more width than they have. */}
      <div className="panel divide-y divide-slate-100 md:hidden">
        {filteredRows.map((house) => (
          <Link
            key={house.id}
            to={`/admin/household-details/${house.service_number || house.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{house.name}</p>
              <p className="truncate text-xs text-slate-500">
                {house.service_number} · {house.family_members} {house.family_members === 1 ? "member" : "members"}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-400" />
          </Link>
        ))}
        {!filteredRows.length ? <p className="p-4 text-sm text-slate-500">No households found.</p> : null}
      </div>

      <div className="panel hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Household</th>
              <th className="px-5 py-3 font-medium">Service no.</th>
              <th className="px-5 py-3 font-medium">Mobile</th>
              <th className="px-5 py-3 font-medium">Family</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((house) => (
              <tr key={house.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{house.name}</td>
                <td className="px-5 py-3 text-slate-600">{house.service_number}</td>
                <td className="px-5 py-3 text-slate-600">{house.mobile}</td>
                <td className="px-5 py-3 tabular-nums text-slate-600">{house.family_members}</td>
                <td className="px-5 py-3 text-right">
                  <Link to={`/admin/household-details/${house.service_number || house.id}`} className="font-medium text-brand-700 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!filteredRows.length ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-sm text-slate-500">No households found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
