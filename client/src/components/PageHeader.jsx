export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="panel-title">{eyebrow}</p> : null}
        <h2 className="mt-2 text-3xl font-bold text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

