import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Households"
        title="Manage all village households"
        description="Search service connections, inspect usage, assign household-specific LPCD, and review bills."
        actions={
          <>
            <input className="input min-w-[260px]" placeholder="Search households" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" onClick={() => setShowForm((current) => !current)} className="btn-primary">
              {showForm ? "Close Form" : "Add Household"}
            </button>
          </>
        }
      />
      {message ? <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {showForm ? (
        <form onSubmit={handleSubmit} className="panel grid gap-4 p-5 md:grid-cols-2">
          <input className="input" placeholder="Owner name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
          <input className="input" placeholder="Mobile number" value={form.mobile} onChange={(e) => handleChange("mobile", e.target.value)} />
          <input className="input" placeholder="Service number" value={form.service_number} onChange={(e) => handleChange("service_number", e.target.value)} />
          <input className="input" placeholder="Family members" type="number" min="1" value={form.family_members} onChange={(e) => handleChange("family_members", Number(e.target.value))} />
          <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => handleChange("password", e.target.value)} />
          <textarea className="input md:col-span-2 min-h-28" placeholder="Address" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
          <div className="md:col-span-2 flex gap-3">
            <button disabled={saving} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : "Create Household"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      ) : null}
      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="px-4 py-3">Household</th>
              <th className="px-4 py-3">Service No.</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Family</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/30">
            {filteredRows.map((house) => (
              <tr key={house.id}>
                <td className="px-4 py-3 text-white">{house.name}</td>
                <td className="px-4 py-3">{house.service_number}</td>
                <td className="px-4 py-3">{house.mobile}</td>
                <td className="px-4 py-3">{house.family_members}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/household-details/${house.service_number || house.id}`} className="text-aqua">
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
