// Inline success or error message shown above a form or list.
export default function Notice({ tone = "success", children }) {
  if (!children) return null;

  const style =
    tone === "error" ? "border-red-200 bg-red-50 text-red-700" : tone === "info" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`pop-in rounded-xl border px-4 py-3 text-sm font-medium ${style}`}>{children}</div>;
}
