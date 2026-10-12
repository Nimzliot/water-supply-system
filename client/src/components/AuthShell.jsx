import { Droplets } from "lucide-react";

// Shared frame for the signed-out pages.
export default function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"}`}>
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Droplets size={20} />
          </span>
          <span className="text-base font-semibold text-slate-900">Water Distribution</span>
        </div>

        <div className="panel p-5 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-slate-500">{footer}</div> : null}
      </div>
    </div>
  );
}
