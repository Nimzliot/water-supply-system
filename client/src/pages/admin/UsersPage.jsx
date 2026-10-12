import { useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLive } from "../../lib/useLive";
import { errorMessage } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusPill from "../../components/StatusPill";
import Notice from "../../components/Notice";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = () => api.get("/admin/users").then(({ data }) => setUsers(data.users || []));
  useLive(load);

  const act = async (id, request, success) => {
    try {
      setBusyId(id);
      setError("");
      setMessage("");
      await request();
      setMessage(success);
      await load();
    } catch (err) {
      setError(errorMessage(err, "That change could not be saved."));
    } finally {
      setBusyId("");
    }
  };

  const changeRole = (account) => {
    const role = account.role === "admin" ? "user" : "admin";
    if (!window.confirm(`Change ${account.name} to ${role === "admin" ? "an administrator" : "a household user"}?`)) return;
    act(account.id, () => api.patch(`/admin/users/${account.id}`, { role }), `${account.name} is now ${role === "admin" ? "an administrator" : "a household user"}.`);
  };

  const resetPassword = (account) => {
    const password = window.prompt(`New password for ${account.name} (at least 5 characters):`);
    if (!password) return;
    if (password.length < 5) {
      setError("The password must contain at least 5 characters.");
      return;
    }
    act(account.id, () => api.patch(`/admin/users/${account.id}`, { password }), `Password reset for ${account.name}.`);
  };

  const remove = (account) => {
    if (!window.confirm(`Delete ${account.name}? Their usage, bills, and requests are deleted too. This cannot be undone.`)) return;
    act(account.id, () => api.delete(`/admin/users/${account.id}`), `${account.name} was deleted.`);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Users" description="Every account. Change a role, reset a forgotten password, or remove an account." />
      <Notice>{message}</Notice>
      <Notice tone="error">{error}</Notice>

      <div className="panel divide-y divide-slate-100">
        {(users || []).map((account) => {
          const isSelf = account.id === currentUser?.id;
          const busy = busyId === account.id;
          return (
            <div key={account.id} className="flex flex-col gap-3 p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{account.name}</p>
                  <StatusPill color={account.role === "admin" ? "blue" : "slate"}>{account.role === "admin" ? "Administrator" : "Household"}</StatusPill>
                  {isSelf ? <StatusPill color="green">You</StatusPill> : null}
                </div>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {account.email} · {account.service_number}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => resetPassword(account)} className="btn-secondary flex-1 disabled:opacity-60 sm:flex-none">
                  Reset password
                </button>
                {!isSelf ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => changeRole(account)} className="btn-secondary flex-1 disabled:opacity-60 sm:flex-none">
                      {account.role === "admin" ? "Make household" : "Make admin"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => remove(account)} className="btn-danger flex-1 disabled:opacity-60 sm:flex-none">
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {users === null ? <p className="p-5 text-sm text-slate-500">Loading users...</p> : null}
        {users && !users.length ? <p className="p-5 text-sm text-slate-500">No accounts found.</p> : null}
      </div>
    </div>
  );
}
