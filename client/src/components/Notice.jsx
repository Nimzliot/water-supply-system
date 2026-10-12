// Inline success or error message shown above a form or list.
export default function Notice({ tone = "success", children }) {
  if (!children) return null;

  const style = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>{children}</div>;
}
