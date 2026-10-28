import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {back}
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-card p-5 shadow-xs ${className}`}>{children}</section>;
}

export function CardTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-fg">{children}</h2>
      {actions}
    </div>
  );
}

/** Contenedor de tablas con desplazamiento horizontal en pantallas angostas. */
export function TableWrap({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = 'border-b border-line bg-subtle px-4 py-2.5 text-xs font-semibold tracking-wide text-fg-muted uppercase';
export const td = 'border-b border-line px-4 py-3 align-top text-fg';

export function Stat({ label, value, tone = 'default', hint }: { label: string; value: ReactNode; tone?: 'default' | 'warning' | 'danger'; hint?: ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg';
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={`text-2xl font-bold tabular-nums ${color}`}>{value}</dd>
      {hint ? <dd className="text-xs text-fg-muted">{hint}</dd> : null}
    </div>
  );
}
